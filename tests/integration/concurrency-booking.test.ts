import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PatientIntakeService } from '@/lib/services/patient-intake.service';
import { AppointmentStatus, PatientRequestType, PatientRequestStatus, LineType } from '@prisma/client';

// Mock DB with simulated concurrency & transaction state
let activeAppointments: Array<{
  id: string;
  businessId: string;
  startTime: Date;
  endTime: Date;
  status: AppointmentStatus;
  urgency: boolean;
}> = [];

let activeRequests: Array<{
  id: string;
  businessId: string;
  vapiCallId: string;
  requestType: PatientRequestType;
  requestedDate?: string;
  requestedTime?: string;
  patientName: string;
  status: PatientRequestStatus;
}> = [];

vi.mock('@/lib/db', () => ({
  db: {
    business: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'biz_michelle_01',
        slug: 'CABINET_MICHELLE',
        alertPhoneNumber: '+33612857915',
        calendarId: 'monaldi2b@gmail.com',
      }),
      findFirst: vi.fn().mockResolvedValue({
        id: 'biz_michelle_01',
        slug: 'CABINET_MICHELLE',
      }),
    },
    contact: {
      upsert: vi.fn().mockResolvedValue({ id: 'contact_c1' }),
      update: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue({ id: 'contact_c1' }),
    },
    patient: {
      upsert: vi.fn().mockResolvedValue({ id: 'patient_p1' }),
    },
    callRecord: {
      upsert: vi.fn().mockResolvedValue({ id: 'call_rec_1' }),
    },
    appointment: {
      findFirst: vi.fn().mockImplementation((args: any) => {
        const found = activeAppointments.find((a) => {
          if (args?.where?.startTime?.lt && args?.where?.endTime?.gt) {
            return (
              a.businessId === args.where.businessId &&
              a.startTime < args.where.startTime.lt &&
              a.endTime > args.where.endTime.gt
            );
          }
          return false;
        });
        return Promise.resolve(found || null);
      }),
      findMany: vi.fn().mockImplementation((args: any) => {
        const found = activeAppointments.filter((a) => {
          if (args?.where?.startTime?.lt && args?.where?.endTime?.gt) {
            return (
              a.businessId === args.where.businessId &&
              a.startTime < args.where.startTime.lt &&
              a.endTime > args.where.endTime.gt
            );
          }
          return true;
        });
        return Promise.resolve(found);
      }),
      create: vi.fn().mockImplementation((args: any) => {
        const newAppt = {
          id: `appt_${Date.now()}_${Math.random()}`,
          businessId: args.data.businessId,
          startTime: args.data.startTime,
          endTime: args.data.endTime,
          status: args.data.status,
          urgency: args.data.urgency,
        };
        activeAppointments.push(newAppt);
        return Promise.resolve(newAppt);
      }),
    },
    patientRequest: {
      findUnique: vi.fn().mockImplementation((args: any) => {
        const found = activeRequests.find(
          (r) =>
            r.vapiCallId === args.where.vapiCallId_requestType?.vapiCallId &&
            r.requestType === args.where.vapiCallId_requestType?.requestType
        );
        return Promise.resolve(found || null);
      }),
      findFirst: vi.fn().mockImplementation((args: any) => {
        const found = activeRequests.find(
          (r) =>
            r.businessId === args.where.businessId &&
            r.requestedDate === args.where.requestedDate &&
            r.requestedTime === args.where.requestedTime &&
            r.vapiCallId !== args.where.vapiCallId?.not
        );
        return Promise.resolve(found || null);
      }),
      create: vi.fn().mockImplementation((args: any) => {
        // Enforce unique constraint (vapiCallId, requestType)
        const duplicate = activeRequests.find(
          (r) => r.vapiCallId === args.data.vapiCallId && r.requestType === args.data.requestType
        );
        if (duplicate) {
          const err: any = new Error('Unique constraint failed on the fields: (`vapiCallId`,`requestType`)');
          err.code = 'P2002';
          return Promise.reject(err);
        }
        const newReq = {
          id: `req_${Date.now()}_${Math.random()}`,
          businessId: args.data.businessId,
          vapiCallId: args.data.vapiCallId,
          requestType: args.data.requestType,
          requestedDate: args.data.requestedDate,
          requestedTime: args.data.requestedTime,
          patientName: args.data.patientName,
          status: args.data.status,
        };
        activeRequests.push(newReq);
        return Promise.resolve(newReq);
      }),
    },
    notificationJob: {
      create: vi.fn().mockResolvedValue({ id: 'job_01' }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    $transaction: vi.fn().mockImplementation(async (callback: any) => {
      const { db } = await import('@/lib/db');
      return callback(db);
    }),
  },
}));

