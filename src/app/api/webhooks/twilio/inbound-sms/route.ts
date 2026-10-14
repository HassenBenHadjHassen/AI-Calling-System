import { NextRequest, NextResponse } from 'next/server';
import { TwilioInboundSmsSchema } from '@/lib/validation/schemas';
import { twilioClient } from '@/lib/integrations/twilio';
import { AppointmentConfirmationService } from '@/lib/services/appointment-confirmation.service';
import { WebhookProcessingService } from '@/lib/services/webhook-processing.service';
import { WebhookProvider } from '@prisma/client';
import { logger } from '@/lib/logger';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/webhooks/twilio/inbound-sms',
    unprotected: true,
    message: 'Twilio Inbound SMS Webhook is active and unprotected.',
  });
}

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

    // Normalize keys from manual testing or casing differences
    if (!bodyData.From && bodyData.from) bodyData.From = bodyData.from;
    if (!bodyData.Body && bodyData.body) bodyData.Body = bodyData.body;
    if (!bodyData.MessageSid && (bodyData.messageSid || bodyData.messagesid)) {
      bodyData.MessageSid = bodyData.messageSid || bodyData.messagesid;
    }
    if (!bodyData.MessageSid) {
      bodyData.MessageSid = `SM_unprotected_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }

    const correlationId =
      rawCorrId || `twilio_${bodyData.MessageSid || Date.now().toString(36)}`;
    const log = logger.child({ module: 'WEBHOOK_TWILIO', correlationId });

    log.info('[Twilio Inbound SMS] Inbound request received (unprotected endpoint)', {
      messageSid: bodyData.MessageSid,
      from: bodyData.From,
    });

    const parsed = TwilioInboundSmsSchema.safeParse(bodyData);
    if (!parsed.success) {
      log.warn('[Twilio Inbound SMS] Validation failed:', {
        issues: parsed.error.issues,
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

    // Webhook protection disabled: signature verification bypassed
    const signature = req.headers.get('x-twilio-signature');
    if (signature) {
      log.info('[Twilio Inbound SMS] Twilio signature present (verification bypassed - unprotected)', {
        signatureLength: signature.length,
      });
    } else {
      log.info('[Twilio Inbound SMS] Request received without signature (unprotected mode)');
    }

    const eventKey = `twilio_sms_${payload.MessageSid}`;

    // Deduplication check
    const { isDuplicate, event } = await WebhookProcessingService.registerEvent({
      provider: WebhookProvider.TWILIO,
      eventKey,
      eventType: 'inbound_sms',
      correlationId,
      payload: { messageSid: payload.MessageSid },
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
        messageSid: payload.MessageSid,
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
