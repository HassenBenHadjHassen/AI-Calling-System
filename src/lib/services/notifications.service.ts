import { db } from '../db';
import { twilioClient } from '../integrations/twilio';
import { NotificationChannel, NotificationStatus } from '@prisma/client';

export interface QueueNotificationParams {
  businessId: string;
  channel?: NotificationChannel;
  recipient: string;
  message: string;
  from?: string;
  sendImmediately?: boolean;
}

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
      console.log(`[Notification Deduplication] Skipping duplicate notification to ${params.recipient}`);
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
   * Processes a single notification job by ID.
   */
  static async processJob(jobId: string, fromNumber?: string) {
    const job = await db.notificationJob.findUnique({
      where: { id: jobId },
    });

    if (!job || job.status === NotificationStatus.SENT || job.status === NotificationStatus.CANCELLED) {
      return;
    }

    // Atomically mark processing
    await db.notificationJob.update({
      where: { id: jobId },
      data: {
        status: NotificationStatus.PROCESSING,
        attemptCount: { increment: 1 },
      },
    });

    try {
      const result = await twilioClient.sendSms({
        to: job.recipient,
        body: job.message,
        from: fromNumber,
      });

      if (result.success) {
        await db.notificationJob.update({
          where: { id: jobId },
          data: {
            status: NotificationStatus.SENT,
            providerMessageId: result.messageId,
            lastError: null,
          },
        });
      } else {
        await this.handleJobFailure(job.id, job.attemptCount + 1, job.maxAttempts, result.error || 'Delivery failed');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await this.handleJobFailure(job.id, job.attemptCount + 1, job.maxAttempts, errMsg);
    }
  }

  private static async handleJobFailure(
    jobId: string,
    currentAttempts: number,
    maxAttempts: number,
    errorMsg: string
  ) {
    if (currentAttempts >= maxAttempts) {
      await db.notificationJob.update({
        where: { id: jobId },
        data: {
          status: NotificationStatus.FAILED,
          lastError: `Max attempts (${maxAttempts}) reached. Error: ${errorMsg}`,
        },
      });
    } else {
      // Exponential backoff: 10s, 20s, 40s, 80s... max 300s
      const delaySeconds = Math.min(300, Math.pow(2, currentAttempts) * 10);
      const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);

      await db.notificationJob.update({
        where: { id: jobId },
        data: {
          status: NotificationStatus.PENDING,
          nextRetryAt,
          lastError: errorMsg,
        },
      });
    }
  }

  /**
   * Processes all pending or retry-ready notification jobs (used by background worker).
   */
  static async processPendingJobs(batchSize = 20) {
    const now = new Date();

    const jobs = await db.notificationJob.findMany({
      where: {
        status: NotificationStatus.PENDING,
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: now } },
        ],
      },
      take: batchSize,
      orderBy: { createdAt: 'asc' },
    });

    for (const job of jobs) {
      await this.processJob(job.id);
    }

    return jobs.length;
  }
}