vi.mock('@/lib/integrations/twilio', () => ({
  twilioClient: {
    lookupLineType: vi.fn().mockResolvedValue({ type: 'mobile', carrier: 'Orange' }),
    sendSms: vi.fn().mockResolvedValue({ success: true, messageId: 'SM_conc_123' }),
  },
}));

describe('Concurrency Control & Transactional Idempotency Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeAppointments = [];
    activeRequests = [];
  });

  it('prevents two simultaneous callers from booking the same time slot (slot conflict protection)', async () => {
    const caller1Payload = {
      requestType: 'appointment' as const,
      patientName: 'Patient Alice',
      postalCode: '75008',
      serviceType: 'Pansement',
      requestedDate: '2026-10-15',
      requestedTime: '10:00',
      caller: '+33611111111',
      callId: 'call_concurrent_caller_1',
    };

    const caller2Payload = {
      requestType: 'appointment' as const,
      patientName: 'Patient Bob',
      postalCode: '75008',
      serviceType: 'Prise de sang',
      requestedDate: '2026-10-15',
      requestedTime: '10:00', // EXACT SAME TIME SLOT
      caller: '+33622222222',
      callId: 'call_concurrent_caller_2',
    };

    // Caller 1 submits first and succeeds
    const res1 = await PatientIntakeService.handleDirectSubmission(caller1Payload);
    expect(res1.success).toBe(true);
    expect(res1.status).toBe('PENDING');

    // Caller 2 submits for the same slot -> must fail with slot conflict (409)
    const res2 = await PatientIntakeService.handleDirectSubmission(caller2Payload);
    expect(res2.success).toBe(false);
    expect(res2.status).toBe(409);
    expect(res2.error).toBe('SLOT_CONFLICT');
  });

  it('handles identical concurrent replays idempotently without creating duplicate appointments', async () => {
    const payload = {
      requestType: 'appointment' as const,
      patientName: 'Patient Idempotent',
      postalCode: '75008',
      serviceType: 'Pansement',
      requestedDate: '2026-10-15',
      requestedTime: '11:00',
      caller: '+33612345678',
      callId: 'call_replay_test_999',
    };

    // First submission
    const res1 = await PatientIntakeService.handleDirectSubmission(payload);
    expect(res1.success).toBe(true);
    expect(res1.isDuplicate).toBeFalsy();
    const initialRequestId = res1.requestId;

    // Identical replay
    const res2 = await PatientIntakeService.handleDirectSubmission(payload);
    expect(res2.success).toBe(true);
    expect(res2.isDuplicate).toBe(true);
    expect(res2.requestId).toBe(initialRequestId);

    // Verify only ONE appointment was created
    expect(activeAppointments).toHaveLength(1);
    expect(activeRequests).toHaveLength(1);
  });

  it('rejects replays using the same callId with materially different request parameters', async () => {
    const originalPayload = {
      requestType: 'appointment' as const,
      patientName: 'Patient Alice',
      postalCode: '75008',
      serviceType: 'Pansement',
      requestedDate: '2026-10-15',
      requestedTime: '10:00',
      caller: '+33612345678',
      callId: 'call_tampered_replay_001',
    };

    const res1 = await PatientIntakeService.handleDirectSubmission(originalPayload);
    expect(res1.success).toBe(true);

    // Attacker or malformed retry submits different time for the same callId
    const tamperedPayload = {
      ...originalPayload,
      requestedTime: '15:00', // Altered time!
    };

    const res2 = await PatientIntakeService.handleDirectSubmission(tamperedPayload);
    expect(res2.success).toBe(false);
    expect(res2.status).toBe(409);
    expect(res2.error).toBe('IDEMPOTENCY_CONFLICT');
  });
});
