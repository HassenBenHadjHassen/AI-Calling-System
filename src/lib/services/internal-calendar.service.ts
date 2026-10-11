import { DateTime } from 'luxon';
import { db } from '../db';
import { env } from '../env';
import { AppointmentStatus } from '@prisma/client';
import { googleCalendar } from '../integrations/google-calendar';

export interface InternalCalendarEventPayload {
  businessId?: string;
  calendarId?: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  timezone?: string;
}

export interface InternalCalendarCheckResult {
  isAvailable: boolean;
  start: Date;
  end: Date;
  conflictingEventsCount: number;
  reason?: 'available' | 'outside_business_hours' | 'conflicting_appointment' | 'blocked_slot';
  isDryRun: boolean;
}

export interface InternalCreatedEvent {
  eventId: string;
  summary: string;
  start: string;
  end: string;
  isDryRun: boolean;
}

export interface BusinessHoursConfig {
  startHour: number; // e.g. 8 (08:00)
  endHour: number; // e.g. 19 (19:00)
  workingDays: number[]; // 1 = Monday ... 6 = Saturday (7 = Sunday closed)
}

export class InternalCalendarService {
  // Default working hours: Monday (1) through Saturday (6), 08:00 to 19:00 Europe/Paris
  private static defaultHours: BusinessHoursConfig = {
    startHour: 8,
    endHour: 19,
    workingDays: [1, 2, 3, 4, 5, 6],
  };

  // In-memory mock events for isolated unit test runs
  private static mockEvents: Array<{
    id: string;
    calendarId: string;
    summary: string;
    start: Date;
    end: Date;
    status?: string;
  }> = [];

  /**
   * Parses an input date string with Europe/Paris timezone awareness
   * and DST transitions. Handles composite strings ("2026-10-15", "14h30")
   * and ISO strings.
   */
  static parseAppointmentDateTime(
    dateStr: string,
    timeStr?: string,
    zone = env.TIMEZONE
  ): { start: Date; end: Date; durationMinutes: number } {
    let dt: DateTime | null = null;

    if (timeStr) {
      // Clean time string: "14h30" -> "14:30", "14h" -> "14:00"
      const normalizedTime = timeStr
        .replace(/h/i, ':')
        .replace(/::/g, ':')
        .trim();
      const parts = normalizedTime.split(':');
      const hour = parts[0].padStart(2, '0');
      const minute = (parts[1] || '00').padStart(2, '0');

      const normalizedDate = dateStr.trim();
      const combined = `${normalizedDate}T${hour}:${minute}:00`;
      dt = DateTime.fromISO(combined, { zone });
    } else {
      const cleaned = dateStr.trim();
      dt = DateTime.fromISO(cleaned, { zone });
      if (!dt.isValid) {
        dt = DateTime.fromFormat(cleaned, 'yyyy-MM-dd HH:mm', { zone });
      }
      if (!dt.isValid) {
        dt = DateTime.fromFormat(cleaned, 'yyyy-MM-dd HH:mm:ss', { zone });
      }
      if (!dt.isValid) {
        dt = DateTime.fromFormat(cleaned, "yyyy-MM-dd HH'h'mm", { zone });
      }
      if (!dt.isValid) {
        dt = DateTime.fromFormat(cleaned, "yyyy-MM-dd HH'h'", { zone });
      }
    }

    if (!dt || !dt.isValid) {
      throw new Error(`Unable to parse appointment date/time: "${dateStr}" ${timeStr ? `"${timeStr}"` : ''}`);
    }

    const start = dt.toJSDate();
    const end = dt.plus({ hours: 1 }).toJSDate();

    return { start, end, durationMinutes: 60 };
  }

  /**
   * Validates whether a time interval falls within business working hours.
   */
  static isWithinBusinessHours(
    start: Date,
    end: Date,
    hours: BusinessHoursConfig = this.defaultHours,
    zone = env.TIMEZONE
  ): boolean {
    const startDt = DateTime.fromJSDate(start, { zone });
    const endDt = DateTime.fromJSDate(end, { zone });

    // Verify day of the week
    if (!hours.workingDays.includes(startDt.weekday)) {
      return false;
    }

    // Must be on the same calendar day
    if (!startDt.hasSame(endDt, 'day')) {
      return false;
    }

    // Verify time boundary
    const startHour = startDt.hour + startDt.minute / 60;
    const endHour = endDt.hour + endDt.minute / 60;

    return startHour >= hours.startHour && endHour <= hours.endHour;
  }

