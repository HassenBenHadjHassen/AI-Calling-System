import { db } from '../db';
import { normalizePhoneNumber } from '../validation/phone';
import { twilioClient } from '../integrations/twilio';
import { InternalCalendarService, BLOCKING_APPOINTMENT_STATUSES } from './internal-calendar.service';
import { CalendarAvailabilityService } from './calendar-availability.service';
import { NotificationService } from './notifications.service';
import { VapiIntegration, VAPI_STRUCTURED_OUTPUT_IDS } from '../integrations/vapi';
import { VapiServerMessagePayload, DirectPatientSubmissionPayload } from '../validation/schemas';
import {
  AppointmentStatus,
  LineType,
  ServiceRequestCategory,
  ServiceRequestStatus,
  PatientRequestType,
  PatientRequestStatus,
} from '@prisma/client';
import { env } from '../env';
import { TenantService } from './tenant.service';
import { logger } from '../logger';

export interface SubmitPatientRequestParams {
  callerNumber: string;
  assistantId?: string;
  vapiCallId?: string;
  patientName: string;
  date?: string;
  time?: string;
  serviceType?: string;
  postalCode?: string;
  urgency?: boolean | string;
  notes?: string;
  message?: string;
  isCancellation?: boolean;
}

export type DirectSubmissionResult =
  | {
      success: true;
      requestId: string;
      requestType: 'appointment' | 'cancellation' | 'message';
      status: string;
      message: string;
      isDuplicate?: boolean;
    }
  | {
      success: false;
      status: number;
      error: string;
      message: string;
      conflict?: boolean;
    };

