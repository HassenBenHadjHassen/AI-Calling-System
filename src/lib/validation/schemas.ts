import { z } from 'zod';
import { DateTime } from 'luxon';

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

export const FRENCH_POSTAL_CODE_REGEX = /^(?:0[1-9]|[1-8]\d|9[0-8])\d{3}$/;

export function isValidFrenchPostalCode(code: string): boolean {
  return FRENCH_POSTAL_CODE_REGEX.test(code.trim());
}

export function isValidCalendarDate(dateStr: string): boolean {
  const trimmed = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return false;
  }
  const [yearStr, monthStr, dayStr] = trimmed.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const dt = DateTime.fromObject({ year, month, day }, { zone: 'Europe/Paris' });
  return dt.isValid && dt.year === year && dt.month === month && dt.day === day;
}

export function isValidTimeFormat(timeStr: string): boolean {
  const trimmed = timeStr.trim().toLowerCase().replace(/h/g, ':');
  const parts = trimmed.split(':');
  if (parts.length > 2) return false;
  const hour = parseInt(parts[0], 10);
  const minute = parts[1] !== undefined && parts[1] !== '' ? parseInt(parts[1], 10) : 0;
  return !isNaN(hour) && hour >= 0 && hour <= 23 && !isNaN(minute) && minute >= 0 && minute <= 59;
}

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
      if (!data.patientName || !data.patientName.trim() || data.patientName.trim().toLowerCase() === 'inconnu') {
        ctx.addIssue({
          code: "custom",
          path: ['patientName'],
          message: 'patientName is required for appointment requests and cannot be empty or "Inconnu"',
        });
      }

      if (!data.postalCode || !isValidFrenchPostalCode(data.postalCode)) {
        ctx.addIssue({
          code: "custom",
          path: ['postalCode'],
          message: 'A valid 5-digit French postal code is required for appointment requests',
        });
      }

      if (!data.serviceType || !data.serviceType.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ['serviceType'],
          message: 'serviceType is required for appointment requests',
        });
      }

      if (!data.requestedDate || !isValidCalendarDate(data.requestedDate)) {
        ctx.addIssue({
          code: "custom",
          path: ['requestedDate'],
          message: 'requestedDate must be a valid calendar date in YYYY-MM-DD format',
        });
      }

      if (!data.requestedTime || !isValidTimeFormat(data.requestedTime)) {
        ctx.addIssue({
          code: "custom",
          path: ['requestedTime'],
          message: 'requestedTime must be a valid time (e.g. 14:30 or 09:00)',
        });
      }
    }

    if (data.requestType === 'cancellation') {
      if (!data.patientName || !data.patientName.trim() || data.patientName.trim().toLowerCase() === 'inconnu') {
        ctx.addIssue({
          code: "custom",
          path: ['patientName'],
          message: 'patientName is required for cancellation requests and cannot be empty or "Inconnu"',
        });
      }

      if (!data.postalCode || !isValidFrenchPostalCode(data.postalCode)) {
        ctx.addIssue({
          code: "custom",
          path: ['postalCode'],
          message: 'A valid 5-digit French postal code is required for cancellation requests',
        });
      }

      if (data.requestedDate && data.requestedDate.trim() && !isValidCalendarDate(data.requestedDate)) {
        ctx.addIssue({
          code: "custom",
          path: ['requestedDate'],
          message: 'requestedDate must be a valid calendar date in YYYY-MM-DD format',
        });
      }

      if (data.requestedTime && data.requestedTime.trim() && !isValidTimeFormat(data.requestedTime)) {
        ctx.addIssue({
          code: "custom",
          path: ['requestedTime'],
          message: 'requestedTime must be a valid time (e.g. 14:30 or 09:00)',
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

      if (data.patientName && !data.patientName.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ['patientName'],
          message: 'patientName cannot be whitespace-only',
        });
      }
    }
  });

export type DirectPatientSubmissionPayload = z.infer<typeof DirectPatientSubmissionSchema>;
export type DirectPatientSubmissionInput = z.input<typeof DirectPatientSubmissionSchema>;

// ==========================================
// CALL ROUTING SCHEMAS
// ==========================================

export const VapiInboundRoutingPayloadSchema = z.object({
  message: z.object({
    type: z.string(),
    call: z
      .object({
        id: z.string().optional(),
        status: z.string().optional(),
        phoneNumber: z
          .object({
            id: z.string().optional(),
            number: z.string().optional(),
          })
          .optional(),
        customer: z
          .object({
            number: z.string().optional(),
            name: z.string().optional(),
          })
          .optional(),
        assistantId: z.string().optional(),
      })
      .optional(),
    phoneNumber: z
      .object({
        id: z.string().optional(),
        number: z.string().optional(),
      })
      .optional(),
    customer: z
      .object({
        number: z.string().optional(),
        name: z.string().optional(),
      })
      .optional(),
    timestamp: z.number().optional(),
  }),
});

export type VapiInboundRoutingPayload = z.infer<typeof VapiInboundRoutingPayloadSchema>;

export const RoutingSettingsUpdateSchema = z.object({
  routingEnabled: z.boolean().optional(),
  priorityTransferNumber: z.string().nullable().optional(),
});
export type RoutingSettingsUpdateInput = z.infer<typeof RoutingSettingsUpdateSchema>;

export const CreateRoutingRuleSchema = z.object({
  phoneNumber: z.string().min(1, 'Numéro de téléphone requis'),
  action: z.enum(['DIRECT', 'BLOCK']),
  label: z.string().max(255).optional(),
  active: z.boolean().optional().default(true),
});
export type CreateRoutingRuleInput = z.infer<typeof CreateRoutingRuleSchema>;

export const UpdateRoutingRuleSchema = z.object({
  phoneNumber: z.string().min(1).optional(),
  action: z.enum(['DIRECT', 'BLOCK']).optional(),
  label: z.string().max(255).optional(),
  active: z.boolean().optional(),
});
export type UpdateRoutingRuleInput = z.infer<typeof UpdateRoutingRuleSchema>;



