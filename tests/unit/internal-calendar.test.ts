import { describe, it, expect, beforeEach } from 'vitest';
import { InternalCalendarService } from '@/lib/services/internal-calendar.service';

describe('Internal Calendar & Timezone Handling (Native Engine)', () => {
  beforeEach(() => {
    InternalCalendarService.clearMockEvents();
  });

  it('correctly handles French Daylight Saving Time in Summer (GMT+2 / CEST)', () => {
    const { start, end } = InternalCalendarService.parseAppointmentDateTime('2026-07-15T14:00:00');
    // 14:00 Paris in July is 12:00 UTC
    expect(start.toISOString()).toBe('2026-07-15T12:00:00.000Z');
    expect(end.toISOString()).toBe('2026-07-15T13:00:00.000Z');
  });

  it('correctly handles French Winter Time (GMT+1 / CET)', () => {
    const { start, end } = InternalCalendarService.parseAppointmentDateTime('2026-12-15T10:00:00');
    // 10:00 Paris in December is 09:00 UTC
    expect(start.toISOString()).toBe('2026-12-15T09:00:00.000Z');
    expect(end.toISOString()).toBe('2026-12-15T10:00:00.000Z');
  });

  it('parses composite French date and time strings (e.g. 2026-10-20 and 14h30)', () => {
    const { start, end } = InternalCalendarService.parseAppointmentDateTime('2026-10-20', '14h30');
    // 14:30 Paris in October (CEST) is 12:30 UTC
    expect(start.toISOString()).toBe('2026-10-20T12:30:00.000Z');
    expect(end.toISOString()).toBe('2026-10-20T13:30:00.000Z');
  });

  it('enforces clinic operating hours (Mon-Fri 09:00-13:00, 14:00-18:00, closed weekends & lunch)', () => {
    // 10:00 Paris on a Wednesday (2026-10-21) is within morning shift (09:00 - 13:00)
    const morningSlot = InternalCalendarService.parseAppointmentDateTime('2026-10-21T10:00:00');
    expect(InternalCalendarService.isWithinBusinessHours(morningSlot.start, morningSlot.end)).toBe(true);

    // 14:00 Paris on a Wednesday (2026-10-21) is within afternoon shift (14:00 - 18:00)
    const afternoonSlot = InternalCalendarService.parseAppointmentDateTime('2026-10-21T14:00:00');
    expect(InternalCalendarService.isWithinBusinessHours(afternoonSlot.start, afternoonSlot.end)).toBe(true);

    // 13:00 Paris (13:00 - 14:00) is closed during lunch break
    const lunchSlot = InternalCalendarService.parseAppointmentDateTime('2026-10-21T13:00:00');
    expect(InternalCalendarService.isWithinBusinessHours(lunchSlot.start, lunchSlot.end)).toBe(false);

    // 08:00 Paris is outside operating hours (opens at 09:00)
    const earlySlot = InternalCalendarService.parseAppointmentDateTime('2026-10-21T08:00:00');
    expect(InternalCalendarService.isWithinBusinessHours(earlySlot.start, earlySlot.end)).toBe(false);

    // 18:00 Paris is outside operating hours (closes at 18:00)
    const lateSlot = InternalCalendarService.parseAppointmentDateTime('2026-10-21T18:00:00');
    expect(InternalCalendarService.isWithinBusinessHours(lateSlot.start, lateSlot.end)).toBe(false);

    // Saturday (2026-10-24) is closed
    const saturdaySlot = InternalCalendarService.parseAppointmentDateTime('2026-10-24T14:00:00');
    expect(InternalCalendarService.isWithinBusinessHours(saturdaySlot.start, saturdaySlot.end)).toBe(false);

    // Sunday (2026-10-25) is closed
    const sundaySlot = InternalCalendarService.parseAppointmentDateTime('2026-10-25T14:00:00');
    expect(InternalCalendarService.isWithinBusinessHours(sundaySlot.start, sundaySlot.end)).toBe(false);
  });

  it('returns isAvailable: true when slot is within hours and no conflicts exist', async () => {
    // Wednesday 14:00 Paris time (12:00 UTC)
    const { start, end } = InternalCalendarService.parseAppointmentDateTime('2026-10-21T14:00:00');

    const result = await InternalCalendarService.checkAvailability(start, end, 'monaldi2b@gmail.com');
    expect(result.isAvailable).toBe(true);
    expect(result.conflictingEventsCount).toBe(0);
    expect(result.reason).toBe('available');
  });

  it('returns isAvailable: false when requested slot is outside business hours', async () => {
    // 22:00 Paris time
    const { start, end } = InternalCalendarService.parseAppointmentDateTime('2026-10-21T22:00:00');

    const result = await InternalCalendarService.checkAvailability(start, end, 'monaldi2b@gmail.com');
    expect(result.isAvailable).toBe(false);
    expect(result.reason).toBe('outside_business_hours');
  });

  it('detects conflict when an existing appointment overlaps the requested interval', async () => {
    const { start, end } = InternalCalendarService.parseAppointmentDateTime('2026-10-21T14:00:00');

    // Add overlapping event: 14:30 to 15:30
    InternalCalendarService.addMockEvent({
      id: 'conflict_01',
      calendarId: 'monaldi2b@gmail.com',
      summary: 'Existing appointment',
      start: new Date(start.getTime() + 30 * 60 * 1000),
      end: new Date(end.getTime() + 30 * 60 * 1000),
    });

    const result = await InternalCalendarService.checkAvailability(start, end, 'monaldi2b@gmail.com');
    expect(result.isAvailable).toBe(false);
    expect(result.conflictingEventsCount).toBe(1);
    expect(result.reason).toBe('conflicting_appointment');
  });

  it('creates and deletes internal calendar events', async () => {
    const { start, end } = InternalCalendarService.parseAppointmentDateTime('2026-10-21T10:00:00');

    const created = await InternalCalendarService.createEvent({
      calendarId: 'monaldi2b@gmail.com',
      summary: 'Consultation Infirmière',
      start,
      end,
    });

    expect(created.eventId).toBeDefined();
    expect(created.summary).toBe('Consultation Infirmière');

    const deleted = await InternalCalendarService.deleteEvent(created.eventId);
    expect(deleted).toBe(true);

    // After deletion, slot should be available again
    const check = await InternalCalendarService.checkAvailability(start, end, 'monaldi2b@gmail.com');
    expect(check.isAvailable).toBe(true);
  });
});
