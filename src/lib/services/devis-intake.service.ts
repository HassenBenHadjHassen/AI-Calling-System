import { db } from '../db';
import { NotificationService } from './notifications.service';
import { DevisSubmissionPayload } from '../validation/schemas';
import { ServiceRequestStatus, Prisma } from '@prisma/client';
import { env } from '../env';

export class DevisIntakeService {
  /**
   * Processes a native web form quote submission enriched by callId.
   * Updates Contact and ServiceRequest in PostgreSQL, marks COMPLETED,
   * and queues an internal SMS alert to Dani Bâtiment staff.
   */
  static async processSubmission(payload: DevisSubmissionPayload) {
    const callId = payload.callId?.trim();
    if (!callId) {
      console.warn('[DevisIntake] Submission missing callId');
      return { handled: false, reason: 'Missing callId' };
    }

    // 1. Find existing ServiceRequest by vapiCallId
    const serviceRequest = await db.serviceRequest.findFirst({
      where: { vapiCallId: callId },
      include: { contact: true, business: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!serviceRequest) {
      console.warn(`[DevisIntake] No ServiceRequest found for callId: ${callId}`);
      return { handled: false, reason: 'ServiceRequest not found' };
    }

    // Check if already completed to prevent duplicate alerts
    const wasAlreadyCompleted = serviceRequest.status === ServiceRequestStatus.COMPLETED;

    const clientName = payload.name?.trim() || serviceRequest.contact.name;
    const email = payload.email?.trim() || serviceRequest.email || '';
    const fullAddress = payload.address?.trim() || serviceRequest.address || '';
    const postalCode = payload.postalCode?.trim() || serviceRequest.postalCode || '';
    const city = payload.city?.trim() || '';
    const messageNotes = payload.message?.trim() || serviceRequest.message || '';
    const serviceType = payload.serviceType?.trim() || serviceRequest.serviceType || 'Devis';

    // 2. Update ServiceRequest
    const updatedRequest = await db.serviceRequest.update({
      where: { id: serviceRequest.id },
      data: {
        status: ServiceRequestStatus.COMPLETED,
        address: fullAddress,
        postalCode,
        email,
        serviceType,
        message: messageNotes,
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
        city: city || undefined,
      },
    });

    // 4. Queue internal alert SMS to staff if not already completed
    if (!wasAlreadyCompleted) {
      const alertPhone = serviceRequest.business.alertPhoneNumber || env.BATIMENT_ALERT_PHONE_NUMBER;
      const senderPhone = serviceRequest.business.outboundPhoneNumber || env.BATIMENT_OUTBOUND_PHONE;

      const locationStr = city ? `${postalCode} ${city}` : postalCode;

      const alertBody =
        `🚨 NOUVEAU DEVIS (Formulaire Web):\n\n` +
        `Client : ${clientName}\n` +
        `Tél : ${serviceRequest.contact.phoneNumber}\n` +
        `Email : ${email || 'Non renseigné'}\n` +
        `Motif : ${serviceType}\n` +
        `Adresse : ${fullAddress}\n` +
        `code postal:${locationStr}\n` +
        `message:${messageNotes || 'Aucun'}`;

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

  /**
   * Fetches quote details for initial pre-filling of the client form
   */
  static async getSubmissionContext(callId: string) {
    const serviceRequest = await db.serviceRequest.findFirst({
      where: { vapiCallId: callId },
      include: { contact: true, business: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!serviceRequest) {
      return null;
    }

    return {
      callId: serviceRequest.vapiCallId,
      status: serviceRequest.status,
      name: serviceRequest.contact.name,
      phoneNumber: serviceRequest.contact.phoneNumber,
      email: serviceRequest.email || serviceRequest.contact.email || '',
      address: serviceRequest.address || serviceRequest.contact.address || '',
      postalCode: serviceRequest.postalCode || serviceRequest.contact.postalCode || '',
      city: serviceRequest.contact.city || '',
      serviceType: serviceRequest.serviceType || 'Bâtiment / Travaux',
      message: serviceRequest.message || '',
      createdAt: serviceRequest.createdAt,
    };
  }
}
