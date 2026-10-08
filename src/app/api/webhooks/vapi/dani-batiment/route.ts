import { NextRequest, NextResponse } from 'next/server';
import { VapiServerMessagePayloadSchema } from '@/lib/validation/schemas';
import { ServiceRequestsService } from '@/lib/services/service-requests.service';
import { WebhookProcessingService } from '@/lib/services/webhook-processing.service';
import { WebhookProvider } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = VapiServerMessagePayloadSchema.safeParse(rawBody);

    if (!parsed.success) {
      console.warn('[Vapi Dani Batiment] Validation failed:', parsed.error.issues);
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const callId = payload.message.call?.id || `anon_${Date.now()}`;
    const eventKey = `vapi_dani_batiment_${callId}`;

    // Deduplication
    const { isDuplicate, event } = await WebhookProcessingService.registerEvent({
      provider: WebhookProvider.VAPI,
      eventKey,
      eventType: 'dani_batiment_intake',
      payload,
    });

    if (isDuplicate) {
      console.log(`[Vapi Dani Batiment] Duplicate webhook ignored for callId: ${callId}`);
      return NextResponse.json({ success: true, message: 'Event already processed' });
    }

    try {
      const result = await ServiceRequestsService.processDaniBatimentCall(payload);
      await WebhookProcessingService.markProcessed(event.id);
      return NextResponse.json({ success: true, result });
    } catch (processError: unknown) {
      const errMsg = processError instanceof Error ? processError.message : String(processError);
      await WebhookProcessingService.markFailed(event.id, errMsg);
      throw processError;
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[Vapi Dani Batiment Exception]:', errMsg);
    return NextResponse.json(
      { error: 'Internal server error', message: errMsg },
      { status: 500 }
    );
  }
}
