import { NextRequest, NextResponse } from 'next/server';
import { TwilioInboundSmsSchema } from '@/lib/validation/schemas';
import { twilioClient } from '@/lib/integrations/twilio';
import { AppointmentConfirmationService } from '@/lib/services/appointment-confirmation.service';
import { WebhookProcessingService } from '@/lib/services/webhook-processing.service';
import { WebhookProvider } from '@prisma/client';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const rawCorrId = req.headers.get('x-correlation-id');

  try {
    const contentType = req.headers.get('content-type') || '';
    let bodyData: Record<string, string> = {};

    if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        bodyData[key] = value.toString();
      });
    } else {
      try {
        bodyData = await req.json();
      } catch {
        const formData = await req.formData();
        formData.forEach((value, key) => {
          bodyData[key] = value.toString();
        });
      }
    }

    const correlationId =
      rawCorrId || `twilio_${bodyData.MessageSid || Date.now().toString(36)}`;
    const log = logger.child({ module: 'WEBHOOK_TWILIO', correlationId });

    log.info('[Twilio Inbound SMS] Inbound request received', {
      from: bodyData.From,
      to: bodyData.To,
      messageSid: bodyData.MessageSid,
    });

    const parsed = TwilioInboundSmsSchema.safeParse(bodyData);
    if (!parsed.success) {
      log.warn('[Twilio Inbound SMS] Validation failed:', {
        issues: parsed.error.issues,
        bodyData,
      });
      return new NextResponse(twilioClient.buildEmptyTwimlResponse(), {
        headers: {
          'Content-Type': 'text/xml',
          'X-Correlation-Id': correlationId,
        },
        status: 200,
      });
    }

    const payload = parsed.data;
    const signature = req.headers.get('x-twilio-signature') || '';
    const requestUrl = req.url;

    // Optional signature verification
    const isValidSignature = twilioClient.validateWebhookSignature(
      signature,
      requestUrl,
      bodyData
    );

    if (!isValidSignature) {
      log.warn('[Twilio Inbound SMS] Invalid webhook signature detected', {
        signature,
        requestUrl,
      });
      return new NextResponse('Unauthorized', {
        headers: { 'X-Correlation-Id': correlationId },
        status: 401,
      });
    }

    const eventKey = `twilio_sms_${payload.MessageSid}`;

    // Deduplication check
    const { isDuplicate, event } = await WebhookProcessingService.registerEvent({
      provider: WebhookProvider.TWILIO,
      eventKey,
      eventType: 'inbound_sms',
      correlationId,
      payload: bodyData,
    });

    if (isDuplicate) {
      log.info(`[Twilio Inbound SMS] Duplicate MessageSid ignored: ${payload.MessageSid}`);
      return new NextResponse(twilioClient.buildEmptyTwimlResponse(), {
        headers: {
          'Content-Type': 'text/xml',
          'X-Correlation-Id': correlationId,
        },
        status: 200,
      });
    }

    try {
      await AppointmentConfirmationService.processInboundSms({
        from: payload.From,
        body: payload.Body,
        messageSid: payload.MessageSid,
      });

      await WebhookProcessingService.markProcessed(event.id, correlationId);
      log.info('[Twilio Inbound SMS] Successfully processed incoming SMS', {
        durationMs: Date.now() - startTime,
        from: payload.From,
      });
    } catch (processError: unknown) {
      const errMsg = processError instanceof Error ? processError.message : String(processError);
      await WebhookProcessingService.markFailed(event.id, errMsg, correlationId);
      log.error('[Twilio Inbound SMS Processing Error]', {
        error: processError,
        durationMs: Date.now() - startTime,
      });
    }

    // Always respond with valid TwiML
    return new NextResponse(twilioClient.buildEmptyTwimlResponse(), {
      headers: {
        'Content-Type': 'text/xml',
        'X-Correlation-Id': correlationId,
      },
      status: 200,
    });
  } catch (err: unknown) {
    const correlationId = rawCorrId || `twilio_err_${Date.now().toString(36)}`;
    logger.error('[Twilio Inbound SMS Exception]', {
      module: 'WEBHOOK_TWILIO',
      correlationId,
      error: err,
      durationMs: Date.now() - startTime,
    });
    return new NextResponse(twilioClient.buildEmptyTwimlResponse(), {
      headers: {
        'Content-Type': 'text/xml',
        'X-Correlation-Id': correlationId,
      },
      status: 200,
    });
  }
}
