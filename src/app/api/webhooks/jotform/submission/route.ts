import { NextRequest, NextResponse } from 'next/server';
import { JotformIntegration } from '@/lib/integrations/jotform';
import { JotformIntakeService } from '@/lib/services/jotform-intake.service';
import { WebhookProcessingService } from '@/lib/services/webhook-processing.service';
import { WebhookProvider } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    const rawBody: Record<string, unknown> = {};

    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        rawBody[key] = value.toString();
      });
    } else {
      Object.assign(rawBody, await req.json());
    }

    const payload = JotformIntegration.parseSubmission(rawBody);
    const callId = payload.q14_callId || 'unknown';
    const submissionId = payload.submissionID || callId;
    const eventKey = `jotform_submission_${submissionId}_${callId}`;

    // Deduplication check
    const { isDuplicate, event } = await WebhookProcessingService.registerEvent({
      provider: WebhookProvider.JOTFORM,
      eventKey,
      eventType: 'form_submission',
      payload: rawBody,
    });

    if (isDuplicate) {
      console.log(`[JotForm Webhook] Duplicate submission ignored for callId: ${callId}`);
      return NextResponse.json({ success: true, message: 'Submission already processed' });
    }

    try {
      const result = await JotformIntakeService.processSubmission(payload);
      await WebhookProcessingService.markProcessed(event.id);
      return NextResponse.json({ success: true, result });
    } catch (processError: unknown) {
      const errMsg = processError instanceof Error ? processError.message : String(processError);
      await WebhookProcessingService.markFailed(event.id, errMsg);
      throw processError;
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[JotForm Webhook Exception]:', errMsg);
    return NextResponse.json(
      { error: 'Internal server error', message: errMsg },
      { status: 500 }
    );
  }
}