  /**
   * Checks calendar availability against internal database and business hours.
   * Reproduces make scenario availability check with zero external API calls.
   */
  static async checkAvailability(
    start: Date,
    end: Date,
    calendarIdOrBusinessSlug: string = env.CABINET_CALENDAR_ID,
    enforceHours: boolean = true
  ): Promise<InternalCalendarCheckResult> {
    // 1. Verify business opening hours in Europe/Paris
    if (enforceHours && !this.isWithinBusinessHours(start, end)) {
      return {
        isAvailable: false,
        start,
        end,
        conflictingEventsCount: 1,
        reason: 'outside_business_hours',
        isDryRun: env.DRY_RUN,
      };
    }

    // 2. Check in-memory mock events (used by tests / dry run)
    const allMockEvents = [
      ...this.mockEvents,
      ...(googleCalendar?.getMockEvents ? googleCalendar.getMockEvents() : []),
    ];

    const mockConflicts = allMockEvents.filter(
      (ev) =>
        ev.calendarId === calendarIdOrBusinessSlug &&
        ev.start.getTime() < end.getTime() &&
        ev.end.getTime() > start.getTime() &&
        (!('status' in ev) || (ev as { status?: unknown }).status !== 'CANCELLED')
    );

    if (mockConflicts.length > 0) {
      return {
        isAvailable: false,
        start,
        end,
        conflictingEventsCount: mockConflicts.length,
        reason: 'conflicting_appointment',
        isDryRun: true,
      };
    }

    // 3. Query PostgreSQL appointments
    try {
      if (db.appointment?.findMany) {
        const dbConflicts = await db.appointment.findMany({
          where: {
            status: {
              in: [
                AppointmentStatus.CONFIRMED,
                AppointmentStatus.CONFIRMED_URGENT,
                AppointmentStatus.PENDING,
              ],
            },
            startTime: { lt: end },
            endTime: { gt: start },
          },
        });

        if (dbConflicts && dbConflicts.length > 0) {
          return {
            isAvailable: false,
            start,
            end,
            conflictingEventsCount: dbConflicts.length,
            reason: 'conflicting_appointment',
            isDryRun: false,
          };
        }
      }
    } catch (err: unknown) {
      console.warn('[InternalCalendar checkAvailability DB query]:', err);
    }

    return {
      isAvailable: true,
      start,
      end,
      conflictingEventsCount: 0,
      reason: 'available',
      isDryRun: env.DRY_RUN,
    };
  }

  /**
   * Creates an internal calendar event/appointment reference.
   */
  static async createEvent(payload: InternalCalendarEventPayload): Promise<InternalCreatedEvent> {
    const calendarId = payload.calendarId || env.CABINET_CALENDAR_ID;
    const eventId = `internal_evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Store in mock memory for test runs
    this.mockEvents.push({
      id: eventId,
      calendarId,
      summary: payload.summary,
      start: payload.start,
      end: payload.end,
      status: 'CONFIRMED',
    });

    console.log(
      `[Internal Calendar Event Created] "${payload.summary}" on ${calendarId} at ${payload.start.toISOString()}`
    );

    return {
      eventId,
      summary: payload.summary,
      start: payload.start.toISOString(),
      end: payload.end.toISOString(),
      isDryRun: env.DRY_RUN,
    };
  }

  /**
   * Cancels or deletes a calendar event
   */
  static async deleteEvent(eventId: string): Promise<boolean> {
    this.mockEvents = this.mockEvents.filter((e) => e.id !== eventId);

    try {
      if (db.appointment?.updateMany) {
        await db.appointment.updateMany({
          where: { googleCalendarEventId: eventId },
          data: { status: AppointmentStatus.CANCELLED },
        });
      }
    } catch (err: unknown) {
      console.warn('[InternalCalendar deleteEvent DB update]:', err);
    }

    return true;
  }

  /**
   * Blocks a timeslot (e.g. for staff holiday, lunch, training)
   */
  static async blockTimeSlot(params: {
    businessId: string;
    title: string;
    start: Date;
    end: Date;
    notes?: string;
  }) {
    const startStr = DateTime.fromJSDate(params.start, { zone: env.TIMEZONE }).toFormat('yyyy-MM-dd');
    const timeStr = DateTime.fromJSDate(params.start, { zone: env.TIMEZONE }).toFormat("HH'h'mm");

    // Ensure staff contact exists
    let staffContact = await db.contact.findFirst({
      where: { businessId: params.businessId },
    });

    if (!staffContact) {
      staffContact = await db.contact.create({
        data: {
          businessId: params.businessId,
          name: 'Cabinet Michelle (Interne)',
          phoneNumber: env.CABINET_INBOUND_PHONE,
        },
      });
    }

    const eventId = `block_${Date.now()}`;

    const appt = await db.appointment.create({
      data: {
        businessId: params.businessId,
        contactId: staffContact.id,
        serviceType: `INDISPONIBLE: ${params.title}`,
        date: startStr,
        time: timeStr,
        startTime: params.start,
        endTime: params.end,
        status: AppointmentStatus.CONFIRMED,
        googleCalendarEventId: eventId,
        notes: params.notes || 'Créneau bloqué manuellement',
      },
    });

    this.mockEvents.push({
      id: eventId,
      calendarId: env.CABINET_CALENDAR_ID,
      summary: `Bloqué: ${params.title}`,
      start: params.start,
      end: params.end,
      status: 'CONFIRMED',
    });

    return appt;
  }

  /**
   * Helper for tests to add a mock event
   */
  static addMockEvent(event: {
    id: string;
    calendarId: string;
    summary: string;
    start: Date;
    end: Date;
    status?: string;
  }) {
    this.mockEvents.push(event);
  }

  /**
   * Helper for tests to clear mock events
   */
  static clearMockEvents() {
    this.mockEvents = [];
  }
}
