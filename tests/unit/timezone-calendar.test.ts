import { describe, it, expect, beforeEach } from 'vitest';
import { googleCalendar } from '@/lib/integrations/google-calendar';

describe('Google Calendar & Timezone Handling (Workflow B)', () => {
  beforeEach(() => {
    googleCalendar.clearMockEvents();
  });

  it('correctly handles French Daylight Saving Time in Summer (GMT+2 / CEST)', () => {
    const { start, end } = googleCalendar.parseAppointmentDateTime('2026-07-15T14:00:00');
    // 14:00 Paris in July is 12:00 UTC
    expect(start.toISOString()).toBe('2026-07-15T12:00:00.000Z');
    expect(end.toISOString()).toBe('2026-07-15T13:00:00.000Z');
  });

  it('correctly handles French Winter Time (GMT+1 / CET)', () => {
    const { start, end } = googleCalendar.parseAppointmentDateTime('2026-12-15T10:00:00');
    // 10:00 Paris in December is 09:00 UTC
    expect(start.toISOString()).toBe('2026-12-15T09:00:00.000Z');
    expect(end.toISOString()).toBe('2026-12-15T10:00:00.000Z');
  });

  it('parses composite French date and time strings (e.g. 2026-10-20 and 14h30)', () => {
    const { start, end } = googleCalendar.parseAppointmentDateTime('2026-10-20', '14h30');
    // 14:30 Paris in October (CEST) is 12:30 UTC
    expect(start.toISOString()).toBe('2026-10-20T12:30:00.000Z');
    expect(end.toISOString()).toBe('2026-10-20T13:30:00.000Z');
  });

  it('returns isAvailable: true when no events conflict in the target interval', async () => {
    const start = new Date('2026-10-20T10:00:00.000Z');
    const end = new Date('2026-10-20T11:00:00.000Z');

    const result = await googleCalendar.checkAvailability(start, end, 'monaldi2b@gmail.com');
    expect(result.isAvailable).toBe(true);
    expect(result.conflictingEventsCount).toBe(0);
  });

  it('detects conflict when an event overlaps the requested interval', async () => {
    const start = new Date('2026-10-20T10:00:00.000Z');
    const end = new Date('2026-10-20T11:00:00.000Z');

    // Add overlapping event: 10:30 to 11:30
    googleCalendar.addMockEvent({
      id: 'conflict_01',
      calendarId: 'monaldi2b@gmail.com',
      summary: 'Existing appointment',
      start: new Date('2026-10-20T10:30:00.000Z'),
      end: new Date('2026-10-20T11:30:00.000Z'),
    });

    const result = await googleCalendar.checkAvailability(start, end, 'monaldi2b@gmail.com');
    expect(result.isAvailable).toBe(false);
    expect(result.conflictingEventsCount).toBe(1);
  });

  it('does not detect conflict when event is completely outside the interval', async () => {
    const start = new Date('2026-10-20T10:00:00.000Z');
    const end = new Date('2026-10-20T11:00:00.000Z');

    // Event finished before: 08:00 to 09:00
    googleCalendar.addMockEvent({
      id: 'earlier_01',
      calendarId: 'monaldi2b@gmail.com',
      summary: 'Morning appointment',
      start: new Date('2026-10-20T08:00:00.000Z'),
      end: new Date('2026-10-20T09:00:00.000Z'),
    });

    const result = await googleCalendar.checkAvailability(start, end, 'monaldi2b@gmail.com');
    expect(result.isAvailable).toBe(true);
  });
});
