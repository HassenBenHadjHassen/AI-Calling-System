import { googleCalendar } from '../integrations/google-calendar';
import { InternalCalendarService } from './internal-calendar.service';
import { VapiIntegration } from '../integrations/vapi';
import { db } from '../db';
import { env } from '../env';

export interface CalendarAvailabilityParams {
  dateTime: string;
  toolCallId: string;
  assistantId?: string;
  businessId?: string;
}

export interface DirectAvailabilityResult {
  isAvailable: boolean;
  reason: 'available' | 'outside_business_hours' | 'slot_conflict' | 'verification_failed';
  error?: string;
  start: Date;
  end: Date;
}

export class CalendarAvailabilityService {
  /**
   * Unified availability checker honoring CALENDAR_PROVIDER (google vs internal)
   * and enforcing clinic business hours consistently in Europe/Paris.
   */
  static async checkDirectAvailability(params: {
    start: Date;
    end: Date;
    businessId?: string;
    calendarId?: string;
    enforceHours?: boolean;
  }): Promise<DirectAvailabilityResult> {
    const { start, end, businessId, calendarId = env.CABINET_CALENDAR_ID, enforceHours = true } = params;

    // 1. Enforce business hours in Europe/Paris for all providers
    if (enforceHours && !InternalCalendarService.isWithinBusinessHours(start, end)) {
      return {
        isAvailable: false,
        reason: 'outside_business_hours',
        start,
        end,
      };
    }

    // 2. Query configured calendar provider
    if (env.CALENDAR_PROVIDER === 'google') {
      try {
        const availability = await googleCalendar.checkAvailability(start, end, calendarId);
        if (!availability.isAvailable) {
          return {
            isAvailable: false,
            reason: 'slot_conflict',
            start,
            end,
          };
        }
        return {
          isAvailable: true,
          reason: 'available',
          start,
          end,
        };
      } catch (err: unknown) {
        console.error('[CalendarAvailability Google Provider Error]:', err);
        return {
          isAvailable: false,
          reason: 'verification_failed',
          error: err instanceof Error ? err.message : String(err),
          start,
          end,
        };
      }
    }

    // Internal PostgreSQL provider
    try {
      const internalRes = await InternalCalendarService.checkAvailability(
        start,
        end,
        businessId || calendarId,
        false // Hours already verified above
      );

      if (internalRes.reason === 'verification_failed') {
        return {
          isAvailable: false,
          reason: 'verification_failed',
          error: internalRes.error,
          start,
          end,
        };
      }

      if (!internalRes.isAvailable) {
        return {
          isAvailable: false,
          reason: 'slot_conflict',
          start,
          end,
        };
      }

      return {
        isAvailable: true,
        reason: 'available',
        start,
        end,
      };
    } catch (err: unknown) {
      console.error('[CalendarAvailability Internal Provider Error]:', err);
      return {
        isAvailable: false,
        reason: 'verification_failed',
        error: err instanceof Error ? err.message : String(err),
        start,
        end,
      };
    }
  }

  /**
   * Checks calendar availability for the requested slot with Europe/Paris timezone awareness.
   * Reproduces integration-webhooks-google-calendar.json natively without external dependencies.
   * Returns distinct responses for available, occupied, outside business hours, and technical verification failures.
   */
  static async checkSlot(params: CalendarAvailabilityParams) {
    try {
      // 1. Resolve calendar ID and business from assistant if configured
      let calendarId = env.CABINET_CALENDAR_ID;
      let businessId = params.businessId;

      if (params.assistantId) {
        const assistant = await db.assistantConfig.findUnique({
          where: { assistantId: params.assistantId },
          include: { business: true },
        });
        if (assistant?.business) {
          businessId = assistant.business.id;
          if (assistant.business.calendarId) {
            calendarId = assistant.business.calendarId;
          }
        }
      }

      // 2. Parse date/time with correct French daylight savings transitions
      const { start, end } = InternalCalendarService.parseAppointmentDateTime(params.dateTime);

      // 3. Check availability across configured provider
      const check = await this.checkDirectAvailability({
        start,
        end,
        businessId,
        calendarId,
        enforceHours: true,
      });

      // 4. Return distinct Vapi tool responses
      if (check.reason === 'outside_business_hours') {
        return VapiIntegration.buildToolResponse(
          params.toolCallId,
          "available=False, En dehors des horaires d'ouverture (du lundi au vendredi de 9h à 13h et de 14h à 18h)"
        );
      }

      if (check.reason === 'verification_failed') {
        return VapiIntegration.buildToolResponse(
          params.toolCallId,
          'available=False, Erreur technique lors de la vérification du calendrier'
        );
      }

      if (!check.isAvailable) {
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
      // Return distinct error rather than falsely claiming slot is occupied
      return VapiIntegration.buildToolResponse(
        params.toolCallId,
        'available=False, Erreur technique lors de la vérification du calendrier'
      );
    }
  }
}
