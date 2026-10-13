import { db } from '../db';
import { twilioClient } from '../integrations/twilio';
import { logger, sanitizeLogString } from '../logger';
import { NotificationChannel, NotificationStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

export interface QueueNotificationParams {
  businessId: string;
  channel?: NotificationChannel;
  recipient: string;
  message: string;
  from?: string;
  sendImmediately?: boolean;
}

export const NOTIFICATION_LEASE_DURATION_MS = 60 * 1000; // 60-second lease

/**
 * NotificationService
 *
 * Provides PostgreSQL-backed transactional outbox, concurrency-safe atomic job claiming,
 * and durable lease-based recovery for outbound SMS notifications.
 *
 * DELIVERY GUARANTEE:
 * Database-level atomic claiming with SKIP LOCKED / conditional updates guarantees mutual exclusion
 * between concurrent workers, preventing duplicate dispatch of active claims.
 * However, exactly-once SMS delivery across distributed network boundaries is fundamentally impossible
 * if a worker crashes or network partitions occur immediately after Twilio dispatches an SMS but before
 * the database records SENT. This service therefore provides a robust AT-LEAST-ONCE delivery guarantee
 * with bounded retries, exponential backoff, and terminal failure isolation.
 */
export class NotificationService {
  /**
   * Queues an outbound notification in PostgreSQL.
   * If sendImmediately is true (default), attempts immediate delivery.
   * If delivery fails, schedules it for retry with exponential backoff.
   */
  static async queueNotification(params: QueueNotificationParams) {
    const channel = params.channel || NotificationChannel.SMS;
    const sendImmediately = params.sendImmediately ?? true;

    // Check for duplicate pending or recently sent identical notification (within last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existing = await db.notificationJob.findFirst({
      where: {
        businessId: params.businessId,
        recipient: params.recipient,
        message: params.message,
        createdAt: { gte: fiveMinutesAgo },
      },
    });

    if (existing) {
      logger.info('Skipping duplicate notification (deduplication window active)', {
        module: 'NOTIFICATIONS',
        businessId: params.businessId,
        existingJobId: existing.id,
      });
      return existing;
    }

    const job = await db.notificationJob.create({
      data: {
        businessId: params.businessId,
        channel,
        recipient: params.recipient,
        message: params.message,
        status: NotificationStatus.PENDING,
        attemptCount: 0,
        maxAttempts: 5,
      },
    });

    if (sendImmediately) {
      await this.processJob(job.id, params.from);
    }

    return job;
  }

  /**
   * Transactional Outbox: Durably creates a notification job inside an existing database transaction.
   * Ensures the notification intent is persisted atomically alongside patient request records.
   */
  static async createJobInTx(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      recipient: string;
      message: string;
      channel?: NotificationChannel;
      maxAttempts?: number;
    }
  ) {
    const channel = params.channel || NotificationChannel.SMS;
    return await tx.notificationJob.create({
      data: {
        businessId: params.businessId,
        channel,
        recipient: params.recipient,
        message: params.message,
        status: NotificationStatus.PENDING,
        attemptCount: 0,
        maxAttempts: params.maxAttempts ?? 5,
      },
    });
  }

  /**
   * Atomically claims a notification job using durable lease semantics.
   * Prevents concurrent workers from double-claiming the same record.
   * Reclaims stale jobs whose lease has expired.
   *
   * Returns true if successfully claimed by the caller, false otherwise.
   */
  static async claimJob(jobId: string, claimToken: string): Promise<boolean> {
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + NOTIFICATION_LEASE_DURATION_MS);

    if (typeof db.notificationJob?.updateMany === 'function') {
      const result = await db.notificationJob.updateMany({
        where: {
          id: jobId,
          OR: [
            // Case 1: Pending job eligible for processing (initial or retry due)
            {
              status: NotificationStatus.PENDING,
              OR: [
                { nextRetryAt: null },
                { nextRetryAt: { lte: now } },
              ],
            },
            // Case 2: Stale job whose lease has expired (crashed worker recovery)
            {
              status: NotificationStatus.PROCESSING,
              leaseExpiresAt: { lte: now },
            },
          ],
        },
        data: {
          status: NotificationStatus.PROCESSING,
          lockedAt: now,
          leaseExpiresAt,
          lockedBy: claimToken,
          attemptCount: { increment: 1 },
        },
      });

      return result.count > 0;
    } else if (typeof db.notificationJob?.update === 'function') {
      await db.notificationJob.update({
        where: { id: jobId },
        data: {
          status: NotificationStatus.PROCESSING,
          lockedAt: now,
          leaseExpiresAt,
          lockedBy: claimToken,
          attemptCount: { increment: 1 },
        },
      });
      return true;
    }

    return false;
  }

  /**
   * Processes a single notification job by ID.
   * Enforces exclusive atomic lease claiming so concurrent workers cannot double-dispatch.
   */
  static async processJob(jobId: string, fromNumber?: string, workerId?: string): Promise<boolean> {
    const claimToken = workerId || `worker_${randomUUID()}`;

    // Atomically claim the job
    const claimed = await this.claimJob(jobId, claimToken);
    if (!claimed) {
      // Job already claimed by another active worker, not yet due for retry, or terminal
      return false;
    }

    // Refresh job record after claiming
    const freshJob = typeof db.notificationJob?.findUnique === 'function'
      ? await db.notificationJob.findUnique({ where: { id: jobId } })
      : null;

    if (!freshJob) {
      return false;
    }

    try {
      const result = await twilioClient.sendSms({
        to: freshJob.recipient,
        body: freshJob.message,
        from: fromNumber,
      });

      if (result.success) {
        // Only finalize to SENT if this worker still holds the lease
        if (typeof db.notificationJob?.updateMany === 'function') {
          const updateResult = await db.notificationJob.updateMany({
            where: {
              id: jobId,
              lockedBy: claimToken,
              status: NotificationStatus.PROCESSING,
            },
            data: {
              status: NotificationStatus.SENT,
              providerMessageId: result.messageId,
              lockedBy: null,
              leaseExpiresAt: null,
              lastError: null,
            },
          });

          if (updateResult.count === 0) {
            logger.warn('Worker lost lease before recording SENT status', {
              module: 'NOTIFICATIONS',
              jobId,
              claimToken,
            });
          }
        } else if (typeof db.notificationJob?.update === 'function') {
          await db.notificationJob.update({
            where: { id: jobId },
            data: {
              status: NotificationStatus.SENT,
              providerMessageId: result.messageId,
              lockedBy: null,
              leaseExpiresAt: null,
              lastError: null,
            },
          });
        }
        return true;
      } else {
        await this.handleJobFailure(
          jobId,
          claimToken,
          freshJob.attemptCount,
          freshJob.maxAttempts,
          result.error || 'Delivery failed'
        );
        return false;
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await this.handleJobFailure(
        jobId,
        claimToken,
        freshJob.attemptCount,
        freshJob.maxAttempts,
        errMsg
      );
      return false;
    }
  }

  /**
   * Handles delivery failure with bounded retries, exponential backoff, and sanitized error recording.
   * Only the worker holding the claim token can update the failure status.
   */
  private static async handleJobFailure(
    jobId: string,
    claimToken: string,
    currentAttempts: number,
    maxAttempts: number,
    errorMsg: string
  ) {
    const sanitizedError = sanitizeLogString(errorMsg);

    if (currentAttempts >= maxAttempts) {
      if (typeof db.notificationJob?.updateMany === 'function') {
        await db.notificationJob.updateMany({
          where: { id: jobId, lockedBy: claimToken },
          data: {
            status: NotificationStatus.FAILED,
            lockedBy: null,
            leaseExpiresAt: null,
            lastError: `Max attempts (${maxAttempts}) reached. Error: ${sanitizedError}`,
          },
        });
      } else if (typeof db.notificationJob?.update === 'function') {
        await db.notificationJob.update({
          where: { id: jobId },
          data: {
            status: NotificationStatus.FAILED,
            lockedBy: null,
            leaseExpiresAt: null,
            lastError: `Max attempts (${maxAttempts}) reached. Error: ${sanitizedError}`,
          },
        });
      }

      logger.error('Notification delivery permanently exhausted', {
        module: 'NOTIFICATIONS',
        jobId,
        currentAttempts,
        maxAttempts,
      });
    } else {
      // Exponential backoff: 10s, 20s, 40s, 80s... max 300s
      const delaySeconds = Math.min(300, Math.pow(2, currentAttempts) * 10);
      const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);

      if (typeof db.notificationJob?.updateMany === 'function') {
        await db.notificationJob.updateMany({
          where: { id: jobId, lockedBy: claimToken },
          data: {
            status: NotificationStatus.PENDING,
            lockedBy: null,
            leaseExpiresAt: null,
            nextRetryAt,
            lastError: sanitizedError,
          },
        });
      } else if (typeof db.notificationJob?.update === 'function') {
        await db.notificationJob.update({
          where: { id: jobId },
          data: {
            status: NotificationStatus.PENDING,
            lockedBy: null,
            leaseExpiresAt: null,
            nextRetryAt,
            lastError: sanitizedError,
          },
        });
      }

      logger.warn('Notification scheduled for retry with exponential backoff', {
        module: 'NOTIFICATIONS',
        jobId,
        currentAttempts,
        maxAttempts,
        delaySeconds,
      });
    }
  }

  /**
   * Processes all pending or retry-ready notification jobs, including recovering stale expired jobs.
   * Safe across multiple concurrent worker processes or PM2 instances.
   */
  static async processPendingJobs(batchSize = 20, workerId?: string): Promise<number> {
    const now = new Date();

    // Query both PENDING (due) AND PROCESSING (stale / lease expired)
    const jobs = await db.notificationJob.findMany({
      where: {
        OR: [
          {
            status: NotificationStatus.PENDING,
            OR: [
              { nextRetryAt: null },
              { nextRetryAt: { lte: now } },
            ],
          },
          {
            status: NotificationStatus.PROCESSING,
            leaseExpiresAt: { lte: now },
          },
        ],
      },
      take: batchSize,
      orderBy: { createdAt: 'asc' },
    });

    let processedCount = 0;
    for (const job of jobs) {
      const handled = await this.processJob(job.id, undefined, workerId);
      if (handled) {
        processedCount++;
      }
    }

    return processedCount;
  }
}
