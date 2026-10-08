import { VapiToolWebhookPayload, VapiServerMessagePayload } from '../validation/schemas';

export interface VapiToolResponseResult {
  toolCallId: string;
  result: string;
}

export interface VapiToolResponse {
  results: VapiToolResponseResult[];
}

export const VAPI_STRUCTURED_OUTPUT_IDS = {
  // Cabinet Michelle
  PATIENT_INTAKE: '389d26dd-40e4-4670-9f2b-5acd1c40e6ee',
  SCAM_SCORE: '78937e6c-b9cc-46c2-a1c5-1e36df0fa42f',
  CANCELLATION: '500a4dac-64f0-4d0a-9b0f-8523954132af',
  CALL_OUTCOME: 'e9485024-57be-4f6c-a745-4fef80b809a2',

  // Dani Bâtiment
  DANI_BATIMENT_MOTIF: '2e375095-f01f-40a6-ad7c-4a1ae3caf67a',
} as const;

export class VapiIntegration {
  /**
   * Builds the exact response shape required by Vapi Voice Assistant tool calls.
   */
  static buildToolResponse(toolCallId: string, result: string): VapiToolResponse {
    return {
      results: [
        {
          toolCallId,
          result,
        },
      ],
    };
  }

  /**
   * Normalizes extraction of tool calls from varying Vapi payload versions
   * (supporting message.toolCalls, message.toolCallList, and singular toolCall).
   */
  static extractToolCalls(payload: VapiToolWebhookPayload): Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }> {
    const list =
      payload.message.toolCalls ||
      payload.message.toolCallList ||
      [];

    return list.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: (tc.function.arguments as Record<string, unknown>) || {},
    }));
  }

  /**
   * Extracts caller phone number from Vapi message, checking:
   * 1. tool arguments caller / phone_number
   * 2. message.customer.number
   * 3. _lead_metadata.phone_number
   */
  static extractCallerNumber(
    payload: VapiToolWebhookPayload | VapiServerMessagePayload,
    toolArgs?: Record<string, unknown>
  ): string {
    if (toolArgs?.caller) return String(toolArgs.caller);
    if (toolArgs?.phone_number) return String(toolArgs.phone_number);

    const message = payload.message;
    if (message.customer?.number) return String(message.customer.number);

    if ('_lead_metadata' in payload && payload._lead_metadata?.phone_number) {
      return String(payload._lead_metadata.phone_number);
    }

    return '';
  }

  /**
   * Extracts structured outputs by known UUID keys or fallbacks
   */
  static extractStructuredOutput(
    payload: VapiServerMessagePayload,
    keyOrUuid: string
  ): unknown {
    const outputs = payload.message.artifact?.structuredOutputs;
    if (!outputs) return undefined;

    // Check by exact UUID
    if (outputs[keyOrUuid]?.result !== undefined) {
      return outputs[keyOrUuid].result;
    }

    // Check by name property
    for (const id in outputs) {
      if (outputs[id]?.name === keyOrUuid) {
        return outputs[id].result;
      }
    }

    return undefined;
  }
}
