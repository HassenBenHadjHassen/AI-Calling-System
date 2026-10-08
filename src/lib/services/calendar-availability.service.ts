import { googleCalendar } from '../integrations/google-calendar';
import { VapiIntegration } from '../integrations/vapi';
import { db } from '../db';
import { env } from '../env';

export interface CalendarAvailabilityParams {
  dateTime: string;
  toolCallId: string;
  assistantId?: string;
}

export class CalendarAvailabilityService {
  /**
   * Checks calendar availability for the requested slot with Europe/Paris timezone awareness.
   * Reproduces integration-webhooks-google-calendar.json.
   */
  static async checkSlot(params: CalendarAvailabilityParams) {
    try {
      // 1. Resolve calendar ID from business or assistant if configured
      let calendarId = env.CABINET_CALENDAR_ID;
      if (params.assistantId) {
        const assistant = await db.assistantConfig.findUnique({
          where: { assistantId: params.assistantId },
          include: { business: true },
        });
        if (assistant?.business.calendarId) {
          calendarId = assistant.business.calendarId;
        }
      }

      // 2. Parse date/time with correct French daylight savings transitions
      const { start, end } = googleCalendar.parseAppointmentDateTime(params.dateTime);

      // 3. Check for conflict over the full interval [start, end]
      const availability = await googleCalendar.checkAvailability(start, end, calendarId);

      // 4. Return matching Make.com response strings
      if (!availability.isAvailable) {
        return VapiIntegration.buildToolResponse(
          params.toolCallId,
          'available=False ,Donc Ce créneau est déjà pris '
        );
      }

      return VapiIntegration.buildToolResponse(
        params.toolCallId,
        'available=True, Donc Le créneau est libre'
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[CalendarAvailability Error]:', errMsg);
      // Return safe unavailable response rather than crashing the voice call
      return VapiIntegration.buildToolResponse(
        params.toolCallId,
        'available=False ,Donc Ce créneau est déjà pris '
      );
    }
  }
}
