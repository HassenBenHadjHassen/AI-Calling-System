import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { PatientIntakeService } from '@/lib/services/patient-intake.service';
import { TenantService } from '@/lib/services/tenant.service';
import { db } from '@/lib/db';
import { AppointmentStatus } from '@prisma/client';
import { assertApprovedTestDatabase } from '../helpers/test-db-guard';

// Mock only external Twilio SMS network calls, leaving PostgreSQL DB completely unmocked
vi.mock('@/lib/integrations/twilio', () => ({
  twilioClient: {
    lookupLineType: vi.fn().mockResolvedValue({ type: 'mobile', carrier: 'Orange' }),
    sendSms: vi.fn().mockResolvedValue({ success: true, messageId: 'SM_conc_test_123' }),
  },
}));

describe('Concurrency Control & Transactional Idempotency Integration Tests (Real PostgreSQL)', () => {
  const TEST_DATE = '2026-11-18'; // Wednesday (clinic open)

  const TEST_CALL_IDS = [
    'call_pg_compete_1',
    'call_pg_compete_2',
    'call_pg_overlap_1',
    'call_pg_overlap_2',
    'call_pg_nonconflict_1',
    'call_pg_dup_1',
    'call_tampered_001',
    'call_diff_date_001',
  ];

  const TEST_CALLER_PHONES = [
    '+33611111111',
    '+33622222222',
    '+33633333333',
    '+33644444444',
    '+33655555555',
    '+33699999999',
  ];

  const createdNotificationJobIds: string[] = [];

  async function executeDirectSubmission(
    payload: Parameters<typeof PatientIntakeService.handleDirectSubmission>[0]
  ) {
    const res = await PatientIntakeService.handleDirectSubmission(payload);
    if ((res as any).notificationJobId) {
      createdNotificationJobIds.push((res as any).notificationJobId);
    }
    return res;
  }

  async function cleanupTestData() {
    const existingRequests = await db.patientRequest.findMany({
      where: { vapiCallId: { in: TEST_CALL_IDS } },
      select: { id: true, appointmentId: true, contactId: true, callRecordId: true },
    });

    const apptIds = existingRequests
      .map((r) => r.appointmentId)
      .filter((id): id is string => Boolean(id));
    const callRecordIds = existingRequests
      .map((r) => r.callRecordId)
      .filter((id): id is string => Boolean(id));
    const contactIds = existingRequests
      .map((r) => r.contactId)
      .filter((id): id is string => Boolean(id));

    await db.$transaction(async (tx) => {
      // 1. Delete notification jobs created for these test calls by captured IDs and test caller numbers
      const jobWhereClauses: Array<{ id?: { in: string[] }; message?: { contains: string } }> = [];
      if (createdNotificationJobIds.length > 0) {
        jobWhereClauses.push({ id: { in: [...createdNotificationJobIds] } });
      }
      for (const phone of TEST_CALLER_PHONES) {
        jobWhereClauses.push({ message: { contains: `numero :${phone}` } });
      }

      if (jobWhereClauses.length > 0) {
        await tx.notificationJob.deleteMany({
          where: {
            OR: jobWhereClauses,
          },
        });
      }
      createdNotificationJobIds.length = 0;

      // 2. Delete patient requests explicitly created by test call IDs
      await tx.patientRequest.deleteMany({
        where: { vapiCallId: { in: TEST_CALL_IDS } },
      });

      // 3. Delete appointments created by test call IDs or linked directly to them
      await tx.appointment.deleteMany({
        where: {
          OR: [
            { id: { in: apptIds } },
            { callRecord: { vapiCallId: { in: TEST_CALL_IDS } } },
          ],
        },
      });

      // 4. Delete call records for test calls
      await tx.callRecord.deleteMany({
        where: {
          OR: [
            { vapiCallId: { in: TEST_CALL_IDS } },
            { id: { in: callRecordIds } },
          ],
        },
      });

      // 5. Delete contacts only if created by these test calls and not referenced elsewhere
      if (contactIds.length > 0) {
        await tx.contact.deleteMany({
          where: {
            id: { in: contactIds },
            appointments: { none: { callRecord: { vapiCallId: { notIn: TEST_CALL_IDS } } } },
          },
        });
      }
    });
  }

  beforeAll(async () => {
    // Assert that the target database is an approved test database before any writes
    assertApprovedTestDatabase();
    // Ensure tenant is provisioned in PostgreSQL
    await TenantService.ensureTenant('CABINET_MICHELLE');
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  it('prevents two simultaneous callers from booking the same time slot using Promise.all (PostgreSQL advisory lock & conflict check)', async () => {
    const caller1Payload = {
      requestType: 'appointment' as const,
      patientName: 'Alice Concurrent',
      postalCode: '75008',
      serviceType: 'Pansement',
      requestedDate: TEST_DATE,
      requestedTime: '10:00',
      caller: '+33611111111',
      callId: 'call_pg_compete_1',
    };

    const caller2Payload = {
      requestType: 'appointment' as const,
      patientName: 'Bob Concurrent',
      postalCode: '75008',
      serviceType: 'Prise de sang',
      requestedDate: TEST_DATE,
      requestedTime: '10:00', // EXACT SAME SLOT
      caller: '+33622222222',
      callId: 'call_pg_compete_2',
    };

    // Execute concurrently using Promise.all against real PostgreSQL database
    const [res1, res2] = await Promise.all([
      executeDirectSubmission(caller1Payload),
      executeDirectSubmission(caller2Payload),
    ]);

    const successful = [res1, res2].filter((r) => r.success);
    const failed = [res1, res2].filter((r) => !r.success);

    // Exactly one must succeed, and the other must be rejected with 409 SLOT_CONFLICT
    expect(successful).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].status).toBe(409);
    expect((failed[0] as any).error).toBe('SLOT_CONFLICT');

    // Confirm in PostgreSQL: exactly 1 appointment and 1 patientRequest created for that slot
    const appointmentsInDb = await db.appointment.findMany({
      where: { date: TEST_DATE, time: '10:00' },
    });
    expect(appointmentsInDb).toHaveLength(1);
  });

  it('prevents two requests for overlapping time ranges when business rules prohibit the overlap', async () => {
    const slot1Payload = {
      requestType: 'appointment' as const,
      patientName: 'Patient Overlap One',
      postalCode: '75008',
      serviceType: 'Pansement',
      requestedDate: TEST_DATE,
      requestedTime: '11:00', // 11:00 - 12:00
      caller: '+33633333333',
      callId: 'call_pg_overlap_1',
    };

    const slot2Payload = {
      requestType: 'appointment' as const,
      patientName: 'Patient Overlap Two',
      postalCode: '75008',
      serviceType: 'Prise de sang',
      requestedDate: TEST_DATE,
      requestedTime: '11:30', // 11:30 - 12:30 (Overlaps with 11:00 - 12:00)
      caller: '+33644444444',
      callId: 'call_pg_overlap_2',
    };

    // First booking succeeds
    const res1 = await executeDirectSubmission(slot1Payload);
    expect(res1.success).toBe(true);

    // Overlapping booking must fail with 409 SLOT_CONFLICT
    const res2 = await executeDirectSubmission(slot2Payload);
    expect(res2.success).toBe(false);
    expect(res2.status).toBe(409);
    expect((res2 as any).conflict).toBe(true);
    expect((res2 as any).error).toBe('SLOT_CONFLICT');
  });

  it('allows a request for a non-conflicting slot to succeed', async () => {
    const nonConflictingPayload = {
      requestType: 'appointment' as const,
      patientName: 'Patient Afternoon',
      postalCode: '75008',
      serviceType: 'Injection',
      requestedDate: TEST_DATE,
      requestedTime: '15:00', // Distinct non-overlapping afternoon slot
      caller: '+33655555555',
      callId: 'call_pg_nonconflict_1',
    };

    const res = await executeDirectSubmission(nonConflictingPayload);
    expect(res.success).toBe(true);
    expect(res.status).toBe('PENDING');

    const appt = await db.appointment.findFirst({
      where: { date: TEST_DATE, time: '15:00' },
    });
    expect(appt).not.toBeNull();
    expect(appt?.status).toBe(AppointmentStatus.PENDING);
  });

  it('handles simultaneous duplicate submissions with the same callId idempotently without creating duplicate records', async () => {
    const duplicatePayload = {
      requestType: 'appointment' as const,
      patientName: 'Patient Duplicate',
      postalCode: '75008',
      serviceType: 'Pansement',
      requestedDate: TEST_DATE,
      requestedTime: '16:00',
      caller: '+33699999999',
      callId: 'call_pg_dup_1',
    };

    // Two identical requests fired concurrently with Promise.all
    const [res1, res2] = await Promise.all([
      executeDirectSubmission(duplicatePayload),
      executeDirectSubmission(duplicatePayload),
    ]);

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);

    // Both return the same request ID
    expect((res1 as any).requestId).toBe((res2 as any).requestId);

    // One is original and the other is marked duplicate, or both refer to the same record
    const duplicateFlags = [(res1 as any).isDuplicate, (res2 as any).isDuplicate];
    expect(duplicateFlags).toContain(true);

    // Verify in PostgreSQL: exactly 1 appointment and 1 patientRequest created
    const requestsInDb = await db.patientRequest.findMany({
      where: { vapiCallId: 'call_pg_dup_1' },
    });
    expect(requestsInDb).toHaveLength(1);

    const appointmentsInDb = await db.appointment.findMany({
      where: { date: TEST_DATE, time: '16:00' },
    });
    expect(appointmentsInDb).toHaveLength(1);
  });

  it('rejects replays using the same callId with materially different request parameters', async () => {
    const originalPayload = {
      requestType: 'appointment' as const,
      patientName: 'Alice Replay',
      postalCode: '75008',
      serviceType: 'Pansement',
      requestedDate: TEST_DATE,
      requestedTime: '09:00',
      caller: '+33611111111',
      callId: 'call_tampered_001',
    };

    const res1 = await executeDirectSubmission(originalPayload);
    expect(res1.success).toBe(true);

    // Retry with different requested time for the same callId
    const tamperedPayload = {
      ...originalPayload,
      requestedTime: '14:00',
    };

    const res2 = await executeDirectSubmission(tamperedPayload);
    expect(res2.success).toBe(false);
    expect(res2.status).toBe(409);
    expect((res2 as any).error).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('rejects replays using the same callId with different dates', async () => {
    const originalPayload = {
      requestType: 'appointment' as const,
      patientName: 'Alice DiffDate',
      postalCode: '75008',
      serviceType: 'Pansement',
      requestedDate: TEST_DATE,
      requestedTime: '10:00',
      caller: '+33611111111',
      callId: 'call_diff_date_001',
    };

    const res1 = await executeDirectSubmission(originalPayload);
    expect(res1.success).toBe(true);

    // Replay with different date
    const diffDatePayload = {
      ...originalPayload,
      requestedDate: '2026-11-19',
    };

    const res2 = await executeDirectSubmission(diffDatePayload);
    expect(res2.success).toBe(false);
    expect(res2.status).toBe(409);
    expect((res2 as any).error).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('preserves unrelated appointments on the same date when cleaning up test data', async () => {
    const biz = await TenantService.ensureTenant('CABINET_MICHELLE');
    // Create an unrelated contact and appointment not belonging to any test call IDs or test phones
    const unrelatedContact = await db.contact.create({
      data: {
        businessId: biz.id,
        phoneNumber: '+33677777777', // Not in TEST_PHONES
        name: 'Genuine Unrelated Patient',
      },
    });

    const unrelatedAppt = await db.appointment.create({
      data: {
        businessId: biz.id,
        contactId: unrelatedContact.id,
        serviceType: 'Urgence Genuine',
        date: TEST_DATE,
        time: '17h00',
        startTime: new Date(`${TEST_DATE}T17:00:00.000Z`),
        endTime: new Date(`${TEST_DATE}T18:00:00.000Z`),
        status: AppointmentStatus.CONFIRMED,
      },
    });

    try {
      // Execute the test cleanup function
      await cleanupTestData();

      // Assert that the unrelated appointment was NOT deleted
      const stillExists = await db.appointment.findUnique({
        where: { id: unrelatedAppt.id },
      });
      expect(stillExists).not.toBeNull();
      expect(stillExists?.id).toBe(unrelatedAppt.id);
    } finally {
      // Safely delete only the specific record created for this assertion
      await db.appointment.delete({ where: { id: unrelatedAppt.id } }).catch(() => {});
      await db.contact.delete({ where: { id: unrelatedContact.id } }).catch(() => {});
    }
  });
});
