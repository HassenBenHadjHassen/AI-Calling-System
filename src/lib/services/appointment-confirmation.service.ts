import { db } from '../db';
import { normalizePhoneNumber } from '../validation/phone';
import { openAiClient } from '../integrations/openai';
import { googleCalendar } from '../integrations/google-calendar';
import { NotificationService } from './notifications.service';
import { AppointmentStatus } from '@prisma/client';
import { env } from '../env';
import { TenantService } from './tenant.service';

export interface InboundSmsConfirmationParams {
  from: string;
  body: string;
  messageSid: string;
}

export class AppointmentConfirmationService {
  /**
   * Processes inbound SMS from nurse confirming/refusing/rescheduling an appointment.
   * Reproduces confirmation_de_rdv.json.
   */
  static async processInboundSms(params: InboundSmsConfirmationParams) {
    const fromNumber = normalizePhoneNumber(params.from);
    console.log(`[AppointmentConfirmation] Received SMS from: ${fromNumber}`);

    // 1. Resolve Business Tenant (auto-bootstraps if not seeded)
    const business = await TenantService.ensureTenant('CABINET_MICHELLE');

    // 2. Find matching pending appointment
    const appointment = await db.appointment.findFirst({
      where: {
        businessId: business.id,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.RESCHEDULE_PROPOSED] },
      },
      include: { contact: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!appointment) {
      console.log('[AppointmentConfirmation] No pending appointment found for incoming SMS');
      return { handled: false, reason: 'No pending appointment' };
    }

    // 3. Classify reply (OUI, NON, AUTRE, NONE)
    const classification = await openAiClient.classifySmsReply(params.body);
    const patientPhone = appointment.contact.phoneNumber;
    const patientName = appointment.contact.name;

    switch (classification.intent) {
      case 'OUI': {
        // Module 17: Create Google Calendar Event
        let calendarEventId: string | null = null;
        try {
          const calEvent = await googleCalendar.createEvent({
            calendarId: business.calendarId || env.CABINET_CALENDAR_ID,
            summary: `rendez-vous avec patient :${patientName}`,
            start: appointment.startTime,
            end: appointment.endTime,
          });
          calendarEventId = calEvent.eventId;
        } catch (calErr: unknown) {
          const errMsg = calErr instanceof Error ? calErr.message : String(calErr);
          console.error('[AppointmentConfirmation] Failed to create calendar event:', errMsg);
        }

        // Module 16: Confirmation SMS to patient
        const confirmMsg =
          `Bonjour, votre RDV infirmier est confirmé pour le ${appointment.date} à ${appointment.time}.\n` +
          `En cas d'empêchement, merci de nous prévenir au plus vite.\n`;

        await NotificationService.queueNotification({
          businessId: business.id,
          recipient: patientPhone,
          message: confirmMsg,
          from: business.inboundPhoneNumber || env.CABINET_INBOUND_PHONE,
        });

        // Module 19: Update row to CONFIRMED
        await db.appointment.update({
          where: { id: appointment.id },
          data: {
            status: AppointmentStatus.CONFIRMED,
            googleCalendarEventId: calendarEventId,
          },
        });

        return { outcome: 'CONFIRMED', appointmentId: appointment.id };
      }

      case 'NON': {
        // Module 20: Refusal SMS to patient
        const refuseMsg =
          "Bonjour, le créneau demandé n'est malheureusement plus disponible. \n" +
          "Merci de rappeler le cabinet pour convenir d'un autre horaire.\n Cordialement.";

        await NotificationService.queueNotification({
          businessId: business.id,
          recipient: patientPhone,
          message: refuseMsg,
          from: business.inboundPhoneNumber || env.CABINET_INBOUND_PHONE,
        });

        // Module 23: Update row to REFUSED
        await db.appointment.update({
          where: { id: appointment.id },
          data: { status: AppointmentStatus.REFUSED },
        });

        return { outcome: 'REFUSED', appointmentId: appointment.id };
      }

      case 'AUTRE': {
        const proposedTime = classification.proposedTime || '19h00';

        // Module 44: Send proposed alternate time SMS to patient
        const rescheduleMsg =
          `l'infirmière vous proposerez une autre heure à ${proposedTime}\n` +
          `repondre avec juste:\nOUI\nNON\n` +
          `si vous voulez une autre rendez-vous merci de rappler l'assitance`;

        await NotificationService.queueNotification({
          businessId: business.id,
          recipient: patientPhone,
          message: rescheduleMsg,
          from: business.inboundPhoneNumber || env.CABINET_INBOUND_PHONE,
        });

        await db.appointment.update({
          where: { id: appointment.id },
          data: {
            status: AppointmentStatus.RESCHEDULE_PROPOSED,
            proposedNewTime: proposedTime,
          },
        });

        return { outcome: 'RESCHEDULE_PROPOSED', appointmentId: appointment.id, proposedTime };
      }

      case 'NONE':
      default:
        console.log(`[AppointmentConfirmation] Irrelevant SMS ignored: "${params.body}"`);
        return { outcome: 'NONE', appointmentId: appointment.id };
    }
  }
}
