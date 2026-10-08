import { z } from 'zod';

// ==========================================
// VAPI SCHEMAS
// ==========================================

export const VapiFunctionCallSchema = z.object({
  name: z.string(),
  arguments: z.record(z.string(), z.any()).default({}),
});

export const VapiToolCallSchema = z.object({
  id: z.string(),
  type: z.string().optional().default('function'),
  function: VapiFunctionCallSchema,
});

export const VapiToolMessageSchema = z.object({
  type: z.string().optional(),
  toolCalls: z.array(VapiToolCallSchema).optional(),
  toolCallList: z.array(VapiToolCallSchema).optional(),
  assistant: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
  customer: z
    .object({
      number: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
  call: z
    .object({
      id: z.string().optional(),
    })
    .optional(),
});

export const VapiToolWebhookPayloadSchema = z.object({
  message: VapiToolMessageSchema,
});

export const VapiStructuredOutputsSchema = z.record(
  z.string(),
  z.object({
    name: z.string().optional(),
    result: z.any().optional(),
  })
);

export const VapiServerMessagePayloadSchema = z.object({
  message: z.object({
    type: z.string().optional(),
    call: z
      .object({
        id: z.string(),
        assistantId: z.string().optional(),
        status: z.string().optional(),
        startedAt: z.string().optional(),
        endedAt: z.string().optional(),
      })
      .optional(),
    customer: z
      .object({
        number: z.string().optional(),
        name: z.string().optional(),
      })
      .optional(),
    assistant: z
      .object({
        id: z.string().optional(),
      })
      .optional(),
    artifact: z
      .object({
        structuredOutputs: VapiStructuredOutputsSchema.optional(),
        summary: z.string().optional(),
        transcript: z.string().optional(),
      })
      .optional(),
  }),
  _lead_metadata: z
    .object({
      phone_number: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
});

// ==========================================
// TWILIO SCHEMAS
// ==========================================

export const TwilioInboundSmsSchema = z.object({
  From: z.string(),
  To: z.string().optional(),
  Body: z.string().default(''),
  MessageSid: z.string(),
  AccountSid: z.string().optional(),
});

// ==========================================
// JOTFORM SCHEMAS
// ==========================================

export const JotformAddressSchema = z
  .object({
    addr_line1: z.string().optional().default(''),
    addr_line2: z.string().optional().default(''),
    city: z.string().optional().default(''),
    state: z.string().optional().default(''),
    postal: z.string().optional().default(''),
  })
  .partial();

export const JotformSubmissionSchema = z.object({
  q14_callId: z.string().optional(),
  q17_nomDe: z.string().optional(),
  q3_email: z.string().optional(),
  q4_adresse: JotformAddressSchema.optional(),
  submissionID: z.string().optional(),
  formID: z.string().optional(),
});

export type VapiToolWebhookPayload = z.infer<typeof VapiToolWebhookPayloadSchema>;
export type VapiServerMessagePayload = z.infer<typeof VapiServerMessagePayloadSchema>;
export type TwilioInboundSmsPayload = z.infer<typeof TwilioInboundSmsSchema>;
export type JotformSubmissionPayload = z.infer<typeof JotformSubmissionSchema>;
