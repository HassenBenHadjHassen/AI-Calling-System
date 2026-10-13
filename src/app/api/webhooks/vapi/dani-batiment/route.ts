import { NextRequest, NextResponse } from 'next/server';
import { VapiServerMessagePayloadSchema } from '@/lib/validation/schemas';
import { ServiceRequestsService } from '@/lib/services/service-requests.service';
import { WebhookProcessingService } from '@/lib/services/webhook-processing.service';
import { WebhookProvider } from '@prisma/client';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const rawCorrId = req.headers.get('x-correlation-id');

  try {
    const rawBody = await req.json();
    const callId = rawBody?.message?.call?.id || `anon_${Date.now()}`;
    const correlationId = rawCorrId || `vapi_${callId}`;

    const log = logger.child({
      module: 'WEBHOOK_VAPI:DaniBatiment',
      correlationId,
    });

    log.info('[Vapi Dani Batiment] Webhook received', {
      callId,
      type: rawBody?.message?.type,
    });

    const parsed = VapiServerMessagePayloadSchema.safeParse(rawBody);

    if (!parsed.success) {
      log.warn('[Vapi Dani Batiment] Validation failed', {
        issues: parsed.error.issues,
      });
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.issues },
        {
          headers: { 'X-Correlation-Id': correlationId },
          status: 400,
        }
      );
    }

    const payload = parsed.data;
    const eventKey = `vapi_dani_batiment_${callId}`;

    // Deduplication
    const { isDuplicate, event } = await WebhookProcessingService.registerEvent({
      provider: WebhookProvider.VAPI,
      eventKey,
      eventType: 'dani_batiment_intake',
      correlationId,
      payload,
    });

    if (isDuplicate) {
      log.info(`[Vapi Dani Batiment] Duplicate webhook ignored for callId: ${callId}`);
      return NextResponse.json(
        { success: true, message: 'Event already processed' },
        { headers: { 'X-Correlation-Id': correlationId } }
      );
    }

    try {
      const result = await ServiceRequestsService.processDaniBatimentCall(payload);
      await WebhookProcessingService.markProcessed(event.id, correlationId);

      log.info('[Vapi Dani Batiment] Call successfully processed into ServiceRequest', {
        callId,
        outcome: result.outcome,
        serviceRequestId: result.serviceRequestId,
        durationMs: Date.now() - startTime,
      });

      return NextResponse.json(
        { success: true, result },
        { headers: { 'X-Correlation-Id': correlationId } }
      );
    } catch (processError: unknown) {
      const errMsg = processError instanceof Error ? processError.message : String(processError);
      await WebhookProcessingService.markFailed(event.id, errMsg, correlationId);
      log.error('[Vapi Dani Batiment Processing Error]', {
        error: processError,
        durationMs: Date.now() - startTime,
      });
      throw processError;
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const correlationId = rawCorrId || `vapi_err_${Date.now()}`;
    logger.error('[Vapi Dani Batiment Exception]', {
      module: 'WEBHOOK_VAPI:DaniBatiment',
      correlationId,
      error: err,
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json(
      { error: 'Internal server error', message: errMsg },
      {
        headers: { 'X-Correlation-Id': correlationId },
        status: 500,
      }
    );
  }
}
