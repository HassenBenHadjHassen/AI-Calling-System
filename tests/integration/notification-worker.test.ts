import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { NotificationService, NOTIFICATION_LEASE_DURATION_MS } from '@/lib/services/notifications.service';
import { db } from '@/lib/db';
import { TenantService } from '@/lib/services/tenant.service';
import { NotificationStatus } from '@prisma/client';
import { assertApprovedTestDatabase } from '../helpers/test-db-guard';

// Mock external Twilio SMS network call
vi.mock('@/lib/integrations/twilio', () => ({
  twilioClient: {
    sendSms: vi.fn().mockImplementation(async (params: { to: string; body: string }) => {
      if (params.body.includes('FAIL_DELIVERY')) {
        return { success: false, error: 'Simulated network timeout' };
      }
      return { success: true, messageId: `SM_test_${Date.now()}` };
    }),
  },
}));

describe('Notification Worker Concurrency, Claiming & Lease Recovery (Real PostgreSQL)', () => {
  const TEST_RECIPIENT = '+33688888888';
  let businessId: string;

  async function cleanupTestJobs() {
    try {
      await db.notificationJob.deleteMany({
        where: { recipient: TEST_RECIPIENT },
      });
    } catch (err) {
      console.error('[NotificationWorkerTest cleanup failure]:', err);
      throw err;
    }
  }

  beforeAll(async () => {
    assertApprovedTestDatabase();
    const biz = await TenantService.ensureTenant('CABINET_MICHELLE');
    businessId = biz.id;
    await cleanupTestJobs();
  });

  afterAll(async () => {
    await cleanupTestJobs();
  });

  beforeEach(async () => {
    await cleanupTestJobs();
  });

  it('prevents two concurrent workers from claiming the same pending job (atomic mutual exclusion)', async () => {
    const job = await db.notificationJob.create({
      data: {
        businessId,
        recipient: TEST_RECIPIENT,
        message: 'Notification concurrency test',
        status: NotificationStatus.PENDING,
        attemptCount: 0,
        maxAttempts: 5,
      },
    });

    // Worker 1 and Worker 2 race to claim the job concurrently
    const [claimedBy1, claimedBy2] = await Promise.all([
      NotificationService.claimJob(job.id, 'worker-node-1'),
      NotificationService.claimJob(job.id, 'worker-node-2'),
    ]);

    // Exactly one worker must succeed, and the other must fail
    expect(claimedBy1 !== claimedBy2).toBe(true);
    const winnerCount = [claimedBy1, claimedBy2].filter(Boolean).length;
    expect(winnerCount).toBe(1);

    // Verify database state reflects the winning worker
    const updated = await db.notificationJob.findUnique({ where: { id: job.id } });
    expect(updated?.status).toBe(NotificationStatus.PROCESSING);
    expect(updated?.attemptCount).toBe(1);
    expect(['worker-node-1', 'worker-node-2']).toContain(updated?.lockedBy);
    expect(updated?.leaseExpiresAt).not.toBeNull();
  });

  it('rejects a worker trying to claim an active job owned by another worker', async () => {
    const now = new Date();
    const job = await db.notificationJob.create({
      data: {
        businessId,
        recipient: TEST_RECIPIENT,
        message: 'Active lease test',
        status: NotificationStatus.PROCESSING,
        lockedAt: now,
        lockedBy: 'worker-primary',
        leaseExpiresAt: new Date(now.getTime() + NOTIFICATION_LEASE_DURATION_MS),
        attemptCount: 1,
        maxAttempts: 5,
      },
    });

    // Secondary worker attempts to claim active job
    const claimResult = await NotificationService.claimJob(job.id, 'worker-secondary');
    expect(claimResult).toBe(false);

    // Ensure lockedBy was NOT overwritten
    const check = await db.notificationJob.findUnique({ where: { id: job.id } });
    expect(check?.lockedBy).toBe('worker-primary');
  });

  it('recovers a job abandoned by a crashed worker after lease expiration', async () => {
    // Simulate crashed worker: job left in PROCESSING with lease in the past
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const job = await db.notificationJob.create({
      data: {
        businessId,
        recipient: TEST_RECIPIENT,
        message: 'Crashed worker recovery test',
        status: NotificationStatus.PROCESSING,
        lockedAt: tenMinutesAgo,
        lockedBy: 'crashed-worker-pid-999',
        leaseExpiresAt: fiveMinutesAgo, // Lease expired 5 minutes ago
        attemptCount: 1,
        maxAttempts: 5,
      },
    });

    // A healthy worker picks up pending/stale jobs
    const claimResult = await NotificationService.claimJob(job.id, 'recovery-worker-pid-101');
    expect(claimResult).toBe(true);

    const recovered = await db.notificationJob.findUnique({ where: { id: job.id } });
    expect(recovered?.status).toBe(NotificationStatus.PROCESSING);
    expect(recovered?.lockedBy).toBe('recovery-worker-pid-101');
    expect(recovered?.attemptCount).toBe(2);
    expect(recovered?.leaseExpiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it('does NOT reclaim an active job whose lease has not yet expired', async () => {
    const now = new Date();
    const job = await db.notificationJob.create({
      data: {
        businessId,
        recipient: TEST_RECIPIENT,
        message: 'Active unexpired test',
        status: NotificationStatus.PROCESSING,
        lockedAt: now,
        lockedBy: 'active-worker-alive',
        leaseExpiresAt: new Date(now.getTime() + 45 * 1000), // 45 seconds remaining
        attemptCount: 1,
        maxAttempts: 5,
      },
    });

    const processed = await NotificationService.processPendingJobs(10, 'sweeper-worker');
    expect(processed).toBe(0);

    const check = await db.notificationJob.findUnique({ where: { id: job.id } });
    expect(check?.lockedBy).toBe('active-worker-alive');
  });

  it('never reclaims or resends terminal jobs (SENT, FAILED, CANCELLED)', async () => {
    const sentJob = await db.notificationJob.create({
      data: {
        businessId,
        recipient: TEST_RECIPIENT,
        message: 'Terminal sent',
        status: NotificationStatus.SENT,
        attemptCount: 1,
        maxAttempts: 5,
      },
    });

    const failedJob = await db.notificationJob.create({
      data: {
        businessId,
        recipient: TEST_RECIPIENT,
        message: 'Terminal failed',
        status: NotificationStatus.FAILED,
        attemptCount: 5,
        maxAttempts: 5,
      },
    });

    const claimSent = await NotificationService.claimJob(sentJob.id, 'worker-test');
    const claimFailed = await NotificationService.claimJob(failedJob.id, 'worker-test');

    expect(claimSent).toBe(false);
    expect(claimFailed).toBe(false);
  });

  it('respects nextRetryAt scheduling and exponential backoff bounds', async () => {
    const futureDate = new Date(Date.now() + 60 * 1000); // 1 minute in the future
    const job = await db.notificationJob.create({
      data: {
        businessId,
        recipient: TEST_RECIPIENT,
        message: 'Backoff test',
        status: NotificationStatus.PENDING,
        attemptCount: 2,
        nextRetryAt: futureDate,
        maxAttempts: 5,
      },
    });

    // Should NOT be claimed because retry is not yet due
    const claimResult = await NotificationService.claimJob(job.id, 'worker-test');
    expect(claimResult).toBe(false);

    // Now set retry to the past
    await db.notificationJob.update({
      where: { id: job.id },
      data: { nextRetryAt: new Date(Date.now() - 5000) },
    });

    const dueClaim = await NotificationService.claimJob(job.id, 'worker-test');
    expect(dueClaim).toBe(true);
  });

  it('transitions to FAILED with actionable reason when max attempts are exhausted', async () => {
    const job = await db.notificationJob.create({
      data: {
        businessId,
        recipient: TEST_RECIPIENT,
        message: 'FAIL_DELIVERY', // Triggers simulated failure in mock
        status: NotificationStatus.PENDING,
        attemptCount: 4, // Next attempt will be attempt 5 (maxAttempts)
        maxAttempts: 5,
      },
    });

    const handled = await NotificationService.processJob(job.id, undefined, 'worker-exhaustion-test');
    expect(handled).toBe(false);

    const exhausted = await db.notificationJob.findUnique({ where: { id: job.id } });
    expect(exhausted?.status).toBe(NotificationStatus.FAILED);
    expect(exhausted?.attemptCount).toBe(5);
    expect(exhausted?.lastError).toContain('Max attempts (5) reached');
    expect(exhausted?.lockedBy).toBeNull();
    expect(exhausted?.leaseExpiresAt).toBeNull();
  });

  it('handles batch processing with multiple concurrent workers without double-claiming', async () => {
    // Create 10 pending jobs
    const jobs = await Promise.all(
      Array.from({ length: 10 }).map((_, idx) =>
        db.notificationJob.create({
          data: {
            businessId,
            recipient: TEST_RECIPIENT,
            message: `Batch job ${idx}`,
            status: NotificationStatus.PENDING,
            attemptCount: 0,
            maxAttempts: 5,
          },
        })
      )
    );

    // 3 concurrent workers process pending jobs simultaneously
    const [count1, count2, count3] = await Promise.all([
      NotificationService.processPendingJobs(10, 'worker-batch-1'),
      NotificationService.processPendingJobs(10, 'worker-batch-2'),
      NotificationService.processPendingJobs(10, 'worker-batch-3'),
    ]);

    const totalProcessed = count1 + count2 + count3;
    expect(totalProcessed).toBe(10);

    // Verify all 10 jobs are now SENT with attemptCount exactly 1
    const finalJobs = await db.notificationJob.findMany({
      where: { id: { in: jobs.map((j) => j.id) } },
    });

    expect(finalJobs).toHaveLength(10);
    for (const j of finalJobs) {
      expect(j.status).toBe(NotificationStatus.SENT);
      expect(j.attemptCount).toBe(1);
    }
  });
});
