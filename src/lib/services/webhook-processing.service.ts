import { db } from '../db';
import { WebhookProvider, WebhookProcessingStatus } from '@prisma/client';

export interface RegisterWebhookEventParams {
  provider: WebhookProvider;
  eventKey: string;
  eventType: string;
  businessId?: string;
  payload?: unknown;
}

export class WebhookProcessingService {
  /**
   * Registers a webhook event for deduplication.
   * Returns { isDuplicate: true, event } if already processed or processing,
   * or { isDuplicate: false, event } if this is a new event.
   */
  static async registerEvent(params: RegisterWebhookEventParams) {
    // Check if event already exists
    const existing = await db.webhookEvent.findUnique({
      where: { eventKey: params.eventKey },
    });

    if (existing) {
      if (
        existing.status === WebhookProcessingStatus.PROCESSED ||
        existing.status === WebhookProcessingStatus.PROCESSING
      ) {
        return { isDuplicate: true, event: existing };
      }

      // If previously failed, increment attempt count and retry
      const updated = await db.webhookEvent.update({
        where: { id: existing.id },
        data: {
          status: WebhookProcessingStatus.PROCESSING,
          attemptCount: { increment: 1 },
          error: null,
        },
      });

      return { isDuplicate: false, event: updated };
    }

    // Create new event record
    const event = await db.webhookEvent.create({
      data: {
        provider: params.provider,
        eventKey: params.eventKey,
        eventType: params.eventType,
        businessId: params.businessId,
        status: WebhookProcessingStatus.PROCESSING,
        payload: params.payload ? JSON.parse(JSON.stringify(params.payload)) : undefined,
      },
    });

    return { isDuplicate: false, event };
  }

  /**
   * Marks a webhook event as successfully processed.
   */
  static async markProcessed(eventId: string) {
    return db.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: WebhookProcessingStatus.PROCESSED,
        error: null,
      },
    });
  }

  /**
   * Marks a webhook event as failed.
   */
  static async markFailed(eventId: string, errorMessage: string) {
    return db.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: WebhookProcessingStatus.FAILED,
        error: errorMessage,
      },
    });
  }
}
