import { NextRequest, NextResponse } from 'next/server';
import { VapiToolWebhookPayloadSchema } from '@/lib/validation/schemas';
import { VapiIntegration } from '@/lib/integrations/vapi';
import { CallerLookupService } from '@/lib/services/caller-lookup.service';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = VapiToolWebhookPayloadSchema.safeParse(rawBody);

    if (!parsed.success) {
      console.warn('[Vapi Client VIP] Validation failed:', parsed.error.issues);
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const toolCalls = VapiIntegration.extractToolCalls(payload);

    if (toolCalls.length === 0) {
      return NextResponse.json(
        { error: 'No tool calls found in payload' },
        { status: 400 }
      );
    }

    const primaryToolCall = toolCalls[0];
    const callerNumber = VapiIntegration.extractCallerNumber(
      payload,
      primaryToolCall.arguments
    );
    const assistantId = payload.message.assistant?.id || '';

    const result = await CallerLookupService.lookupCaller({
      callerNumber,
      assistantId,
      toolCallId: primaryToolCall.id,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[Vapi Client VIP Exception]:', errMsg);
    return NextResponse.json(
      {
        results: [
          {
            toolCallId: 'fallback_error',
            result: 'Utilisateur est un nouveau client',
          },
        ],
      },
      { status: 200 }
    );
  }
}
