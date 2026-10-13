import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InternalCalendarService, BLOCKING_APPOINTMENT_STATUSES } from '@/lib/services/internal-calendar.service';
import { CalendarAvailabilityService } from '@/lib/services/calendar-availability.service';
import { AppointmentStatus } from '@prisma/client';

// Mock DB
vi.mock('@/lib/db', () => ({
  db: {
    appointment: {
      findMany: vi.fn(),
    },
    business: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    assistantConfig: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/env', () => ({
  env: {
    TIMEZONE: 'Europe/Paris',
    CALENDAR_PROVIDER: 'internal',
    CABINET_CALENDAR_ID: 'monaldi2b@gmail.com',
    DRY_RUN: false,
  },
}));

import { db } from '@/lib/db';

describe('Calendar Availability Hardening & Tenant Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    InternalCalendarService.clearMockEvents();
  });

  // 1. Tenant Isolation
  it('appointments belonging to another business do not block the current business calendar', async () => {
    const targetBusinessId = 'biz_michelle_01';
    const otherBusinessId = 'biz_dani_batiment_02';

    const start = new Date('2026-10-15T08:00:00Z'); // 10:00 Paris
    const end = new Date('2026-10-15T09:00:00Z');   // 11:00 Paris

    // When querying for biz_michelle_01, findMany will be called with businessId: biz_michelle_01
    (db.business.findFirst as any).mockResolvedValue({ id: targetBusinessId });
    (db.appointment.findMany as any).mockImplementation((args: any) => {
      // If scoped to biz_michelle_01, return empty (available)
      if (args?.where?.businessId === targetBusinessId) {
        return Promise.resolve([]);
      }
      // If scoped to other business, return conflict
      if (args?.where?.businessId === otherBusinessId) {
        return Promise.resolve([
          {
            id: 'appt_other_biz',
            businessId: otherBusinessId,
            status: AppointmentStatus.CONFIRMED,
            startTime: start,
            endTime: end,
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await InternalCalendarService.checkAvailability(
      start,
      end,
      targetBusinessId,
      false
    );

    expect(result.isAvailable).toBe(true);
    expect(result.conflictingEventsCount).toBe(0);

    // Verify findMany was called with businessId filter
    expect(db.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: targetBusinessId,
        }),
      })
    );
  });

  // 2. PENDING_LANDLINE treated as blocking status
  it('PENDING_LANDLINE appointments block slot availability', async () => {
    expect(BLOCKING_APPOINTMENT_STATUSES).toContain(AppointmentStatus.PENDING_LANDLINE);
    expect(BLOCKING_APPOINTMENT_STATUSES).toContain(AppointmentStatus.PENDING);
    expect(BLOCKING_APPOINTMENT_STATUSES).toContain(AppointmentStatus.CONFIRMED);
    expect(BLOCKING_APPOINTMENT_STATUSES).toContain(AppointmentStatus.CONFIRMED_URGENT);

    const start = new Date('2026-10-15T08:00:00Z');
    const end = new Date('2026-10-15T09:00:00Z');

    (db.business.findFirst as any).mockResolvedValue({ id: 'biz_michelle_01' });
    (db.appointment.findMany as any).mockResolvedValue([
      {
        id: 'appt_landline_pending',
        status: AppointmentStatus.PENDING_LANDLINE,
        startTime: start,
        endTime: end,
      },
    ]);

    const result = await InternalCalendarService.checkAvailability(
      start,
      end,
      'biz_michelle_01',
      false
    );

    expect(result.isAvailable).toBe(false);
    expect(result.reason).toBe('conflicting_appointment');
    expect(result.conflictingEventsCount).toBe(1);
  });

  // 3. Fail-closed on database errors
  it('database errors cause availability verification to fail closed with verification_failed', async () => {
    const start = new Date('2026-10-15T08:00:00Z');
    const end = new Date('2026-10-15T09:00:00Z');

    (db.appointment.findMany as any).mockRejectedValue(new Error('PostgreSQL connection timeout'));

    const result = await InternalCalendarService.checkAvailability(
      start,
      end,
      'biz_michelle_01',
      false
    );

    expect(result.isAvailable).toBe(false);
    expect(result.reason).toBe('verification_failed');
    expect(result.error).toContain('PostgreSQL connection timeout');
  });

  // 4. Business hours enforcement in Europe/Paris
  it('rejects appointments outside business hours (weekends, lunch break, early morning, late evening)', () => {
    // Saturday: 2026-10-17 10:00 Paris (08:00 UTC)
    const satStart = new Date('2026-10-17T08:00:00Z');
    const satEnd = new Date('2026-10-17T09:00:00Z');
    expect(InternalCalendarService.isWithinBusinessHours(satStart, satEnd)).toBe(false);

    // Sunday: 2026-10-18 10:00 Paris
    const sunStart = new Date('2026-10-18T08:00:00Z');
    const sunEnd = new Date('2026-10-18T09:00:00Z');
    expect(InternalCalendarService.isWithinBusinessHours(sunStart, sunEnd)).toBe(false);

    // Lunch break: Thursday 2026-10-15 13:00 to 14:00 Paris (11:00 to 12:00 UTC)
    const lunchStart = new Date('2026-10-15T11:00:00Z');
    const lunchEnd = new Date('2026-10-15T12:00:00Z');
    expect(InternalCalendarService.isWithinBusinessHours(lunchStart, lunchEnd)).toBe(false);

    // Overlapping lunch break: 12:30 to 13:30 Paris (10:30 to 11:30 UTC)
    const overlapLunchStart = new Date('2026-10-15T10:30:00Z');
    const overlapLunchEnd = new Date('2026-10-15T11:30:00Z');
    expect(InternalCalendarService.isWithinBusinessHours(overlapLunchStart, overlapLunchEnd)).toBe(false);

    // Before opening: 08:00 to 09:00 Paris (06:00 to 07:00 UTC)
    const earlyStart = new Date('2026-10-15T06:00:00Z');
    const earlyEnd = new Date('2026-10-15T07:00:00Z');
    expect(InternalCalendarService.isWithinBusinessHours(earlyStart, earlyEnd)).toBe(false);

    // After closing: 18:00 to 19:00 Paris (16:00 to 17:00 UTC)
    const lateStart = new Date('2026-10-15T16:00:00Z');
    const lateEnd = new Date('2026-10-15T17:00:00Z');
    expect(InternalCalendarService.isWithinBusinessHours(lateStart, lateEnd)).toBe(false);

    // Valid morning slot: Thursday 2026-10-15 10:00 to 11:00 Paris (08:00 to 09:00 UTC)
    const validMorningStart = new Date('2026-10-15T08:00:00Z');
    const validMorningEnd = new Date('2026-10-15T09:00:00Z');
    expect(InternalCalendarService.isWithinBusinessHours(validMorningStart, validMorningEnd)).toBe(true);

    // Valid afternoon slot: Thursday 2026-10-15 15:00 to 16:00 Paris (13:00 to 14:00 UTC)
    const validAfternoonStart = new Date('2026-10-15T13:00:00Z');
    const validAfternoonEnd = new Date('2026-10-15T14:00:00Z');
    expect(InternalCalendarService.isWithinBusinessHours(validAfternoonStart, validAfternoonEnd)).toBe(true);
  });

  // 5. CalendarAvailabilityService checkDirectAvailability returns distinct statuses
  it('checkDirectAvailability returns distinct statuses: outside_business_hours, slot_conflict, available, verification_failed', async () => {
    // A. Outside business hours
    const satStart = new Date('2026-10-17T08:00:00Z');
    const satEnd = new Date('2026-10-17T09:00:00Z');
    const resOutside = await CalendarAvailabilityService.checkDirectAvailability({
      start: satStart,
      end: satEnd,
      businessId: 'biz_01',
    });
    expect(resOutside.isAvailable).toBe(false);
    expect(resOutside.reason).toBe('outside_business_hours');

    // B. Slot conflict
    const validStart = new Date('2026-10-15T08:00:00Z');
    const validEnd = new Date('2026-10-15T09:00:00Z');
    (db.business.findFirst as any).mockResolvedValue({ id: 'biz_01' });
    (db.appointment.findMany as any).mockResolvedValue([
      { id: 'appt_01', status: 'CONFIRMED', startTime: validStart, endTime: validEnd },
    ]);

    const resConflict = await CalendarAvailabilityService.checkDirectAvailability({
      start: validStart,
      end: validEnd,
      businessId: 'biz_01',
    });
    expect(resConflict.isAvailable).toBe(false);
    expect(resConflict.reason).toBe('slot_conflict');

    // C. Available
    (db.appointment.findMany as any).mockResolvedValue([]);
    const resAvailable = await CalendarAvailabilityService.checkDirectAvailability({
      start: validStart,
      end: validEnd,
      businessId: 'biz_01',
    });
    expect(resAvailable.isAvailable).toBe(true);
    expect(resAvailable.reason).toBe('available');

    // D. Verification failed on DB error
    (db.appointment.findMany as any).mockRejectedValue(new Error('Prisma disconnect'));
    const resFailed = await CalendarAvailabilityService.checkDirectAvailability({
      start: validStart,
      end: validEnd,
      businessId: 'biz_01',
    });
    expect(resFailed.isAvailable).toBe(false);
    expect(resFailed.reason).toBe('verification_failed');
  });
});
