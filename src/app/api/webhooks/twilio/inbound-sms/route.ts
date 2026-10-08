import { NextRequest, NextResponse } from 'next/server';
import { TwilioInboundSmsSchema } from '@/lib/validation/schemas';
import { twilioClient } from '@/lib/integrations/twilio';
import { AppointmentConfirmationService } from '@/lib/services/appointment-confirmation.service';
import { WebhookProcessingService } from '@/lib/services/webhook-processing.service';
import { WebhookProvider } from '@prisma/client';

export async function POST(req: NextRequest) {
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

    const parsed = TwilioInboundSmsSchema.safeParse(bodyData);
    if (!parsed.success) {
      console.warn('[Twilio Inbound SMS] Validation failed:', parsed.error.issues);
      return new NextResponse(twilioClient.buildEmptyTwimlResponse(), {
        headers: { 'Content-Type': 'text/xml' },
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
      console.warn('[Twilio Inbound SMS] Invalid webhook signature');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const eventKey = `twilio_sms_${payload.MessageSid}`;

    // Deduplication check
    const { isDuplicate, event } = await WebhookProcessingService.registerEvent({
      provider: WebhookProvider.TWILIO,
      eventKey,
      eventType: 'inbound_sms',
      payload: bodyData,
    });

    if (isDuplicate) {
      console.log(`[Twilio Inbound SMS] Duplicate MessageSid ignored: ${payload.MessageSid}`);
      return new NextResponse(twilioClient.buildEmptyTwimlResponse(), {
        headers: { 'Content-Type': 'text/xml' },
        status: 200,
      });
    }

    try {
      await AppointmentConfirmationService.processInboundSms({
        from: payload.From,
        body: payload.Body,
        messageSid: payload.MessageSid,
      });

      await WebhookProcessingService.markProcessed(event.id);
    } catch (processError: unknown) {
      const errMsg = processError instanceof Error ? processError.message : String(processError);
      await WebhookProcessingService.markFailed(event.id, errMsg);
      console.error('[Twilio Inbound SMS Processing Error]:', errMsg);
    }

    // Always respond with valid TwiML
    return new NextResponse(twilioClient.buildEmptyTwimlResponse(), {
      headers: { 'Content-Type': 'text/xml' },
      status: 200,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[Twilio Inbound SMS Exception]:', errMsg);
    return new NextResponse(twilioClient.buildEmptyTwimlResponse(), {
      headers: { 'Content-Type': 'text/xml' },
      status: 200,
    });
  }
}
