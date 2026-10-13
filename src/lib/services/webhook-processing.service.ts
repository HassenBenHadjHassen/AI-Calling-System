import { db } from '../db';
import { WebhookProvider, WebhookProcessingStatus } from '@prisma/client';
import { logger } from '../logger';

export interface RegisterWebhookEventParams {
  provider: WebhookProvider;
  eventKey: string;
  eventType: string;
  businessId?: string;
  correlationId?: string;
  payload?: unknown;
}

export class WebhookProcessingService {
  /**
   * Registers a webhook event for deduplication and audit logging.
   * Returns { isDuplicate: true, event } if already processed or processing,
   * or { isDuplicate: false, event } if this is a new event.
   */
  static async registerEvent(params: RegisterWebhookEventParams) {
    const correlationId = params.correlationId || params.eventKey;
    const log = logger.child({
      module: `WEBHOOK_${params.provider}`,
      correlationId,
      businessId: params.businessId,
    });

    log.info(`[Webhook Inbound] Received ${params.provider} event: ${params.eventType}`, {
      eventKey: params.eventKey,
      eventType: params.eventType,
    });

    // Check if event already exists
    const existing = await db.webhookEvent.findUnique({
      where: { eventKey: params.eventKey },
    });

    if (existing) {
      if (
        existing.status === WebhookProcessingStatus.PROCESSED ||
        existing.status === WebhookProcessingStatus.PROCESSING
      ) {
        log.warn(`[Webhook Deduplication] Skipping duplicate webhook event: ${params.eventKey}`, {
          status: existing.status,
          attemptCount: existing.attemptCount,
        });
        return { isDuplicate: true, event: existing };
      }

      // If previously failed, increment attempt count and retry
      log.info(`[Webhook Retry] Retrying previously failed event: ${params.eventKey} (Attempt #${existing.attemptCount + 1})`);
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

    log.info(`[Webhook Registered] Event registered with status PROCESSING (ID: ${event.id})`);

    return { isDuplicate: false, event };
  }

  /**
   * Marks a webhook event as successfully processed.
   */
  static async markProcessed(eventId: string, correlationId?: string) {
    const event = await db.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: WebhookProcessingStatus.PROCESSED,
        error: null,
      },
    });

    const eventKey = event?.eventKey || eventId;
    const provider = event?.provider || 'EVENT';

    logger.info(`[Webhook Completed] Successfully processed event: ${eventKey}`, {
      module: `WEBHOOK_${provider}`,
      correlationId: correlationId || eventKey,
      businessId: event?.businessId || undefined,
      eventId: event?.id || eventId,
    });

    return event;
  }

  /**
   * Marks a webhook event as failed.
   */
  static async markFailed(eventId: string, errorMessage: string, correlationId?: string) {
    const event = await db.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: WebhookProcessingStatus.FAILED,
        error: errorMessage,
      },
    });

    const eventKey = event?.eventKey || eventId;
    const provider = event?.provider || 'EVENT';

    logger.error(`[Webhook Failed] Event ${eventKey} marked FAILED: ${errorMessage}`, {
      module: `WEBHOOK_${provider}`,
      correlationId: correlationId || eventKey,
      businessId: event?.businessId || undefined,
      eventId: event?.id || eventId,
      error: errorMessage,
    });

    return event;
  }
}
