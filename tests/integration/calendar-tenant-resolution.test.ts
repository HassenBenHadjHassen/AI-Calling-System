import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { InternalCalendarService } from '@/lib/services/internal-calendar.service';
import { CalendarAvailabilityService } from '@/lib/services/calendar-availability.service';
import { TenantService } from '@/lib/services/tenant.service';
import { db } from '@/lib/db';
import { AppointmentStatus } from '@prisma/client';
import { assertApprovedTestDatabase } from '../helpers/test-db-guard';

describe('Calendar Tenant Resolution & Fail-Closed Protection (Real PostgreSQL)', () => {
  let michelleBizId: string;
  let batimentBizId: string;
  const TEST_DATE = '2026-11-25'; // Wednesday
  const TEST_SLOT_START = new Date(`${TEST_DATE}T10:00:00.000Z`);
  const TEST_SLOT_END = new Date(`${TEST_DATE}T10:30:00.000Z`);

  let createdApptId: string | undefined;
  let createdContactId: string | undefined;

  beforeAll(async () => {
    assertApprovedTestDatabase();
    const michelle = await TenantService.ensureTenant('CABINET_MICHELLE');
    const batiment = await TenantService.ensureTenant('DANI_BATIMENT');
    michelleBizId = michelle.id;
    batimentBizId = batiment.id;
  });

  afterAll(async () => {
    await db.$transaction(async (tx) => {
      if (createdApptId) {
        await tx.appointment.deleteMany({ where: { id: createdApptId } });
      }
      if (createdContactId) {
        await tx.contact.deleteMany({ where: { id: createdContactId } });
      }
    });
  });

  it('fails closed when given an unverified biz_... identifier that does not exist in the database', async () => {
    const result = await InternalCalendarService.checkAvailability(
      TEST_SLOT_START,
      TEST_SLOT_END,
      'biz_fake_nonexistent_123',
      false
    );

    expect(result.isAvailable).toBe(false);
    expect(result.reason).toBe('verification_failed');
    expect(result.error).toContain('Tenant business could not be resolved');
  });

  it('fails closed when given an arbitrary unknown slug or calendar ID', async () => {
    const result = await InternalCalendarService.checkAvailability(
      TEST_SLOT_START,
      TEST_SLOT_END,
      'some-random-unknown-tenant',
      false
    );

    expect(result.isAvailable).toBe(false);
    expect(result.reason).toBe('verification_failed');
  });

  it('fails closed when checkSlot receives an unknown assistant ID', async () => {
    const response = await CalendarAvailabilityService.checkSlot({
      dateTime: `${TEST_DATE} 10:00`,
      toolCallId: 'call_test_unknown_asst',
      assistantId: '00000000-0000-0000-0000-000000000000',
    });

    expect(response.results[0].result).toContain('available=False');
    expect(response.results[0].result).toContain('assistant non configuré');
  });

  it('fails closed when checkSlot receives an unknown business ID', async () => {
    const response = await CalendarAvailabilityService.checkSlot({
      dateTime: `${TEST_DATE} 10:00`,
      toolCallId: 'call_test_unknown_biz',
      businessId: 'biz_completely_unknown',
    });

    expect(response.results[0].result).toContain('available=False');
    expect(response.results[0].result).toContain('entreprise inconnue');
  });

  it('correctly reports availability for a valid verified tenant with a genuinely free slot', async () => {
    const result = await InternalCalendarService.checkAvailability(
      TEST_SLOT_START,
      TEST_SLOT_END,
      michelleBizId,
      false
    );

    expect(result.isAvailable).toBe(true);
    expect(result.reason).toBe('available');
    expect(result.conflictingEventsCount).toBe(0);
  });

  it('correctly reports conflicting slot when an appointment exists for the tenant', async () => {
    // Create an appointment under Cabinet Michelle
    const contact = await db.contact.create({
      data: {
        businessId: michelleBizId,
        phoneNumber: '+33699887766',
        name: 'Conflicting Patient',
      },
    });
    createdContactId = contact.id;

    const appt = await db.appointment.create({
      data: {
        businessId: michelleBizId,
        contactId: contact.id,
        serviceType: 'Pansement',
        date: TEST_DATE,
        time: '10:00',
        startTime: TEST_SLOT_START,
        endTime: TEST_SLOT_END,
        status: AppointmentStatus.CONFIRMED,
      },
    });
    createdApptId = appt.id;

    const result = await InternalCalendarService.checkAvailability(
      TEST_SLOT_START,
      TEST_SLOT_END,
      michelleBizId,
      false
    );

    expect(result.isAvailable).toBe(false);
    expect(result.reason).toBe('conflicting_appointment');
    expect(result.conflictingEventsCount).toBeGreaterThanOrEqual(1);
  });

  it('maintains strict cross-tenant isolation: conflicting slot in Tenant A does not block Tenant B', async () => {
    // The slot is booked under Cabinet Michelle, but Dani Bâtiment calendar should remain free for that slot
    const result = await InternalCalendarService.checkAvailability(
      TEST_SLOT_START,
      TEST_SLOT_END,
      batimentBizId,
      false
    );

    expect(result.isAvailable).toBe(true);
    expect(result.reason).toBe('available');
    expect(result.conflictingEventsCount).toBe(0);
  });

  it('rejects slots outside clinic business hours (e.g. Saturday or evening)', async () => {
    const saturday = new Date('2026-11-28T10:00:00.000Z'); // Saturday
    const saturdayEnd = new Date('2026-11-28T10:30:00.000Z');

    const result = await CalendarAvailabilityService.checkDirectAvailability({
      start: saturday,
      end: saturdayEnd,
      businessId: michelleBizId,
      enforceHours: true,
    });

    expect(result.isAvailable).toBe(false);
    expect(result.reason).toBe('outside_business_hours');
  });
});
