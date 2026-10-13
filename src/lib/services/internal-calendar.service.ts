import { DateTime } from 'luxon';
import { db } from '../db';
import { env } from '../env';
import { logger } from '../logger';
import { AppointmentStatus, Prisma } from '@prisma/client';
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

export const BLOCKING_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.PENDING_LANDLINE,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CONFIRMED_URGENT,
];

export interface InternalCalendarCheckResult {
  isAvailable: boolean;
  start: Date;
  end: Date;
  conflictingEventsCount: number;
  reason?:
    | 'available'
    | 'outside_business_hours'
    | 'conflicting_appointment'
    | 'blocked_slot'
    | 'verification_failed';
  error?: string;
  isDryRun: boolean;
}

export interface InternalCreatedEvent {
  eventId: string;
  summary: string;
  start: string;
  end: string;
  isDryRun: boolean;
}

export interface ShiftHours {
  startHour: number; // e.g. 9
  endHour: number;   // e.g. 13
}

export interface BusinessHoursConfig {
  startHour: number; // e.g. 9 (09:00)
  endHour: number; // e.g. 18 (18:00)
  workingDays: number[]; // 1 = Monday ... 5 = Friday (6 = Saturday closed, 7 = Sunday closed)
  lunchBreakStart?: number; // 13 (13:00)
  lunchBreakEnd?: number;   // 14 (14:00)
  shifts?: ShiftHours[];    // Specific shifts: 9-13 and 14-18
}