export class PatientIntakeService {
  /**
   * Processes live or mid-call patient requests (submit_patient_request).
   * Records contact, call record, and creates/updates appointment or message request.
   */
  static async submitPatientRequest(params: SubmitPatientRequestParams) {
    const callerNumber = normalizePhoneNumber(params.callerNumber);
    const vapiCallId = params.vapiCallId || `call_tool_${Date.now()}`;
    const log = logger.child({
      module: 'PATIENT_INTAKE:SubmitRequest',
      correlationId: `vapi_${vapiCallId}`,
    });

    log.info('[SubmitPatientRequest] Processing request', {
      callerNumber,
      patientName: params.patientName,
      date: params.date,
      time: params.time,
      isCancellation: params.isCancellation,
    });

    const business = await TenantService.ensureTenant('CABINET_MICHELLE');
    const alertPhone = business.alertPhoneNumber || env.NURSE_ALERT_PHONE_NUMBER;

    // 1. Upsert Contact & Patient
    const contact = await db.contact.upsert({
      where: {
        businessId_phoneNumber: {
          businessId: business.id,
          phoneNumber: callerNumber,
        },
      },
      update: {
        name: params.patientName !== 'Inconnu' ? params.patientName : undefined,
        postalCode: params.postalCode || undefined,
      },
      create: {
        businessId: business.id,
        phoneNumber: callerNumber,
        name: params.patientName,
        postalCode: params.postalCode,
      },
    });

    const patient = await db.patient.upsert({
      where: { contactId: contact.id },
      update: {},
      create: {
        businessId: business.id,
        contactId: contact.id,
      },
    });

    const callRecord = await db.callRecord.upsert({
      where: { vapiCallId },
      update: {
        summary: params.notes || params.message,
      },
      create: {
        businessId: business.id,
        vapiCallId,
        assistantId: params.assistantId || env.CABINET_ASSISTANT_ID,
        contactId: contact.id,
        callerNumber,
        summary: params.notes || params.message,
      },
    });

    // 2. Cancellation Request branch (Pending review, NEVER cancelled immediately)
    if (params.isCancellation) {
      const existingAppt = await db.appointment.findFirst({
        where: {
          businessId: business.id,
          contactId: contact.id,
          status: {
            in: [
              AppointmentStatus.PENDING,
              AppointmentStatus.PENDING_LANDLINE,
              AppointmentStatus.CONFIRMED,
              AppointmentStatus.CONFIRMED_URGENT,
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingAppt) {
        const existingNotes = existingAppt.notes ? `${existingAppt.notes}\n` : '';
        await db.appointment.update({
          where: { id: existingAppt.id },
          data: {
            notes: `${existingNotes}[DEMANDE D'ANNULATION EN ATTENTE] Demandée le ${new Date().toLocaleDateString('fr-FR')}. En attente de confirmation par Mme MICHEL.`,
          },
        });
      }

      const serviceReq = await db.serviceRequest.create({
        data: {
          businessId: business.id,
          contactId: contact.id,
          callRecordId: callRecord.id,
          vapiCallId,
          category: ServiceRequestCategory.ANNULATION,
          status: ServiceRequestStatus.NOT_COMPLETED,
          serviceType: params.serviceType || 'Demande d\'annulation',
          message: `Demande d'annulation pour ${params.patientName} (${callerNumber}) - RDV prévu le ${params.date || existingAppt?.date || 'N/A'} à ${params.time || existingAppt?.time || 'N/A'}. En attente de confirmation par Mme MICHEL.`,
        },
      });

      const smsBody =
        `DEMANDE D'ANNULATION DE RDV (À CONFIRMER)\n` +
        `Patient: ${params.patientName}\n` +
        `Soin: ${params.serviceType || 'Soins infirmiers'}\n` +
        `Date: ${params.date || existingAppt?.date || 'Non précisée'} à ${params.time || existingAppt?.time || 'Non précisée'}\n` +
        `Numéro: ${callerNumber}\n` +
        `Action: À confirmer/valider par Mme MICHEL`;

      await NotificationService.queueNotification({
        businessId: business.id,
        recipient: alertPhone,
        message: smsBody,
      });

      return {
        outcome: 'PENDING_CANCELLATION',
        appointmentId: existingAppt?.id,
        serviceRequestId: serviceReq.id,
        callRecordId: callRecord.id,
      };
    }

    // 3. Message-only branch (Save message and alert nurse without creating an appointment)
    const isMessageOnly =
      Boolean(params.message) &&
      (!params.date || params.serviceType?.toLowerCase().includes('message'));

    if (isMessageOnly) {
      const messageText = params.message || 'Message laissé par le patient';
      const serviceReq = await db.serviceRequest.create({
        data: {
          businessId: business.id,
          contactId: contact.id,
          callRecordId: callRecord.id,
          vapiCallId,
          category: ServiceRequestCategory.MESSAGE,
          status: ServiceRequestStatus.MESSAGE,
          serviceType: params.serviceType || 'Message pour le cabinet',
          message: messageText,
        },
      });

      const messageAlert =
        `NOUVEAU MESSAGE PATIENT\n` +
        `De: ${params.patientName} (${callerNumber})\n` +
        `Message:\n${messageText}\n`;

      await NotificationService.queueNotification({
        businessId: business.id,
        recipient: alertPhone,
        message: messageAlert,
      });

      return {
        outcome: 'MESSAGE_SAVED',
        serviceRequestId: serviceReq.id,
        callRecordId: callRecord.id,
      };
    }

    // 4. Normal Appointment branch
    let startTime = new Date();
    let endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    if (params.date) {
      try {
        const parsed = InternalCalendarService.parseAppointmentDateTime(
          params.date,
          params.time
        );
        startTime = parsed.start;
        endTime = parsed.end;
      } catch (e) {
        log.warn('Could not parse appointment date/time, using defaults:', { error: e });
      }
    }

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

    const isUrgent = params.urgency === true || params.urgency === 'true';
    let initialStatus: AppointmentStatus = AppointmentStatus.PENDING;
    if (lineType === LineType.LANDLINE) {
      initialStatus = AppointmentStatus.PENDING_LANDLINE;
    }

    // Reuse or update existing appointment for this callRecord
    let appointment = await db.appointment.findFirst({
      where: { callRecordId: callRecord.id },
    });

    if (appointment) {
      appointment = await db.appointment.update({
        where: { id: appointment.id },
        data: {
          serviceType: params.serviceType || appointment.serviceType,
          date: params.date || appointment.date,
          time: params.time || appointment.time,
          startTime,
          endTime,
          urgency: isUrgent,
          status: initialStatus,
          notes: params.notes || appointment.notes,
        },
      });
    } else {
      appointment = await db.appointment.create({
        data: {
          businessId: business.id,
          contactId: contact.id,
          patientId: patient.id,
          callRecordId: callRecord.id,
          serviceType: params.serviceType || 'Soins infirmiers',
          date: params.date || '',
          time: params.time || '',
          startTime,
          endTime,
          status: initialStatus,
          urgency: isUrgent,
          notes: params.notes,
        },
      });
    }

    // Dispatch appropriate notification
    if (lineType === LineType.MOBILE) {
      if (isUrgent) {
        const urgentMsg = "c'est un urgent condition\nrapeller le patient\n";
        await NotificationService.queueNotification({
          businessId: business.id,
          recipient: alertPhone,
          message: urgentMsg,
        });
      } else {
        const rdvMsg =
          `bonjour nouveau patient:\n` +
          `DATE:${params.date || ''}   à${params.time || ''}\n` +
          `NOM:${params.patientName}\n` +
          `Service:${params.serviceType || 'Soins infirmiers'}\n` +
          `code postale:\n${params.postalCode || ''}\n` +
          `numero :${callerNumber}\n\n` +
          `OPTION:\n1.OUI\n2.NON\n\n`;

        await NotificationService.queueNotification({
          businessId: business.id,
          recipient: alertPhone,
          message: rdvMsg,
        });
      }
    } else if (lineType === LineType.LANDLINE) {
      const landlineMsg =
        `Le cleint vient d'appeler d'une nunemro FIXE ces infos:\n` +
        `tu le rappeleras sur le numero :${callerNumber}\n\n` +
        `DATE:\n${params.date || ''}   à${params.time || ''}\n` +
        `NOM:${params.patientName}\n` +
        `Service:${params.serviceType || 'Soins infirmiers'}\n`;

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

  /**
   * Handles Format A: Direct patient submission from Vapi API Request tool (submit_patient_request).
   * Validates business hours and availability for appointments, enforces idempotency,
   * records PatientRequest, Contact, CallRecord within a Prisma transaction,
   * ensures urgent requests remain PENDING, and queues notifications ONLY after transaction commit.
   */
  static async handleDirectSubmission(
    payload: DirectPatientSubmissionPayload
  ): Promise<DirectSubmissionResult> {
    const vapiCallId = payload.callId;
    let callerNumber = '';
    try {
      callerNumber = normalizePhoneNumber(payload.caller);
    } catch {
      return {
        success: false,
        status: 400,
        error: 'INVALID_PHONE_NUMBER',
        message: 'Invalid French phone number provided for caller',
      };
    }

    const log = logger.child({
      module: 'PATIENT_INTAKE:DirectSubmission',
      correlationId: `vapi_${vapiCallId}`,
    });

    log.info('[DirectSubmission] Received patient submission', {
      vapiCallId,
      requestType: payload.requestType,
      date: payload.requestedDate,
      time: payload.requestedTime,
    });

    // 1. Resolve Tenant for Cabinet MICHEL
    const business = await TenantService.ensureTenant('CABINET_MICHELLE');
    const alertPhone = business.alertPhoneNumber || env.NURSE_ALERT_PHONE_NUMBER;

    // 2. Map requestType enum
    const mappedType: PatientRequestType =
      payload.requestType === 'appointment'
        ? PatientRequestType.APPOINTMENT
        : payload.requestType === 'cancellation'
        ? PatientRequestType.CANCELLATION
        : PatientRequestType.MESSAGE;

    // 2b. Check if this request was ALREADY submitted for this callId (Idempotency pre-check)
    const existingPrecheck = await db.patientRequest.findUnique({
      where: {
        vapiCallId_requestType: {
          vapiCallId,
          requestType: mappedType,
        },
      },
    });

    if (existingPrecheck) {
      // Check for materially different request data on repeated submission
      const isMateriallyDifferent =
        (payload.requestedDate && existingPrecheck.requestedDate && payload.requestedDate !== existingPrecheck.requestedDate) ||
        (payload.requestedTime && existingPrecheck.requestedTime && payload.requestedTime !== existingPrecheck.requestedTime) ||
        (payload.patientName && existingPrecheck.patientName && payload.patientName !== existingPrecheck.patientName && existingPrecheck.patientName !== 'Inconnu') ||
        (payload.summary && existingPrecheck.summary && payload.summary !== existingPrecheck.summary);

      if (isMateriallyDifferent) {
        return {
          success: false,
          status: 409,
          error: 'IDEMPOTENCY_CONFLICT',
          message: 'The same call ID was submitted with different request details.',
        };
      }

      log.info('[DirectSubmission] Idempotent replay: returning existing request record', {
        requestId: existingPrecheck.id,
        vapiCallId,
        requestType: existingPrecheck.requestType,
      });

      return {
        success: true,
        requestId: existingPrecheck.id,
        requestType: payload.requestType,
        status: existingPrecheck.status,
        message: "The patient's request has already been saved and is awaiting review.",
        isDuplicate: true,
      };
    }

    // 3. Pre-transaction validation for appointments
    let start: Date | undefined;
    let end: Date | undefined;

    if (payload.requestType === 'appointment') {
      try {
        const parsed = InternalCalendarService.parseAppointmentDateTime(
          payload.requestedDate,
          payload.requestedTime
        );
        start = parsed.start;
        end = parsed.end;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          status: 400,
          error: 'INVALID_DATETIME',
          message: `Invalid date or time format: ${msg}`,
        };
      }

      // Check if date is in the past
      const now = new Date();
      if (start.getTime() < now.getTime()) {
        return {
          success: false,
          status: 400,
          error: 'PAST_DATETIME',
          message: 'Requested appointment date and time must be in the future.',
        };
      }

      // Check business hours & availability honoring configured CALENDAR_PROVIDER
      const availability = await CalendarAvailabilityService.checkDirectAvailability({
        start,
        end,
        businessId: business.id,
        calendarId: business.calendarId || env.CABINET_CALENDAR_ID,
        enforceHours: true,
      });

      if (!availability.isAvailable) {
        if (availability.reason === 'outside_business_hours') {
          return {
            success: false,
            status: 409,
            conflict: true,
            error: 'OUTSIDE_BUSINESS_HOURS',
            message:
              'The requested time is outside clinic opening hours. The clinic is open Monday to Friday from 09:00 to 13:00 and 14:00 to 18:00.',
          };
        }

        if (availability.reason === 'verification_failed') {
          return {
            success: false,
            status: 503,
            error: 'CALENDAR_VERIFICATION_FAILED',
            message: 'Unable to verify calendar availability. Please try again later.',
          };
        }

        return {
          success: false,
          status: 409,
          conflict: true,
          error: 'SLOT_CONFLICT',
          message: 'The requested appointment slot is no longer available.',
        };
      }
    }

    // 4. Line lookup before database transaction
    const lineInfo = await twilioClient.lookupLineType(callerNumber);
    const lineType =
      lineInfo.type === 'mobile'
        ? LineType.MOBILE
        : lineInfo.type === 'landline'
        ? LineType.LANDLINE
        : LineType.UNKNOWN;

    // 5. Transactional Execution
    interface TxNotificationPlan {
      type: 'appointment' | 'cancellation' | 'message';
      lineType?: LineType;
      isUrgent?: boolean;
      smsBody?: string;
    }

    interface TxResult {
      isDuplicate: boolean;
      requestId: string;
      requestType: 'appointment' | 'cancellation' | 'message';
      status: string;
      message: string;
      notification?: TxNotificationPlan;
    }

    let txResult: TxResult;

    try {
      const txRunner = typeof db.$transaction === 'function'
        ? (fn: (tx: any) => Promise<any>) => db.$transaction(fn)
        : (fn: (tx: any) => Promise<any>) => fn(db);

      txResult = await txRunner(async (tx) => {
        // A. Idempotency Check inside transaction
        const existing = await tx.patientRequest.findUnique({
          where: {
            vapiCallId_requestType: {
              vapiCallId,
              requestType: mappedType,
            },
          },
          include: { appointment: true, serviceRequest: true },
        });

        if (existing) {
          // Check for materially different request data on repeated submission
          const isMateriallyDifferent =
            (payload.requestedDate && existing.requestedDate && payload.requestedDate !== existing.requestedDate) ||
            (payload.requestedTime && existing.requestedTime && payload.requestedTime !== existing.requestedTime) ||
            (payload.patientName && existing.patientName && payload.patientName !== existing.patientName && existing.patientName !== 'Inconnu') ||
            (payload.summary && existing.summary && payload.summary !== existing.summary);

          if (isMateriallyDifferent) {
            const err = new Error('The same call ID was submitted with different request details.');
            (err as any).statusCode = 409;
            (err as any).errorCode = 'IDEMPOTENCY_CONFLICT';
            throw err;
          }

          log.info('[DirectSubmission] Idempotent replay: returning existing request record', {
            requestId: existing.id,
            vapiCallId,
            requestType: existing.requestType,
          });

          return {
            isDuplicate: true,
            requestId: existing.id,
            requestType: payload.requestType,
            status: existing.status,
            message: "The patient's request has already been saved and is awaiting review.",
          };
        }

        // B. Re-check slot collision inside transaction to prevent concurrent bookings
        if (payload.requestType === 'appointment' && start && end) {
          const dbConflict = await tx.appointment.findFirst({
            where: {
              businessId: business.id,
              status: { in: BLOCKING_APPOINTMENT_STATUSES },
              startTime: { lt: end },
              endTime: { gt: start },
            },
          });

          if (dbConflict) {
            const err = new Error('The requested appointment slot is already being booked by another caller.');
            (err as any).statusCode = 409;
            (err as any).errorCode = 'SLOT_CONFLICT';
            throw err;
          }

          const pendingReqConflict = await tx.patientRequest.findFirst({
            where: {
              businessId: business.id,
              requestType: PatientRequestType.APPOINTMENT,
              status: { in: [PatientRequestStatus.PENDING, PatientRequestStatus.CONFIRMED] },
              requestedDate: payload.requestedDate,
              requestedTime: payload.requestedTime,
              vapiCallId: { not: vapiCallId },
            },
          });

          if (pendingReqConflict) {
            const err = new Error('The requested appointment slot is already being booked by another caller.');
            (err as any).statusCode = 409;
            (err as any).errorCode = 'SLOT_CONFLICT';
            throw err;
          }
        }

        // C. Contact & Patient upsert
        const contact = await tx.contact.upsert({
          where: {
            businessId_phoneNumber: {
              businessId: business.id,
              phoneNumber: callerNumber,
            },
          },
          update: {
            name: payload.patientName && payload.patientName !== 'Inconnu' ? payload.patientName : undefined,
            postalCode: payload.postalCode || undefined,
            lineType,
          },
          create: {
            businessId: business.id,
            phoneNumber: callerNumber,
            name: payload.patientName || 'Inconnu',
            postalCode: payload.postalCode || undefined,
            lineType,
          },
        });

        const patient = await tx.patient.upsert({
          where: { contactId: contact.id },
          update: {},
          create: {
            businessId: business.id,
            contactId: contact.id,
          },
        });

        // D. CallRecord upsert
        const callRecord = await tx.callRecord.upsert({
          where: { vapiCallId },
          update: {
            summary: payload.summary,
          },
          create: {
            businessId: business.id,
            vapiCallId,
            assistantId: env.CABINET_ASSISTANT_ID,
            contactId: contact.id,
            callerNumber,
            summary: payload.summary,
          },
        });

        // E. Branch: APPOINTMENT
        if (payload.requestType === 'appointment' && start && end) {
          const isUrgent = payload.urgency === true || payload.urgency === 'true';
          // Urgency is represented separately; status is ALWAYS PENDING or PENDING_LANDLINE
          const initialStatus: AppointmentStatus =
            lineType === LineType.LANDLINE
              ? AppointmentStatus.PENDING_LANDLINE
              : AppointmentStatus.PENDING;

          const appointment = await tx.appointment.create({
            data: {
              businessId: business.id,
              contactId: contact.id,
              patientId: patient.id,
              callRecordId: callRecord.id,
              serviceType: payload.serviceType,
              date: payload.requestedDate,
              time: payload.requestedTime,
              startTime: start,
              endTime: end,
              status: initialStatus,
              urgency: isUrgent,
              notes: payload.summary || undefined,
            },
          });

          const patientRequest = await tx.patientRequest.create({
            data: {
              businessId: business.id,
              vapiCallId,
              callerNumber,
              patientName: payload.patientName,
              requestType: PatientRequestType.APPOINTMENT,
              postalCode: payload.postalCode,
              serviceType: payload.serviceType,
              requestedDate: payload.requestedDate,
              requestedTime: payload.requestedTime,
              summary: payload.summary,
              urgency: isUrgent,
              status: PatientRequestStatus.PENDING,
              contactId: contact.id,
              callRecordId: callRecord.id,
              appointmentId: appointment.id,
            },
          });

          return {
            isDuplicate: false,
            requestId: patientRequest.id,
            requestType: 'appointment' as const,
            status: 'PENDING',
            message: "The patient's request has been saved and is awaiting review.",
            notification: {
              type: 'appointment',
              lineType,
              isUrgent,
            },
          };
        }

        // F. Branch: CANCELLATION
        if (payload.requestType === 'cancellation') {
          const existingAppt = await tx.appointment.findFirst({
            where: {
              businessId: business.id,
              contactId: contact.id,
              status: { in: BLOCKING_APPOINTMENT_STATUSES },
            },
            orderBy: { createdAt: 'desc' },
          });

          if (existingAppt) {
            const existingNotes = existingAppt.notes ? `${existingAppt.notes}\n` : '';
            await tx.appointment.update({
              where: { id: existingAppt.id },
              data: {
                notes: `${existingNotes}[DEMANDE D'ANNULATION EN ATTENTE] Demandée le ${new Date().toLocaleDateString('fr-FR')}. En attente de confirmation par Mme MICHEL.`,
              },
            });
          }

          const serviceReq = await tx.serviceRequest.create({
            data: {
              businessId: business.id,
              contactId: contact.id,
              callRecordId: callRecord.id,
              vapiCallId,
              category: ServiceRequestCategory.ANNULATION,
              status: ServiceRequestStatus.NOT_COMPLETED,
              serviceType: payload.serviceType || 'Demande d\'annulation',
              message: `Demande d'annulation pour ${payload.patientName || contact.name} (${callerNumber}) - RDV prévu le ${payload.requestedDate || existingAppt?.date || 'N/A'} à ${payload.requestedTime || existingAppt?.time || 'N/A'}. En attente de confirmation par Mme MICHEL.`,
            },
          });

          const patientRequest = await tx.patientRequest.create({
            data: {
              businessId: business.id,
              vapiCallId,
              callerNumber,
              patientName: payload.patientName || contact.name,
              requestType: PatientRequestType.CANCELLATION,
              postalCode: payload.postalCode,
              serviceType: payload.serviceType,
              requestedDate: payload.requestedDate || existingAppt?.date,
              requestedTime: payload.requestedTime || existingAppt?.time,
              summary: payload.summary || serviceReq.message,
              status: PatientRequestStatus.PENDING,
              contactId: contact.id,
              callRecordId: callRecord.id,
              appointmentId: existingAppt?.id,
              serviceRequestId: serviceReq.id,
            },
          });

          const smsBody =
            `DEMANDE D'ANNULATION DE RDV (À CONFIRMER)\n` +
            `Patient: ${payload.patientName || contact.name}\n` +
            `Soin: ${payload.serviceType || 'Soins infirmiers'}\n` +
            `Date: ${payload.requestedDate || existingAppt?.date || 'Non précisée'} à ${payload.requestedTime || existingAppt?.time || 'Non précisée'}\n` +
            `Numéro: ${callerNumber}\n` +
            `Action: À confirmer/valider par Mme MICHEL`;

          return {
            isDuplicate: false,
            requestId: patientRequest.id,
            requestType: 'cancellation' as const,
            status: 'PENDING',
            message: "The patient's request has been saved and is awaiting review.",
            notification: {
              type: 'cancellation',
              smsBody,
            },
          };
        }

        // G. Branch: MESSAGE
        const serviceReq = await tx.serviceRequest.create({
          data: {
            businessId: business.id,
            contactId: contact.id,
            callRecordId: callRecord.id,
            vapiCallId,
            category: ServiceRequestCategory.MESSAGE,
            status: ServiceRequestStatus.MESSAGE,
            serviceType: payload.serviceType || 'Message pour le cabinet',
            message: payload.summary || 'Message laissé par le patient',
          },
        });

        const patientRequest = await tx.patientRequest.create({
          data: {
            businessId: business.id,
            vapiCallId,
            callerNumber,
            patientName: payload.patientName || contact.name,
            requestType: PatientRequestType.MESSAGE,
            summary: payload.summary,
            status: PatientRequestStatus.PENDING,
            contactId: contact.id,
            callRecordId: callRecord.id,
            serviceRequestId: serviceReq.id,
          },
        });

        const messageAlert =
          `NOUVEAU MESSAGE PATIENT\n` +
          `De: ${payload.patientName || contact.name} (${callerNumber})\n` +
          `Message:\n${payload.summary}\n`;

        return {
          isDuplicate: false,
          requestId: patientRequest.id,
          requestType: 'message' as const,
          status: 'PENDING',
          message: "The patient's request has been saved and is awaiting review.",
          notification: {
            type: 'message',
            smsBody: messageAlert,
          },
        };
      });
    } catch (txErr: any) {
      if (txErr?.errorCode === 'IDEMPOTENCY_CONFLICT') {
        return {
          success: false,
          status: 409,
          error: 'IDEMPOTENCY_CONFLICT',
          message: txErr.message,
        };
      }

      if (txErr?.errorCode === 'SLOT_CONFLICT') {
        return {
          success: false,
          status: 409,
          conflict: true,
          error: 'SLOT_CONFLICT',
          message: txErr.message,
        };
      }

      // Handle race condition unique constraint collision (P2002 on vapiCallId_requestType)
      if (txErr?.code === 'P2002') {
        const existing = await db.patientRequest.findUnique({
          where: {
            vapiCallId_requestType: {
              vapiCallId,
              requestType: mappedType,
            },
          },
        });

        if (existing) {
          return {
            success: true,
            requestId: existing.id,
            requestType: payload.requestType,
            status: existing.status,
            message: "The patient's request has already been saved and is awaiting review.",
            isDuplicate: true,
          };
        }
      }

      log.error('[DirectSubmission Persistence Failure]', { error: txErr });
      return {
        success: false,
        status: 500,
        error: 'PERSISTENCE_FAILED',
        message: 'Failed to safely persist patient request.',
      };
    }

    // 6. Queue Nurse Notification strictly AFTER transaction commit
    if (!txResult.isDuplicate && txResult.notification) {
      try {
        const notif = txResult.notification;
        if (notif.type === 'appointment') {
          if (notif.lineType === LineType.MOBILE) {
            if (notif.isUrgent) {
              const urgentMsg = "c'est un urgent condition\nrapeller le patient\n";
              await NotificationService.queueNotification({
                businessId: business.id,
                recipient: alertPhone,
                message: urgentMsg,
              });
            } else {
              const rdvMsg =
                `bonjour nouveau patient:\n` +
                `DATE:${payload.requestedDate}   à${payload.requestedTime}\n` +
                `NOM:${payload.patientName}\n` +
                `Service:${payload.serviceType}\n` +
                `code postale:\n${payload.postalCode || ''}\n` +
                `numero :${callerNumber}\n\n` +
                `OPTION:\n1.OUI\n2.NON\n\n`;

              await NotificationService.queueNotification({
                businessId: business.id,
                recipient: alertPhone,
                message: rdvMsg,
              });
            }
          } else if (notif.lineType === LineType.LANDLINE) {
            const landlineMsg =
              `Le cleint vient d'appeler d'une nunemro FIXE ces infos:\n` +
              `tu le rappeleras sur le numero :${callerNumber}\n\n` +
              `DATE:\n${payload.requestedDate}   à${payload.requestedTime}\n` +
              `NOM:${payload.patientName}\n` +
              `Service:${payload.serviceType}\n`;

            await NotificationService.queueNotification({
              businessId: business.id,
              recipient: alertPhone,
              message: landlineMsg,
            });
          }
        } else if (notif.smsBody) {
          await NotificationService.queueNotification({
            businessId: business.id,
            recipient: alertPhone,
            message: notif.smsBody,
          });
        }
      } catch (notifErr: unknown) {
        log.error('[DirectSubmission Notification Enqueue Failure]', { error: notifErr });
      }
    }

    return {
      success: true,
      requestId: txResult.requestId,
      requestType: txResult.requestType,
      status: txResult.status,
      message: txResult.message,
      ...(txResult.isDuplicate ? { isDuplicate: true } : {}),
    };
  }

  /**
   * Processes end-of-call patient intake from Vapi.
   * Reproduces patient-info.json and enriches information recorded during the call.
   */
  static async processIntake(payload: VapiServerMessagePayload) {
    const rawCaller = VapiIntegration.extractCallerNumber(payload);
    const callerNumber = normalizePhoneNumber(rawCaller);
    const vapiCallId = payload.message.call?.id || `call_${Date.now()}`;
    const assistantId = payload.message.call?.assistantId || payload.message.assistant?.id || '';

    const log = logger.child({
      module: 'PATIENT_INTAKE:PostCall',
      correlationId: `vapi_${vapiCallId}`,
    });

    log.info('[PatientIntake] Processing end-of-call report', {
      callerNumber,
      vapiCallId,
    });

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
      message?: string;
    };

    const cancellationOutput = VapiIntegration.extractStructuredOutput(
      payload,
      VAPI_STRUCTURED_OUTPUT_IDS.CANCELLATION
    ) as boolean | string | { result?: string | boolean } | undefined;

    const callOutcomeOutput = VapiIntegration.extractStructuredOutput(
      payload,
      VAPI_STRUCTURED_OUTPUT_IDS.CALL_OUTCOME
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

    // Determine if message-only (no appointment date, or explicit message outcome)
    const isMessageOnly =
      !isCancellation &&
      (callOutcomeOutput === true ||
        callOutcomeOutput === 'true' ||
        (typeof callOutcomeOutput === 'object' && callOutcomeOutput?.result === 'true') ||
        serviceType.toLowerCase().includes('message') ||
        serviceType.toLowerCase().includes('reclamation') ||
        serviceType.toLowerCase().includes('renseignement') ||
        (!dateStr && Boolean(intakeData.message || payload.message.artifact?.summary)));

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

    // Reconcile with any pre-call PatientRequest saved via direct tool submission
    const existingPatientRequest = db.patientRequest?.findFirst
      ? await db.patientRequest.findFirst({
          where: { vapiCallId },
          include: { appointment: true, serviceRequest: true },
        })
      : null;

    if (existingPatientRequest) {
      log.info('[PatientIntake] Found pre-call PatientRequest for callId', {
        requestId: existingPatientRequest.id,
        type: existingPatientRequest.requestType,
      });

      if (existingPatientRequest.requestType === PatientRequestType.MESSAGE) {
        log.info('[PatientIntake] Pre-call submission was MESSAGE, avoiding appointment creation');
        return {
          outcome: 'MESSAGE_SAVED',
          serviceRequestId: existingPatientRequest.serviceRequestId || undefined,
          callRecordId: callRecord.id,
          requestId: existingPatientRequest.id,
        };
      }

      if (existingPatientRequest.requestType === PatientRequestType.CANCELLATION) {
        log.info('[PatientIntake] Pre-call submission was CANCELLATION, preserving pending status');
        return {
          outcome: 'PENDING_CANCELLATION',
          appointmentId: existingPatientRequest.appointmentId || undefined,
          serviceRequestId: existingPatientRequest.serviceRequestId || undefined,
          callRecordId: callRecord.id,
          requestId: existingPatientRequest.id,
        };
      }

      if (existingPatientRequest.requestType === PatientRequestType.APPOINTMENT) {
        log.info('[PatientIntake] Pre-call submission was APPOINTMENT, enriching existing appointment');
        if (existingPatientRequest.appointmentId) {
          const appt = await db.appointment.findUnique({
            where: { id: existingPatientRequest.appointmentId },
          });
          if (appt) {
            const updated = await db.appointment.update({
              where: { id: appt.id },
              data: {
                scamScore: scamScore ?? appt.scamScore,
                notes: payload.message.artifact?.summary || appt.notes,
              },
            });
            return {
              outcome: updated.status,
              appointmentId: updated.id,
              callRecordId: callRecord.id,
              requestId: existingPatientRequest.id,
            };
          }
        }
      }
    }

    // 4. Branch: Cancellation (Recorded as pending request, NEVER cancelled immediately)
    if (isCancellation) {
      log.info('[PatientIntake] Processing cancellation request as PENDING review');

      const existingAppt = await db.appointment.findFirst({
        where: {
          businessId: business.id,
          contactId: contact.id,
          status: {
            in: [
              AppointmentStatus.PENDING,
              AppointmentStatus.PENDING_LANDLINE,
              AppointmentStatus.CONFIRMED,
              AppointmentStatus.CONFIRMED_URGENT,
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Update existing appointment notes without cancelling immediately
      if (existingAppt) {
        const existingNotes = existingAppt.notes ? `${existingAppt.notes}\n` : '';
        await db.appointment.update({
          where: { id: existingAppt.id },
          data: {
            notes: `${existingNotes}[DEMANDE D'ANNULATION EN ATTENTE] Demandée le ${new Date().toLocaleDateString('fr-FR')}. En attente de validation par Mme MICHEL.`,
          },
        });
      }

      // Record pending cancellation in ServiceRequest for traceability
      await db.serviceRequest.create({
        data: {
          businessId: business.id,
          contactId: contact.id,
          callRecordId: callRecord.id,
          vapiCallId,
          category: ServiceRequestCategory.ANNULATION,
          status: ServiceRequestStatus.NOT_COMPLETED,
          serviceType: serviceType || 'Demande d\'annulation',
          message: `Demande d'annulation pour ${patientName} (${callerNumber}) - RDV prévu le ${dateStr || existingAppt?.date || 'N/A'} à ${heureStr || existingAppt?.time || 'N/A'}. En attente de validation par Mme MICHEL.`,
        },
      });

      // Send SMS alert to nurse for manual review (with deduplication)
      const smsBody =
        `DEMANDE D'ANNULATION DE RDV (À CONFIRMER)\n` +
        `Patient: ${patientName}\n` +
        `Soin: ${serviceType}\n` +
        `Date: ${dateStr || existingAppt?.date || 'Non précisée'} à ${heureStr || existingAppt?.time || 'Non précisée'}\n` +
        `Numéro: ${callerNumber}\n` +
        `Action: À confirmer/valider par Mme MICHEL`;

      await NotificationService.queueNotification({
        businessId: business.id,
        recipient: alertPhone,
        message: smsBody,
      });

      return { outcome: 'PENDING_CANCELLATION', appointmentId: existingAppt?.id, callRecordId: callRecord.id };
    }

    // 5. Branch: Message-only calls (Save message without creating an appointment)
    if (isMessageOnly) {
      log.info('[PatientIntake] Processing message-only call (no appointment created)');

      const messageContent =
        intakeData.message ||
        payload.message.artifact?.summary ||
        `Message laissé par le patient ${patientName}`;

      let serviceReq = await db.serviceRequest.findFirst({
        where: { vapiCallId },
      });

      if (serviceReq) {
        serviceReq = await db.serviceRequest.update({
          where: { id: serviceReq.id },
          data: {
            message: messageContent,
            serviceType: serviceType || serviceReq.serviceType,
          },
        });
      } else {
        serviceReq = await db.serviceRequest.create({
          data: {
            businessId: business.id,
            contactId: contact.id,
            callRecordId: callRecord.id,
            vapiCallId,
            category: ServiceRequestCategory.MESSAGE,
            status: ServiceRequestStatus.MESSAGE,
            serviceType: serviceType || 'Message pour le cabinet',
            message: messageContent,
          },
        });
      }

      // Check if alert already sent to prevent duplicate notifications
      const recentNotification = await db.notificationJob.findFirst({
        where: {
          businessId: business.id,
          recipient: alertPhone,
          createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
          message: { contains: callerNumber },
        },
      });

      if (!recentNotification) {
        const messageSms =
          `NOUVEAU MESSAGE PATIENT\n` +
          `De: ${patientName} (${callerNumber})\n` +
          `Message:\n${messageContent}\n`;

        await NotificationService.queueNotification({
          businessId: business.id,
          recipient: alertPhone,
          message: messageSms,
        });
      }

      return {
        outcome: 'MESSAGE_SAVED',
        serviceRequestId: serviceReq.id,
        callRecordId: callRecord.id,
      };
    }

    // 6. Branch: Appointment Intake
    // Parse appointment start/end datetime
    let startTime = new Date();
    let endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    try {
      if (dateStr) {
        const parsed = InternalCalendarService.parseAppointmentDateTime(dateStr, heureStr);
        startTime = parsed.start;
        endTime = parsed.end;
      }
    } catch (e) {
      log.warn('Could not parse date/time, using defaults:', { error: e });
    }

    // Line type intelligence
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

    let initialStatus: AppointmentStatus = AppointmentStatus.PENDING;
    if (scamScore <= 3) {
      initialStatus = AppointmentStatus.SCAM;
    } else if (isUrgent && lineType === LineType.MOBILE) {
      initialStatus = AppointmentStatus.CONFIRMED_URGENT;
    } else if (lineType === LineType.LANDLINE) {
      initialStatus = AppointmentStatus.PENDING_LANDLINE;
    }

    // Reuse or update request already recorded by submit_patient_request for this call
    const existingAppt = await db.appointment.findFirst({
      where: {
        OR: [
          { callRecordId: callRecord.id },
          {
            businessId: business.id,
            contactId: contact.id,
            date: dateStr,
            time: heureStr,
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingAppt) {
      log.info(`[PatientIntake] Reusing existing appointment ${existingAppt.id} from submit_patient_request`);

      const updatedAppointment = await db.appointment.update({
        where: { id: existingAppt.id },
        data: {
          callRecordId: callRecord.id,
          patientId: patient.id,
          scamScore: scamScore ?? existingAppt.scamScore,
          urgency: isUrgent || existingAppt.urgency,
          notes: payload.message.artifact?.summary || existingAppt.notes,
          status: scamScore <= 3 ? AppointmentStatus.SCAM : existingAppt.status,
        },
      });

      // No duplicate notifications: submit_patient_request already handled notifications
      return {
        outcome: updatedAppointment.status,
        appointmentId: updatedAppointment.id,
        callRecordId: callRecord.id,
      };
    }

    // If not previously recorded by submit_patient_request, create new appointment
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

    // Check recent notifications for deduplication before sending
    const recentNotif = await db.notificationJob.findFirst({
      where: {
        businessId: business.id,
        recipient: alertPhone,
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        message: { contains: callerNumber },
      },
    });

    if (!recentNotif) {
      if (lineType === LineType.MOBILE) {
        if (isUrgent) {
          const urgentMsg = "c'est un urgent condition\nrapeller le patient\n";
          await NotificationService.queueNotification({
            businessId: business.id,
            recipient: alertPhone,
            message: urgentMsg,
          });
        } else if (scamScore >= 5) {
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
      } else if (lineType === LineType.LANDLINE) {
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
    }

    return {
      outcome: initialStatus,
      appointmentId: appointment.id,
      callRecordId: callRecord.id,
    };
  }
}
