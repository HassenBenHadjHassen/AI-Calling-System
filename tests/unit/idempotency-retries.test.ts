import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookProcessingService } from '@/lib/services/webhook-processing.service';
import { NotificationService } from '@/lib/services/notifications.service';
import { WebhookProvider, WebhookProcessingStatus, NotificationStatus } from '@prisma/client';

vi.mock('@/lib/db', () => {
  return {
    db: {
      webhookEvent: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      notificationJob: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
    },
  };
});

import { db } from '@/lib/db';

describe('Idempotency, Retries, and Tenant Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Webhook Idempotency & Deduplication', () => {
    it('creates new WebhookEvent when eventKey has not been seen', async () => {
      (db.webhookEvent.findUnique as any).mockResolvedValue(null);
      (db.webhookEvent.create as any).mockResolvedValue({
        id: 'ev_001',
        eventKey: 'vapi_call_new_01',
        status: WebhookProcessingStatus.PROCESSING,
      });

      const res = await WebhookProcessingService.registerEvent({
        provider: WebhookProvider.VAPI,
        eventKey: 'vapi_call_new_01',
        eventType: 'patient_intake',
      });

      expect(res.isDuplicate).toBe(false);
      expect(db.webhookEvent.create).toHaveBeenCalled();
    });

    it('detects duplicate WebhookEvent when already PROCESSED', async () => {
      (db.webhookEvent.findUnique as any).mockResolvedValue({
        id: 'ev_002',
        eventKey: 'vapi_call_existing_02',
        status: WebhookProcessingStatus.PROCESSED,
      });

      const res = await WebhookProcessingService.registerEvent({
        provider: WebhookProvider.VAPI,
        eventKey: 'vapi_call_existing_02',
        eventType: 'patient_intake',
      });

      expect(res.isDuplicate).toBe(true);
      expect(db.webhookEvent.create).not.toHaveBeenCalled();
    });

    it('increments attempt count if retrying a previously FAILED event', async () => {
      (db.webhookEvent.findUnique as any).mockResolvedValue({
        id: 'ev_003',
        eventKey: 'vapi_call_failed_03',
        status: WebhookProcessingStatus.FAILED,
        attemptCount: 1,
      });
      (db.webhookEvent.update as any).mockResolvedValue({
        id: 'ev_003',
        status: WebhookProcessingStatus.PROCESSING,
        attemptCount: 2,
      });

      const res = await WebhookProcessingService.registerEvent({
        provider: WebhookProvider.VAPI,
        eventKey: 'vapi_call_failed_03',
        eventType: 'patient_intake',
      });

      expect(res.isDuplicate).toBe(false);
      expect(db.webhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            attemptCount: { increment: 1 },
          }),
        })
      );
    });
  });

  describe('Notification Deduplication & Exponential Backoff', () => {
    it('skips creating notification if identical message was queued within 5 minutes', async () => {
      (db.notificationJob.findFirst as any).mockResolvedValue({
        id: 'notif_existing_01',
        recipient: '+33612857915',
        message: 'Alerte répétée',
      });

      const res = await NotificationService.queueNotification({
        businessId: 'biz_01',
        recipient: '+33612857915',
        message: 'Alerte répétée',
      });

      expect(res.id).toBe('notif_existing_01');
      expect(db.notificationJob.create).not.toHaveBeenCalled();
    });

    it('creates new notification if no recent duplicate exists', async () => {
      (db.notificationJob.findFirst as any).mockResolvedValue(null);
      (db.notificationJob.create as any).mockResolvedValue({
        id: 'notif_new_02',
        recipient: '+33612857915',
        message: 'Nouvelle alerte',
        status: NotificationStatus.PENDING,
      });

      const res = await NotificationService.queueNotification({
        businessId: 'biz_01',
        recipient: '+33612857915',
        message: 'Nouvelle alerte',
        sendImmediately: false,
      });

      expect(res.id).toBe('notif_new_02');
      expect(db.notificationJob.create).toHaveBeenCalled();
    });
  });
});
