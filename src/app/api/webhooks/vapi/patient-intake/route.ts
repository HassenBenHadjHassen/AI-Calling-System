import { NextRequest, NextResponse } from 'next/server';
import { VapiServerMessagePayloadSchema } from '@/lib/validation/schemas';
import { PatientIntakeService } from '@/lib/services/patient-intake.service';
import { WebhookProcessingService } from '@/lib/services/webhook-processing.service';
import { WebhookProvider } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = VapiServerMessagePayloadSchema.safeParse(rawBody);

    if (!parsed.success) {
      console.warn('[Vapi Patient Intake] Validation failed:', parsed.error.issues);
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const callId = payload.message.call?.id || `anon_${Date.now()}`;
    const eventKey = `vapi_patient_intake_${callId}`;

    // Webhook deduplication
    const { isDuplicate, event } = await WebhookProcessingService.registerEvent({
      provider: WebhookProvider.VAPI,
      eventKey,
      eventType: 'patient_intake',
      payload,
    });

    if (isDuplicate) {
      console.log(`[Vapi Patient Intake] Duplicate webhook ignored for callId: ${callId}`);
      return NextResponse.json({ success: true, message: 'Event already processed' });
    }

    try {
      const result = await PatientIntakeService.processIntake(payload);
      await WebhookProcessingService.markProcessed(event.id);
      return NextResponse.json({ success: true, result });
    } catch (processError: unknown) {
      const errMsg = processError instanceof Error ? processError.message : String(processError);
      await WebhookProcessingService.markFailed(event.id, errMsg);
      throw processError;
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[Vapi Patient Intake Exception]:', errMsg);
    return NextResponse.json(
      { error: 'Internal server error', message: errMsg },
      { status: 500 }
    );
  }
}
