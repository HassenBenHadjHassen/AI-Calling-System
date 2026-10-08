import { NextRequest, NextResponse } from 'next/server';
import { VapiToolWebhookPayloadSchema } from '@/lib/validation/schemas';
import { VapiIntegration } from '@/lib/integrations/vapi';
import { CalendarAvailabilityService } from '@/lib/services/calendar-availability.service';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = VapiToolWebhookPayloadSchema.safeParse(rawBody);

    if (!parsed.success) {
      console.warn('[Vapi Calendar Availability] Validation failed:', parsed.error.issues);
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
    const rawDateTime =
      primaryToolCall.arguments.date_time ||
      primaryToolCall.arguments.dateTime ||
      primaryToolCall.arguments.date ||
      '';

    const assistantId = payload.message.assistant?.id;

    const result = await CalendarAvailabilityService.checkSlot({
      dateTime: String(rawDateTime),
      toolCallId: primaryToolCall.id,
      assistantId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[Vapi Calendar Availability Exception]:', errMsg);
    return NextResponse.json(
      {
        results: [
          {
            toolCallId: 'fallback_error',
            result: 'available=False ,Donc Ce créneau est déjà pris ',
          },
        ],
      },
      { status: 200 }
    );
  }
}
