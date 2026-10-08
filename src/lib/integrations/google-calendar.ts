import { google, calendar_v3 } from 'googleapis';
import { DateTime } from 'luxon';
import { env } from '../env';

export interface CalendarEventPayload {
  calendarId?: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  timezone?: string;
}

export interface CalendarCheckResult {
  isAvailable: boolean;
  start: Date;
  end: Date;
  conflictingEventsCount: number;
  isDryRun: boolean;
}

export interface CreatedCalendarEvent {
  eventId: string;
  summary: string;
  start: string;
  end: string;
  isDryRun: boolean;
}

class GoogleCalendarIntegration {
  private calendar: calendar_v3.Calendar | null = null;
  // In-memory mock events for dry run / test mode
  private mockEvents: Array<{
    id: string;
    calendarId: string;
    summary: string;
    start: Date;
    end: Date;
  }> = [];

  constructor() {
    if (
      env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      !env.GOOGLE_SERVICE_ACCOUNT_EMAIL.includes('test.iam') &&
      env.GOOGLE_PRIVATE_KEY &&
      env.GOOGLE_PRIVATE_KEY.length > 50
    ) {
      try {
        const auth = new google.auth.JWT({
          email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          scopes: ['https://www.googleapis.com/auth/calendar'],
        });
        this.calendar = google.calendar({ version: 'v3', auth });
      } catch (err) {
        console.warn('[Google Calendar Auth Warning]: Failed to initialize Google Auth', err);
      }
    }
  }

  /**
   * Parses an input date string with full French DST / Europe/Paris timezone awareness.
   */
  parseAppointmentDateTime(
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

      // Clean date string: YYYY-MM-DD
      const normalizedDate = dateStr.trim();
      const combined = `${normalizedDate}T${hour}:${minute}:00`;
      dt = DateTime.fromISO(combined, { zone });
    } else {
      // Single date_time string from tool call argument
      // Handles formats: ISO "2026-10-15T14:00:00", "2026-10-15 14:00", etc.
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
   * Checks calendar availability for a given interval [start, end].
   */
  async checkAvailability(
    start: Date,
    end: Date,
    calendarId = env.CABINET_CALENDAR_ID
  ): Promise<CalendarCheckResult> {
    if (env.DRY_RUN || !this.calendar) {
      // Check in-memory mock events
      const conflicts = this.mockEvents.filter(
        (ev) =>
          ev.calendarId === calendarId &&
          ev.start.getTime() < end.getTime() &&
          ev.end.getTime() > start.getTime()
      );

      return {
        isAvailable: conflicts.length === 0,
        start,
        end,
        conflictingEventsCount: conflicts.length,
        isDryRun: true,
      };
    }

    try {
      const response = await this.calendar.freebusy.query({
        requestBody: {
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          timeZone: env.TIMEZONE,
          items: [{ id: calendarId }],
        },
      });

      const busyList = response.data.calendars?.[calendarId]?.busy || [];
      const isAvailable = busyList.length === 0;

      return {
        isAvailable,
        start,
        end,
        conflictingEventsCount: busyList.length,
        isDryRun: false,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[Google Calendar FreeBusy Error]:', errMsg);
      throw new Error(`Google Calendar availability check failed: ${errMsg}`);
    }
  }

  /**
   * Creates an event on the specified calendar.
   */
  async createEvent(payload: CalendarEventPayload): Promise<CreatedCalendarEvent> {
    const calendarId = payload.calendarId || env.CABINET_CALENDAR_ID;

    if (env.DRY_RUN || !this.calendar) {
      const mockId = `mock_event_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const mock = {
        id: mockId,
        calendarId,
        summary: payload.summary,
        start: payload.start,
        end: payload.end,
      };
      this.mockEvents.push(mock);
      console.log(`[DRY_RUN Calendar Event Created] "${payload.summary}" on ${calendarId} at ${payload.start.toISOString()}`);
      return {
        eventId: mockId,
        summary: payload.summary,
        start: payload.start.toISOString(),
        end: payload.end.toISOString(),
        isDryRun: true,
      };
    }

    try {
      const res = await this.calendar.events.insert({
        calendarId,
        requestBody: {
          summary: payload.summary,
          description: payload.description,
          start: {
            dateTime: payload.start.toISOString(),
            timeZone: payload.timezone || env.TIMEZONE,
          },
          end: {
            dateTime: payload.end.toISOString(),
            timeZone: payload.timezone || env.TIMEZONE,
          },
        },
      });

      return {
        eventId: res.data.id || '',
        summary: res.data.summary || payload.summary,
        start: res.data.start?.dateTime || payload.start.toISOString(),
        end: res.data.end?.dateTime || payload.end.toISOString(),
        isDryRun: false,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[Google Calendar Insert Event Error]:', errMsg);
      throw new Error(`Failed to create calendar event: ${errMsg}`);
    }
  }

  /**
   * Cancels or deletes a calendar event
   */
  async deleteEvent(eventId: string, calendarId = env.CABINET_CALENDAR_ID): Promise<boolean> {
    if (env.DRY_RUN || !this.calendar) {
      this.mockEvents = this.mockEvents.filter((e) => e.id !== eventId);
      console.log(`[DRY_RUN Calendar Event Deleted] eventId: ${eventId}`);
      return true;
    }

    try {
      await this.calendar.events.delete({
        calendarId,
        eventId,
      });
      return true;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[Google Calendar Delete Event Warning for ${eventId}]:`, errMsg);
      return false;
    }
  }

  /**
   * Helper for tests to add a mock event
   */
  addMockEvent(event: {
    id: string;
    calendarId: string;
    summary: string;
    start: Date;
    end: Date;
  }) {
    this.mockEvents.push(event);
  }

  /**
   * Helper for tests to clear mock events
   */
  clearMockEvents() {
    this.mockEvents = [];
  }
}

export const googleCalendar = new GoogleCalendarIntegration();
