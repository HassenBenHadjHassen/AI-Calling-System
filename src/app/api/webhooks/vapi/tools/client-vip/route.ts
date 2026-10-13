import { NextRequest, NextResponse } from 'next/server';
import { VapiToolWebhookPayloadSchema } from '@/lib/validation/schemas';
import { VapiIntegration } from '@/lib/integrations/vapi';
import { CallerLookupService } from '@/lib/services/caller-lookup.service';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const rawCorrId = req.headers.get('x-correlation-id');

  try {
    const rawBody = await req.json();
    const correlationId = rawCorrId || `tool_vip_${Date.now().toString(36)}`;
    const log = logger.child({
      module: 'WEBHOOK_VAPI:ToolClientVIP',
      correlationId,
    });

    log.info('[Vapi Tool VIP] Live caller lookup requested');

    const parsed = VapiToolWebhookPayloadSchema.safeParse(rawBody);

    if (!parsed.success) {
      log.warn('[Vapi Tool VIP] Validation failed', { issues: parsed.error.issues });
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
      log.warn('[Vapi Tool VIP] No tool calls found in payload');
      return NextResponse.json(
        { error: 'No tool calls found in payload' },
        {
          headers: { 'X-Correlation-Id': correlationId },
          status: 400,
        }
      );
    }

    const primaryToolCall = toolCalls[0];
    const callerNumber = VapiIntegration.extractCallerNumber(
      payload,
      primaryToolCall.arguments
    );
    const assistantId = payload.message.assistant?.id || '';

    log.info(`[Vapi Tool VIP] Checking caller ${callerNumber} (assistant: ${assistantId})`);

    const result = await CallerLookupService.lookupCaller({
      callerNumber,
      assistantId,
      toolCallId: primaryToolCall.id,
    });

    log.info('[Vapi Tool VIP] Lookup completed', {
      callerNumber,
      lookupResult: result.results[0]?.result,
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json(result, {
      headers: { 'X-Correlation-Id': correlationId },
      status: 200,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const correlationId = rawCorrId || `tool_vip_err_${Date.now()}`;
    logger.error('[Vapi Tool VIP Exception]', {
      module: 'WEBHOOK_VAPI:ToolClientVIP',
      correlationId,
      error: err,
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json(
      {
        results: [
          {
            toolCallId: 'fallback_error',
            result: 'Utilisateur est un nouveau client',
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
