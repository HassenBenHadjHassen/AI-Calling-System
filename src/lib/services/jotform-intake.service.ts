import { db } from '../db';
import { NotificationService } from './notifications.service';
import { JotformSubmissionPayload } from '../validation/schemas';
import { ServiceRequestStatus, Prisma } from '@prisma/client';
import { env } from '../env';

export class JotformIntakeService {
  /**
   * Processes JotForm submission enriched by Vapi CALL_ID.
   * Reproduces integration-google-forms-v2-jotform-crm-by-call-id.json.
   */
  static async processSubmission(payload: JotformSubmissionPayload) {
    const callId = payload.q14_callId?.trim();
    if (!callId) {
      console.warn('[JotformIntake] Submission missing q14_callId');
      return { handled: false, reason: 'Missing callId' };
    }

    // 1. Find existing ServiceRequest by vapiCallId
    const serviceRequest = await db.serviceRequest.findFirst({
      where: { vapiCallId: callId },
      include: { contact: true, business: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!serviceRequest) {
      console.warn(`[JotformIntake] No ServiceRequest found for callId: ${callId}`);
      return { handled: false, reason: 'ServiceRequest not found' };
    }

    // Check if already completed to prevent duplicate alerts
    const wasAlreadyCompleted = serviceRequest.status === ServiceRequestStatus.COMPLETED;

    const clientName = payload.q17_nomDe || serviceRequest.contact.name;
    const email = payload.q3_email || serviceRequest.email || '';
    const addrLine1 = payload.q4_adresse?.addr_line1 || '';
    const addrLine2 = payload.q4_adresse?.addr_line2 || '';
    const fullAddress = `${addrLine1} ${addrLine2}`.trim() || serviceRequest.address;
    const postalCode = payload.q4_adresse?.postal || serviceRequest.postalCode || '';

    // 2. Update ServiceRequest
    const updatedRequest = await db.serviceRequest.update({
      where: { id: serviceRequest.id },
      data: {
        status: ServiceRequestStatus.COMPLETED,
        address: fullAddress,
        postalCode,
        email,
        formSubmissionData: payload as unknown as Prisma.InputJsonValue,
      },
    });

    // 3. Update Contact
    await db.contact.update({
      where: { id: serviceRequest.contactId },
      data: {
        name: clientName,
        email: email || undefined,
        address: fullAddress || undefined,
        postalCode: postalCode || undefined,
      },
    });

    // 4. Module 24: Queue internal alert SMS to staff if not already completed
    if (!wasAlreadyCompleted) {
      const alertPhone = serviceRequest.business.alertPhoneNumber || env.BATIMENT_ALERT_PHONE_NUMBER;
      const senderPhone = serviceRequest.business.outboundPhoneNumber || env.BATIMENT_OUTBOUND_PHONE;

      const alertBody =
        `🚨 NOUVEAU DEVIS:\n\n` +
        `Client : ${clientName}\n` +
        `Tél : ${serviceRequest.contact.phoneNumber}\n` +
        `Email : ${email}\n` +
        `Motif : ${serviceRequest.serviceType || 'Devis'}\n` +
        `Adresse : ${addrLine1 || fullAddress}\n` +
        `code postal:${postalCode}\n` +
        `message:${serviceRequest.message || 'Aucun'}`;

      await NotificationService.queueNotification({
        businessId: serviceRequest.businessId,
        recipient: alertPhone,
        message: alertBody,
        from: senderPhone,
      });
    }

    return {
      handled: true,
      serviceRequestId: updatedRequest.id,
      wasAlreadyCompleted,
    };
  }
}