export class InternalCalendarService {
  // Actual clinic hours: Monday to Friday, 9:00–13:00 and 14:00–18:00 Europe/Paris. Closed on weekends.
  private static defaultHours: BusinessHoursConfig = {
    startHour: 9,
    endHour: 18,
    workingDays: [1, 2, 3, 4, 5],
    lunchBreakStart: 13,
    lunchBreakEnd: 14,
    shifts: [
      { startHour: 9, endHour: 13 },
      { startHour: 14, endHour: 18 },
    ],
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
   * Validates whether a time interval falls within actual clinic opening hours:
   * Monday to Friday: 9:00–13:00 and 14:00–18:00.
   * Closed on weekends (Saturday & Sunday).
   * Lunch break: 13:00–14:00 (closed).
   */
  static isWithinBusinessHours(
    start: Date,
    end: Date,
    hours: BusinessHoursConfig = this.defaultHours,
    zone = env.TIMEZONE
  ): boolean {
    const startDt = DateTime.fromJSDate(start, { zone });
    const endDt = DateTime.fromJSDate(end, { zone });

    // Verify day of the week (1 = Monday ... 5 = Friday). Closed on weekends (6 = Sat, 7 = Sun)
    const workingDays = hours.workingDays || [1, 2, 3, 4, 5];
    if (!workingDays.includes(startDt.weekday)) {
      return false;
    }

    // Must be on the same calendar day
    if (!startDt.hasSame(endDt, 'day')) {
      return false;
    }

    // Verify time boundary in decimal hours
    const startHour = startDt.hour + startDt.minute / 60;
    const endHour = endDt.hour + endDt.minute / 60;

    // If explicit shifts defined, verify the interval falls completely within one of the shifts
    if (hours.shifts && hours.shifts.length > 0) {
      return hours.shifts.some(
        (shift) => startHour >= shift.startHour && endHour <= shift.endHour
      );
    }

    // Default morning/afternoon shifts with lunch break
    const startLimit = hours.startHour ?? 9;
    const endLimit = hours.endHour ?? 18;
    const lunchStart = hours.lunchBreakStart ?? 13;
    const lunchEnd = hours.lunchBreakEnd ?? 14;

    const inMorning = startHour >= startLimit && endHour <= lunchStart;
    const inAfternoon = startHour >= lunchEnd && endHour <= endLimit;

    return inMorning || inAfternoon;
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

    // 2. Authoritative resolution of tenant business for isolation - FAIL CLOSED if missing or unknown
    if (!calendarIdOrBusinessSlug || !calendarIdOrBusinessSlug.trim()) {
      return {
        isAvailable: false,
        start,
        end,
        conflictingEventsCount: 0,
        reason: 'verification_failed',
        error: 'Missing tenant or calendar identifier for availability check',
        isDryRun: false,
      };
    }

    let targetBusinessId: string | undefined = undefined;
    let targetCalendarId: string | undefined = undefined;
    if (db.business?.findFirst) {
      const biz = await db.business.findFirst({
        where: {
          OR: [
            { id: calendarIdOrBusinessSlug },
            { slug: calendarIdOrBusinessSlug },
            { calendarId: calendarIdOrBusinessSlug },
          ],
        },
        select: { id: true, calendarId: true },
      });

      if (!biz) {
        // FAIL CLOSED: Never interpret an unresolvable business/assistant as zero conflicts
        return {
          isAvailable: false,
          start,
          end,
          conflictingEventsCount: 0,
          reason: 'verification_failed',
          error: `Tenant business could not be resolved for identifier "${calendarIdOrBusinessSlug}"`,
          isDryRun: false,
        };
      }
      targetBusinessId = biz.id;
      targetCalendarId = biz.calendarId || undefined;
    } else {
      return {
        isAvailable: false,
        start,
        end,
        conflictingEventsCount: 0,
        reason: 'verification_failed',
        error: 'Database unavailable for authoritative tenant verification',
        isDryRun: false,
      };
    }

    // 3. Check in-memory mock events (used by tests / dry run)
    const allMockEvents = [
      ...this.mockEvents,
      ...(googleCalendar?.getMockEvents ? googleCalendar.getMockEvents() : []),
    ];

    const mockConflicts = allMockEvents.filter(
      (ev) =>
        (ev.calendarId === calendarIdOrBusinessSlug ||
          (targetCalendarId && ev.calendarId === targetCalendarId) ||
          (targetBusinessId && ev.calendarId === targetBusinessId)) &&
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

    // 4. Query PostgreSQL appointments with tenant isolation
    try {
      if (db.appointment?.findMany) {

        const dbConflicts = await db.appointment.findMany({
          where: {
            businessId: targetBusinessId,
            status: {
              in: BLOCKING_APPOINTMENT_STATUSES,
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
      logger.error('InternalCalendar checkAvailability DB query failed', {
        module: 'INTERNAL_CALENDAR',
        error: err,
      });
      // Fail closed: a technical error must never return isAvailable: true
      return {
        isAvailable: false,
        start,
        end,
        conflictingEventsCount: 0,
        reason: 'verification_failed',
        error: err instanceof Error ? err.message : String(err),
        isDryRun: false,
      };
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

    logger.info('Internal Calendar Event Created', {
      module: 'INTERNAL_CALENDAR',
      eventId,
      calendarId,
      start: payload.start.toISOString(),
    });

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
      logger.warn('InternalCalendar deleteEvent DB update failed', {
        module: 'INTERNAL_CALENDAR',
        error: err,
      });
    }

    return true;
  }

  /**
   * Blocks a timeslot (e.g. for staff holiday, lunch, training) using transaction-level advisory locking
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

    const txRunner = typeof db.$transaction === 'function'
      ? <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => db.$transaction(fn)
      : <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => fn(db as unknown as Prisma.TransactionClient);

    const appt = await txRunner(async (tx) => {
      // Concurrency protection: Acquire PostgreSQL advisory transaction lock
      if (typeof tx.$queryRaw === 'function') {
        const lockKey = `calendar_booking_${params.businessId}_${startStr}`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS locked`;
      }

      // Ensure staff contact exists
      let staffContact = await tx.contact.findFirst({
        where: { businessId: params.businessId },
      });

      if (!staffContact) {
        staffContact = await tx.contact.create({
          data: {
            businessId: params.businessId,
            name: 'Cabinet Michelle (Interne)',
            phoneNumber: env.CABINET_INBOUND_PHONE,
          },
        });
      }

      const eventId = `block_${Date.now()}`;

      return await tx.appointment.create({
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
    });

    this.mockEvents.push({
      id: appt.googleCalendarEventId || `block_${Date.now()}`,
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
