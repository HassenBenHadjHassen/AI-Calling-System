import { NextRequest, NextResponse } from 'next/server';
import { VapiToolWebhookPayloadSchema } from '@/lib/validation/schemas';
import { VapiIntegration } from '@/lib/integrations/vapi';
import { CalendarAvailabilityService } from '@/lib/services/calendar-availability.service';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const rawCorrId = req.headers.get('x-correlation-id');

  try {
    const rawBody = await req.json();
    const correlationId = rawCorrId || `tool_cal_${Date.now().toString(36)}`;
    const log = logger.child({
      module: 'WEBHOOK_VAPI:ToolCalendarAvailability',
      correlationId,
    });

    log.info('[Vapi Tool Calendar] Live calendar slot check requested');

    const parsed = VapiToolWebhookPayloadSchema.safeParse(rawBody);

    if (!parsed.success) {
      log.warn('[Vapi Tool Calendar] Validation failed', { issues: parsed.error.issues });
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.issues },
        {
          headers: { 'X-Correlation-Id': correlationId },
          status: 400,
        }
      );
    }

    const payload = parsed.data;
    const toolCalls = VapiIntegration.extractToolCalls(payload);

    if (toolCalls.length === 0) {
      log.warn('[Vapi Tool Calendar] No tool calls found in payload');
      return NextResponse.json(
        { error: 'No tool calls found in payload' },
        {
          headers: { 'X-Correlation-Id': correlationId },
          status: 400,
        }
      );
    }

    const primaryToolCall = toolCalls[0];
    const rawDateTime =
      primaryToolCall.arguments.date_time ||
      primaryToolCall.arguments.dateTime ||
      primaryToolCall.arguments.date ||
      '';

    const assistantId = payload.message.assistant?.id;

    log.info(`[Vapi Tool Calendar] Checking slot ${rawDateTime} (assistant: ${assistantId})`);

    const result = await CalendarAvailabilityService.checkSlot({
      dateTime: String(rawDateTime),
      toolCallId: primaryToolCall.id,
      assistantId,
    });

    log.info('[Vapi Tool Calendar] Slot availability check completed', {
      rawDateTime,
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json(result, {
      headers: { 'X-Correlation-Id': correlationId },
      status: 200,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const correlationId = rawCorrId || `tool_cal_err_${Date.now()}`;
    logger.error('[Vapi Tool Calendar Exception]', {
      module: 'WEBHOOK_VAPI:ToolCalendarAvailability',
      correlationId,
      error: err,
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json(
      {
        results: [
          {
            toolCallId: 'fallback_error',
            result: 'available=False ,Donc Ce créneau est déjà pris ',
          },
        ],
      },
      {
        headers: { 'X-Correlation-Id': correlationId },
        status: 200,
      }
    );
  }
}
