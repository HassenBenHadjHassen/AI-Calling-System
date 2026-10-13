import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DirectPatientSubmissionSchema,
  isValidFrenchPostalCode,
  isValidCalendarDate,
  isValidTimeFormat,
} from '@/lib/validation/schemas';
import { sanitizeLogString, sanitizeLogData, serializeError } from '@/lib/logger';
import { NotificationService } from '@/lib/services/notifications.service';
import { InternalCalendarService } from '@/lib/services/internal-calendar.service';
import { CalendarAvailabilityService } from '@/lib/services/calendar-availability.service';
import { CallerLookupService } from '@/lib/services/caller-lookup.service';
import { isMateriallyIdenticalRequest } from '@/lib/services/patient-intake.service';
import { db } from '@/lib/db';
import { NotificationStatus } from '@prisma/client';

describe('Production Hardening Regression Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. CONDITIONAL SCHEMA VALIDATION (Cancellations, Appointments, Messages)
  // =========================================================================
  describe('Conditional Schema Validation (schemas.ts)', () => {
    it('validates French postal codes strictly', () => {
      expect(isValidFrenchPostalCode('75008')).toBe(true);
      expect(isValidFrenchPostalCode('13001')).toBe(true);
      expect(isValidFrenchPostalCode('06000')).toBe(true);
      expect(isValidFrenchPostalCode('20000')).toBe(true);
      expect(isValidFrenchPostalCode('97400')).toBe(true);

      // Invalid postal codes
      expect(isValidFrenchPostalCode('1234')).toBe(false);
      expect(isValidFrenchPostalCode('750000')).toBe(false);
      expect(isValidFrenchPostalCode('ABCDE')).toBe(false);
      expect(isValidFrenchPostalCode('00123')).toBe(false);
      expect(isValidFrenchPostalCode('99123')).toBe(false); // Department 99 does not exist
      expect(isValidFrenchPostalCode('')).toBe(false);
    });

    it('validates calendar dates strictly including impossible dates', () => {
      expect(isValidCalendarDate('2026-11-18')).toBe(true);
      expect(isValidCalendarDate('2026-02-28')).toBe(true);

      // Impossible calendar dates
      expect(isValidCalendarDate('2026-02-31')).toBe(false);
      expect(isValidCalendarDate('2026-04-31')).toBe(false); // April has 30 days
      expect(isValidCalendarDate('2026-13-10')).toBe(false); // Month 13
      expect(isValidCalendarDate('2026-00-10')).toBe(false);
      expect(isValidCalendarDate('invalid-date')).toBe(false);
      expect(isValidCalendarDate('')).toBe(false);
    });

    it('validates time formats strictly', () => {
      expect(isValidTimeFormat('10:00')).toBe(true);
      expect(isValidTimeFormat('14:30')).toBe(true);
      expect(isValidTimeFormat('14h30')).toBe(true);
      expect(isValidTimeFormat('14h')).toBe(true);
      expect(isValidTimeFormat('09:00')).toBe(true);

      // Invalid times
      expect(isValidTimeFormat('25:00')).toBe(false);
      expect(isValidTimeFormat('14:75')).toBe(false);
      expect(isValidTimeFormat('-1:00')).toBe(false);
      expect(isValidTimeFormat('invalid')).toBe(false);
      expect(isValidTimeFormat('')).toBe(false);
    });

    it('enforces required fields for cancellation requests and rejects missing/invalid details', () => {
      // 1. Valid cancellation
      const validCancel = {
        requestType: 'cancellation',
        patientName: 'Jean Dupont',
        postalCode: '75008',
        caller: '+33612345678',
        callId: 'call_cancel_val_01',
      };
      const parsedValid = DirectPatientSubmissionSchema.safeParse(validCancel);
      expect(parsedValid.success).toBe(true);

      // 2. Cancellation missing patientName
      const missingName = {
        ...validCancel,
        patientName: '',
      };
      const parsedMissingName = DirectPatientSubmissionSchema.safeParse(missingName);
      expect(parsedMissingName.success).toBe(false);
      expect(parsedMissingName.error?.issues.some((i) => i.path.includes('patientName'))).toBe(true);

      // 3. Cancellation with "Inconnu" as patientName
      const inconnuName = {
        ...validCancel,
        patientName: 'Inconnu',
      };
      const parsedInconnu = DirectPatientSubmissionSchema.safeParse(inconnuName);
      expect(parsedInconnu.success).toBe(false);
      expect(parsedInconnu.error?.issues.some((i) => i.path.includes('patientName'))).toBe(true);

      // 4. Cancellation missing postalCode
      const missingPostal = {
        ...validCancel,
        postalCode: '',
      };
      const parsedMissingPostal = DirectPatientSubmissionSchema.safeParse(missingPostal);
      expect(parsedMissingPostal.success).toBe(false);
      expect(parsedMissingPostal.error?.issues.some((i) => i.path.includes('postalCode'))).toBe(true);

      // 5. Cancellation with malformed postalCode
      const malformedPostal = {
        ...validCancel,
        postalCode: '1234',
      };
      const parsedMalformedPostal = DirectPatientSubmissionSchema.safeParse(malformedPostal);
      expect(parsedMalformedPostal.success).toBe(false);
    });

    it('enforces required fields for appointment requests', () => {
      const validAppt = {
        requestType: 'appointment',
        patientName: 'Claire Martin',
        postalCode: '13001',
        serviceType: 'Pansement',
        requestedDate: '2026-11-18',
        requestedTime: '10:00',
        caller: '+33612345678',
        callId: 'call_appt_val_01',
      };
      expect(DirectPatientSubmissionSchema.safeParse(validAppt).success).toBe(true);

      // Missing serviceType
      expect(
        DirectPatientSubmissionSchema.safeParse({ ...validAppt, serviceType: '' }).success
      ).toBe(false);

      // Impossible date
      expect(
        DirectPatientSubmissionSchema.safeParse({ ...validAppt, requestedDate: '2026-02-31' }).success
      ).toBe(false);

      // Invalid time
      expect(
        DirectPatientSubmissionSchema.safeParse({ ...validAppt, requestedTime: '24:30' }).success
      ).toBe(false);
    });

    it('enforces required fields for message requests', () => {
      const validMsg = {
        requestType: 'message',
        summary: 'Patient rappelle pour des renseignements',
        caller: '+33612345678',
        callId: 'call_msg_val_01',
      };
      expect(DirectPatientSubmissionSchema.safeParse(validMsg).success).toBe(true);

      // Missing summary
      expect(
        DirectPatientSubmissionSchema.safeParse({ ...validMsg, summary: '' }).success
      ).toBe(false);
    });
  });

  // =========================================================================
  // 2. VIP LOOKUP ERROR VS GENUINE NO-MATCH (caller-lookup.service.ts)
  // =========================================================================
  describe('VIP Lookup Error Handling (caller-lookup.service.ts)', () => {
    it('returns a technical error result when a database failure occurs, never converting to new customer', async () => {
      // Mock db failure
      const mockFindUnique = vi.spyOn(db.assistantConfig, 'findUnique').mockRejectedValueOnce(
        new Error('PostgreSQL Connection Pool Timeout')
      );

      const result = await CallerLookupService.lookupCaller({
        callerNumber: '+33612857915',
        assistantId: '97808c43-384a-4f40-a8dd-9149ba4988f5',
        toolCallId: 'tool_call_err_test',
      });

      mockFindUnique.mockRestore();

      expect(result.results).toHaveLength(1);
      const res = result.results[0] as any;
      expect(res.error).toBe('DATABASE_ERROR');
      expect(res.result).toContain('Erreur technique');
      expect(res.result).not.toContain('nouveau client');
    });

    it('fails closed when an assistantId is completely unrecognized', async () => {
      const result = await CallerLookupService.lookupCaller({
        callerNumber: '+33612857915',
        assistantId: 'unknown_unconfigured_assistant_id_123',
        toolCallId: 'tool_call_unknown_test',
      });

      expect(result.results).toHaveLength(1);
      const res = result.results[0] as any;
      expect(res.error).toBe('UNKNOWN_ASSISTANT');
      expect(res.result).toContain('Erreur technique');
      expect(res.result).not.toContain('nouveau client');
    });
  });

  // =========================================================================
  // 3. CALENDAR TENANT RESOLUTION FAILS CLOSED (internal-calendar.service.ts)
  // =========================================================================
  describe('Calendar Tenant Fail-Closed Behavior (internal-calendar.service.ts)', () => {
    it('fails closed when business tenant is unresolvable or missing in checkAvailability', async () => {
      const start = new Date('2026-11-18T10:00:00.000Z');
      const end = new Date('2026-11-18T11:00:00.000Z');

      // 1. Missing calendarId / business slug
      const missingRes = await InternalCalendarService.checkAvailability(start, end, '', false);
      expect(missingRes.isAvailable).toBe(false);
      expect(missingRes.reason).toBe('verification_failed');

      // 2. Arbitrary non-existent business slug
      const unknownRes = await InternalCalendarService.checkAvailability(
        start,
        end,
        'non_existent_random_clinic_slug_9999',
        false
      );
      expect(unknownRes.isAvailable).toBe(false);
      expect(unknownRes.reason).toBe('verification_failed');
      expect(unknownRes.error).toContain('Tenant business could not be resolved');
    });

    it('fails closed in CalendarAvailabilityService.checkSlot when assistantId is unknown', async () => {
      const res = await CalendarAvailabilityService.checkSlot({
        dateTime: '2026-11-18 10:00',
        toolCallId: 'tool_unknown_slot_01',
        assistantId: 'completely_unknown_assistant_uuid',
      });

      expect(res.results).toHaveLength(1);
      expect(res.results[0].result).toContain('available=False');
      expect(res.results[0].result).toContain('assistant non configuré');
      expect(res.results[0].result).not.toContain('available=True');
    });
  });

  // =========================================================================
  // 4. PII & SENSITIVE DATA REDACTION ACROSS ALL SINKS (logger.ts)
  // =========================================================================
  describe('PII & Sensitive Data Redaction (logger.ts)', () => {
    it('redacts tokens, passwords, cookies, phones, postal codes, and emails in free-text strings', () => {
      const rawText =
        'Caller +33612345678 from postal code 75008 called with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ID and cookie: session=abc12345, password="SecretPassword123" at email: user@example.com';

      const sanitized = sanitizeLogString(rawText);

      expect(sanitized).not.toContain('+33612345678');
      expect(sanitized).not.toContain('75008');
      expect(sanitized).not.toContain('SecretPassword123');
      expect(sanitized).not.toContain('session=abc12345');
      expect(sanitized).not.toContain('user@example.com');
      expect(sanitized).toContain('+336****78');
      expect(sanitized).toContain('[REDACTED_POSTAL_CODE]');
      expect(sanitized).toContain('[REDACTED_CREDENTIAL]');
      expect(sanitized).toContain('[REDACTED_COOKIE]');
      expect(sanitized).toContain('[REDACTED_EMAIL]');
    });

    it('redacts sensitive fields in nested objects and metadata', () => {
      const rawPayload = {
        patientName: 'Jean Dupont',
        phoneNumber: '+33612857915',
        postalCode: '13001',
        prescription: 'Morphine 10mg',
        nested: {
          token: 'vapi_test_secret_abc123',
          cookie: 'auth_token=xyz',
          freeText: 'Patient phone is +33698765432 and code is 75010',
        },
      };

      const sanitized = sanitizeLogData(rawPayload) as any;

      expect(sanitized.patientName).toBe('***REDACTED***');
      expect(sanitized.phoneNumber).toBe('***REDACTED***');
      expect(sanitized.postalCode).toBe('***REDACTED***');
      expect(sanitized.prescription).toBe('***REDACTED***');
      expect(sanitized.nested.token).toBe('***REDACTED***');
      expect(sanitized.nested.cookie).toBe('***REDACTED***');
      expect(sanitized.nested.freeText).not.toContain('+33698765432');
      expect(sanitized.nested.freeText).not.toContain('75010');
    });

    it('sanitizes error messages and stack traces', () => {
      const rawError = new Error('Database failed for patient Jean Dupont with token=SuperSecret123 at 0612345678');
      const serialized = serializeError(rawError);

      expect(serialized).toBeDefined();
      expect(serialized?.message).not.toContain('SuperSecret123');
      expect(serialized?.message).not.toContain('0612345678');
      expect(serialized?.message).toContain('[REDACTED_CREDENTIAL]');
      expect(serialized?.message).toContain('+336****78');
      if (serialized?.stack) {
        expect(serialized.stack).not.toContain('SuperSecret123');
      }
    });
  });

  // =========================================================================
  // 5. TRANSACTIONAL OUTBOX & NOTIFICATION RETRIES (notifications.service.ts)
  // =========================================================================
  describe('Transactional Outbox & Notification Retries (notifications.service.ts)', () => {
    it('creates notification jobs durably inside an existing database transaction', async () => {
      const txMock = {
        notificationJob: {
          create: vi.fn().mockResolvedValue({
            id: 'job_tx_001',
            status: NotificationStatus.PENDING,
            attemptCount: 0,
          }),
        },
      };

      const job = await NotificationService.createJobInTx(txMock as any, {
        businessId: 'biz_01',
        recipient: '+33612857915',
        message: 'Alerte infirmière',
      });

      expect(txMock.notificationJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz_01',
          recipient: '+33612857915',
          message: 'Alerte infirmière',
          status: NotificationStatus.PENDING,
          attemptCount: 0,
          maxAttempts: 5,
        }),
      });
      expect(job.id).toBe('job_tx_001');
    });

    it('claims jobs atomically in processJob with durable lease semantics', async () => {
      const updateManySpy = vi.spyOn(db.notificationJob, 'updateMany').mockResolvedValueOnce({
        count: 0, // Simulates another worker already claimed this job
      });

      // Should return without attempting Twilio delivery
      const result = await NotificationService.processJob('job_already_processing', undefined, 'test-worker-1');
      expect(result).toBe(false);

      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'job_already_processing',
            OR: expect.any(Array),
          }),
          data: expect.objectContaining({
            status: NotificationStatus.PROCESSING,
            lockedBy: 'test-worker-1',
            attemptCount: { increment: 1 },
          }),
        })
      );

      updateManySpy.mockRestore();
    });
  });

  // =========================================================================
  // 6. IDEMPOTENCY RECOVERY & COMPARISON (patient-intake.service.ts)
  // =========================================================================
  describe('Idempotency Comparison (isMateriallyIdenticalRequest)', () => {
    const existing = {
      requestType: 'APPOINTMENT',
      patientName: 'Alice Dupont',
      requestedDate: '2026-11-18',
      requestedTime: '10:00',
      serviceType: 'Pansement',
      postalCode: '75008',
      urgency: false,
    };

    it('returns identical: true for exactly matching requests', () => {
      const incoming = {
        vapiCallId: 'call_123',
        callerNumber: '+33612345678',
        requestType: 'appointment' as const,
        patientName: 'Alice Dupont',
        requestedDate: '2026-11-18',
        requestedTime: '10:00',
        serviceType: 'Pansement',
        postalCode: '75008',
        urgency: false,
      };

      const res = isMateriallyIdenticalRequest(existing, incoming);
      expect(res.identical).toBe(true);
      expect(res.differences).toHaveLength(0);
    });

    it('normalizes whitespace and case differences', () => {
      const incoming = {
        vapiCallId: 'call_123',
        callerNumber: '+33612345678',
        requestType: 'appointment' as const,
        patientName: '  alice dupont  ',
        requestedDate: ' 2026-11-18 ',
        requestedTime: ' 10:00 ',
        serviceType: ' pansement ',
        postalCode: ' 75008 ',
      };

      const res = isMateriallyIdenticalRequest(existing, incoming);
      expect(res.identical).toBe(true);
    });

    it('detects materially different dates as conflict', () => {
      const incoming = {
        vapiCallId: 'call_123',
        callerNumber: '+33612345678',
        requestType: 'appointment' as const,
        patientName: 'Alice Dupont',
        requestedDate: '2026-11-19', // Different date!
        requestedTime: '10:00',
        serviceType: 'Pansement',
      };

      const res = isMateriallyIdenticalRequest(existing, incoming);
      expect(res.identical).toBe(false);
      expect(res.differences.some((d) => d.includes('requestedDate'))).toBe(true);
    });

    it('detects materially different times as conflict', () => {
      const incoming = {
        vapiCallId: 'call_123',
        callerNumber: '+33612345678',
        requestType: 'appointment' as const,
        patientName: 'Alice Dupont',
        requestedDate: '2026-11-18',
        requestedTime: '14:30', // Different time!
        serviceType: 'Pansement',
      };

      const res = isMateriallyIdenticalRequest(existing, incoming);
      expect(res.identical).toBe(false);
      expect(res.differences.some((d) => d.includes('requestedTime'))).toBe(true);
    });

    it('detects materially different patient names as conflict', () => {
      const incoming = {
        vapiCallId: 'call_123',
        callerNumber: '+33612345678',
        requestType: 'appointment' as const,
        patientName: 'Bob Martin', // Different patient!
        requestedDate: '2026-11-18',
        requestedTime: '10:00',
        serviceType: 'Pansement',
      };

      const res = isMateriallyIdenticalRequest(existing, incoming);
      expect(res.identical).toBe(false);
      expect(res.differences.some((d) => d.includes('patientName'))).toBe(true);
    });

    it('detects materially different request types as conflict', () => {
      const incoming = {
        vapiCallId: 'call_123',
        callerNumber: '+33612345678',
        requestType: 'cancellation' as const, // Different request type!
        patientName: 'Alice Dupont',
      };

      const res = isMateriallyIdenticalRequest(existing, incoming);
      expect(res.identical).toBe(false);
      expect(res.differences.some((d) => d.includes('requestType'))).toBe(true);
    });
  });
});

