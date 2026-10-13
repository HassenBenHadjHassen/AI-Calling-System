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

// ==========================================
// NATIVE DEVIS SUBMISSION SCHEMA
// ==========================================

export const DevisSubmissionSchema = z.object({
  callId: z.string().min(1, "La référence d'appel est requise"),
  name: z.string().min(1, 'Le nom est requis'),
  email: z.string().email('Adresse email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().min(1, "L'adresse du chantier est requise"),
  postalCode: z.string().min(2, 'Le code postal est requis'),
  city: z.string().optional(),
  serviceType: z.string().optional(),
  message: z.string().optional(),
});

export type DevisSubmissionPayload = z.infer<typeof DevisSubmissionSchema>;

// ==========================================
// DIRECT PATIENT SUBMISSION SCHEMA (Format A)
// ==========================================

export const DirectPatientSubmissionSchema = z
  .object({
    requestType: z.enum(['appointment', 'cancellation', 'message']),
    patientName: z.string().optional().default(''),
    postalCode: z.string().optional().default(''),
    serviceType: z.string().optional().default(''),
    requestedDate: z.string().optional().default(''),
    requestedTime: z.string().optional().default(''),
    summary: z.string().optional().default(''),
    urgency: z.union([z.boolean(), z.string()]).optional().default(false),
    caller: z.string().default(''),
    callId: z.string().default(''),
  })
  .superRefine((data, ctx) => {
    // 1. Caller validation: Must be non-empty string
    if (!data.caller || !data.caller.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ['caller'],
        message: 'caller phone number is required and cannot be empty',
      });
    }

    // 2. CallId validation: Must be non-empty string
    if (!data.callId || !data.callId.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ['callId'],
        message: 'callId is required and cannot be empty',
      });
    }

    // 3. Conditional validation by requestType
    if (data.requestType === 'appointment') {
      if (!data.patientName || !data.patientName.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ['patientName'],
          message: 'patientName is required for appointment requests',
        });
      }

      if (!data.postalCode || !data.postalCode.trim() || !/^\d{5}$/.test(data.postalCode.trim())) {
        ctx.addIssue({
          code: "custom",
          path: ['postalCode'],
          message: 'A valid 5-digit postal code is required for appointment requests',
        });
      }

      if (!data.serviceType || !data.serviceType.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ['serviceType'],
          message: 'serviceType is required for appointment requests',
        });
      }

      if (!data.requestedDate || !data.requestedDate.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ['requestedDate'],
          message: 'requestedDate is required for appointment requests',
        });
      }

      if (!data.requestedTime || !data.requestedTime.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ['requestedTime'],
          message: 'requestedTime is required for appointment requests',
        });
      }
    }

    if (data.requestType === 'message') {
      if (!data.summary || !data.summary.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ['summary'],
          message: 'summary (message content) is required for message requests',
        });
      }
    }
  });

export type DirectPatientSubmissionPayload = z.infer<typeof DirectPatientSubmissionSchema>;


