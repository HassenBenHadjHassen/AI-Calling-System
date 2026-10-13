import { NextRequest, NextResponse } from 'next/server';
import { VapiToolWebhookPayloadSchema } from '@/lib/validation/schemas';
import { VapiIntegration } from '@/lib/integrations/vapi';
import { CallerLookupService } from '@/lib/services/caller-lookup.service';
import { verifyVapiSecret } from '@/lib/auth/vapi-auth';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const rawCorrId = req.headers.get('x-correlation-id');

  // Verify Vapi credentials before any processing
  const auth = verifyVapiSecret(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    const maskedCaller = callerNumber
      ? callerNumber.replace(/(\+\d{2})(\d{1,2})\d+(\d{2})/, '$1$2****$3')
      : 'unknown';

    log.info(`[Vapi Tool VIP] Checking caller ${maskedCaller} (assistant: ${assistantId})`);

    const result = await CallerLookupService.lookupCaller({
      callerNumber,
      assistantId,
      toolCallId: primaryToolCall.id,
    });

    log.info('[Vapi Tool VIP] Lookup completed', {
      caller: maskedCaller,
      hasMatch: !('error' in (result.results[0] || {})),
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json(result, {
      headers: { 'X-Correlation-Id': correlationId },
      status: 200,
    });
  } catch (err: unknown) {
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
            result:
              'Erreur technique lors de la vérification du profil client. Impossible de déterminer le statut du client.',
            error: 'LOOKUP_FAILED',
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
