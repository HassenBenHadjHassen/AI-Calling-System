import { db } from '../db';
import { normalizePhoneNumber } from '../validation/phone';
import { twilioClient } from '../integrations/twilio';
import { googleCalendar } from '../integrations/google-calendar';
import { NotificationService } from './notifications.service';
import { VapiIntegration, VAPI_STRUCTURED_OUTPUT_IDS } from '../integrations/vapi';
import { VapiServerMessagePayload } from '../validation/schemas';
import { AppointmentStatus, LineType } from '@prisma/client';
import { env } from '../env';
import { TenantService } from './tenant.service';

export class PatientIntakeService {
  /**
   * Processes end-of-call patient intake from Vapi.
   * Reproduces patient-info.json.
   */
  static async processIntake(payload: VapiServerMessagePayload) {
    const rawCaller = VapiIntegration.extractCallerNumber(payload);
    const callerNumber = normalizePhoneNumber(rawCaller);
    const vapiCallId = payload.message.call?.id || `call_${Date.now()}`;
    const assistantId = payload.message.call?.assistantId || payload.message.assistant?.id || '';

    // 1. Resolve Business Tenant (Cabinet Michelle - auto-bootstraps if not seeded)
    const business = await TenantService.ensureTenant('CABINET_MICHELLE');

    const alertPhone = business.alertPhoneNumber || env.NURSE_ALERT_PHONE_NUMBER;

    // 2. Extract structured outputs
    const intakeData = (VapiIntegration.extractStructuredOutput(
      payload,
      VAPI_STRUCTURED_OUTPUT_IDS.PATIENT_INTAKE
    ) || {}) as {
      patient_name?: string;
      DATE?: string;
      date?: string;
      HEURE?: string;
      heure?: string;
      code_postal?: string;
      service_type?: string;
      urgency?: boolean | string;
    };

    const cancellationOutput = VapiIntegration.extractStructuredOutput(
      payload,
      VAPI_STRUCTURED_OUTPUT_IDS.CANCELLATION
    ) as boolean | string | { result?: string | boolean } | undefined;

    const scamScoreRaw = VapiIntegration.extractStructuredOutput(
      payload,
      VAPI_STRUCTURED_OUTPUT_IDS.SCAM_SCORE
    );

    const isCancellation =
      cancellationOutput === true ||
      cancellationOutput === 'true' ||
      (typeof cancellationOutput === 'object' && cancellationOutput?.result === 'true');

    const patientName = intakeData.patient_name || 'Inconnu';
    const dateStr = intakeData.DATE || intakeData.date || '';
    const heureStr = intakeData.HEURE || intakeData.heure || '';
    const postalCode = intakeData.code_postal || '';
    const serviceType = intakeData.service_type || 'Soins infirmiers';
    const isUrgent = intakeData.urgency === true || intakeData.urgency === 'true';
    const scamScore = scamScoreRaw !== undefined ? parseFloat(String(scamScoreRaw)) : 8;

    // 3. Upsert Contact & CallRecord
    const contact = await db.contact.upsert({
      where: {
        businessId_phoneNumber: {
          businessId: business.id,
          phoneNumber: callerNumber,
        },
      },
      update: {
        name: patientName !== 'Inconnu' ? patientName : undefined,
        postalCode: postalCode || undefined,
      },
      create: {
        businessId: business.id,
        phoneNumber: callerNumber,
        name: patientName,
        postalCode,
      },
    });

    const patient = await db.patient.upsert({
      where: { contactId: contact.id },
      update: { lastScamScore: scamScore },
      create: {
        businessId: business.id,
        contactId: contact.id,
        lastScamScore: scamScore,
      },
    });

    const callRecord = await db.callRecord.upsert({
      where: { vapiCallId },
      update: {
        summary: payload.message.artifact?.summary,
        structuredData: payload.message.artifact?.structuredOutputs || {},
      },
      create: {
        businessId: business.id,
        vapiCallId,
        assistantId,
        contactId: contact.id,
        callerNumber,
        summary: payload.message.artifact?.summary,
        structuredData: payload.message.artifact?.structuredOutputs || {},
      },
    });

    // 4. Branch: Cancellation (Route 2 in patient-info.json)
    if (isCancellation) {
      // Find latest pending appointment or create cancelled appointment
      const existingAppt = await db.appointment.findFirst({
        where: {
          businessId: business.id,
          contactId: contact.id,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingAppt) {
        await db.appointment.update({
          where: { id: existingAppt.id },
          data: { status: AppointmentStatus.CANCELLED },
        });
      }

      // Module 51: Send SMS alert to nurse
      const smsBody = `ANNULATION DE RDV \nclient info:\nnom: ${patientName}\nsoin: ${serviceType}\ndate: ${dateStr}\nheure: ${heureStr}\nnumero: ${callerNumber}`;
      await NotificationService.queueNotification({
        businessId: business.id,
        recipient: alertPhone,
        message: smsBody,
      });

      return { outcome: 'CANCELLED', callRecordId: callRecord.id };
    }

    // 5. Branch: Normal Intake (Route 1 in patient-info.json)
    // Parse appointment start/end datetime
    let startTime = new Date();
    let endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    try {
      if (dateStr) {
        const parsed = googleCalendar.parseAppointmentDateTime(dateStr, heureStr);
        startTime = parsed.start;
        endTime = parsed.end;
      }
    } catch (e) {
      console.warn('[PatientIntake] Could not parse date/time, using defaults:', e);
    }

    // Module 36: Twilio Lookup API line type intelligence
    const lineInfo = await twilioClient.lookupLineType(callerNumber);
    const lineType =
      lineInfo.type === 'mobile'
        ? LineType.MOBILE
        : lineInfo.type === 'landline'
        ? LineType.LANDLINE
        : LineType.UNKNOWN;

    await db.contact.update({
      where: { id: contact.id },
      data: { lineType },
    });

    // Check scam score condition (Route 3 under mobile)
    let initialStatus: AppointmentStatus = AppointmentStatus.PENDING;
    if (scamScore <= 3) {
      initialStatus = AppointmentStatus.SCAM;
    } else if (isUrgent && lineType === LineType.MOBILE) {
      initialStatus = AppointmentStatus.CONFIRMED_URGENT;
    } else if (lineType === LineType.LANDLINE) {
      initialStatus = AppointmentStatus.PENDING_LANDLINE;
    }

    // Create Appointment record
    const appointment = await db.appointment.create({
      data: {
        businessId: business.id,
        contactId: contact.id,
        patientId: patient.id,
        callRecordId: callRecord.id,
        serviceType,
        date: dateStr,
        time: heureStr,
        startTime,
        endTime,
        status: initialStatus,
        urgency: isUrgent,
        scamScore,
      },
    });

    // Sub-branches for notifications
    if (lineType === LineType.MOBILE) {
      if (isUrgent) {
        // Module 18: Urgent mobile notification
        const urgentMsg = "c'est un urgent condition\nrapeller le patient\n";
        await NotificationService.queueNotification({
          businessId: business.id,
          recipient: alertPhone,
          message: urgentMsg,
        });
      } else if (scamScore >= 5) {
        // Module 22: RDV prompt with OPTION 1.OUI 2.NON
        const rdvMsg =
          `bonjour nouveau patient:\n` +
          `DATE:${dateStr}   à${heureStr}\n` +
          `NOM:${patientName}\n` +
          `Service:${serviceType}\n` +
          `code postale:\n${postalCode}\n` +
          `numero :${callerNumber}\n\n` +
          `OPTION:\n1.OUI\n2.NON\n\n`;

        await NotificationService.queueNotification({
          businessId: business.id,
          recipient: alertPhone,
          message: rdvMsg,
        });
      }
      // If scamScore <= 3: Module 31 updates to SCAM, no SMS sent
    } else if (lineType === LineType.LANDLINE) {
      // Module 37: Landline notification
      const landlineMsg =
        `Le cleint vient d'appeler d'une nunemro FIXE ces infos:\n` +
        `tu le rappeleras sur le numero :${callerNumber}\n\n` +
        `DATE:\n${dateStr}   à${heureStr}\n` +
        `NOM:${patientName}\n` +
        `Service:${serviceType}\n`;

      await NotificationService.queueNotification({
        businessId: business.id,
        recipient: alertPhone,
        message: landlineMsg,
      });
    }

    return {
      outcome: initialStatus,
      appointmentId: appointment.id,
      callRecordId: callRecord.id,
    };
  }
}
