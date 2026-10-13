import { NextRequest, NextResponse } from 'next/server';
import { JotformIntegration } from '@/lib/integrations/jotform';
import { JotformIntakeService } from '@/lib/services/jotform-intake.service';
import { WebhookProcessingService } from '@/lib/services/webhook-processing.service';
import { WebhookProvider } from '@prisma/client';
import { logger } from '@/lib/logger';

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
      logger.info('Duplicate Jotform submission ignored', {
        module: 'WEBHOOK:Jotform',
        callId,
      });
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
    logger.error('JotForm Webhook Exception', {
      module: 'WEBHOOK:Jotform',
      error: err,
    });
    return NextResponse.json(
      { error: 'Internal server error', message: 'Failed to process submission' },
      { status: 500 }
    );
  }
}
