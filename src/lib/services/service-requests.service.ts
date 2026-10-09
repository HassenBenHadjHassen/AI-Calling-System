import { db } from '../db';
import { normalizePhoneNumber } from '../validation/phone';
import { NotificationService } from './notifications.service';
import { VapiIntegration, VAPI_STRUCTURED_OUTPUT_IDS } from '../integrations/vapi';
import { JotformIntegration } from '../integrations/jotform';
import { VapiServerMessagePayload } from '../validation/schemas';
import { ServiceRequestCategory, ServiceRequestStatus } from '@prisma/client';
import { env } from '../env';
import { TenantService } from './tenant.service';

export class ServiceRequestsService {
  /**
   * Processes Dani Bâtiment end-of-call webhooks.
   * Reproduces links-v3-vapi-crm-sms-dani-batiment.json.
   */
  static async processDaniBatimentCall(payload: VapiServerMessagePayload) {
    const rawCaller = VapiIntegration.extractCallerNumber(payload);
    const callerNumber = normalizePhoneNumber(rawCaller);
    const vapiCallId = payload.message.call?.id || `call_${Date.now()}`;
    const assistantId = payload.message.call?.assistantId || payload.message.assistant?.id || '';

    // 1. Resolve Business Tenant (Dani Bâtiment - auto-bootstraps if not seeded)
    const business = await TenantService.ensureTenant('DANI_BATIMENT');

    const senderPhone = business.outboundPhoneNumber || env.BATIMENT_OUTBOUND_PHONE;
    const alertPhone = business.alertPhoneNumber || env.BATIMENT_ALERT_PHONE_NUMBER;

    // 2. Extract structured outputs
    const structured = (VapiIntegration.extractStructuredOutput(
      payload,
      VAPI_STRUCTURED_OUTPUT_IDS.DANI_BATIMENT_MOTIF
    ) || {}) as {
      patient_name?: string;
      name?: string;
      'motif-appel'?: string;
      motif?: string;
      service_type?: string;
      message?: string;
      call_summary?: string;
    };

    const customerName = structured.patient_name || structured.name || 'Client';
    const motifAppelRaw = (structured['motif-appel'] || structured.motif || 'Devis').trim();
    const serviceType = structured.service_type || 'Bâtiment / Travaux';
    const message = structured.message || '';
    const callSummary = structured.call_summary || payload.message.artifact?.summary || '';

    // 3. Upsert Contact & CallRecord
    const contact = await db.contact.upsert({
      where: {
        businessId_phoneNumber: {
          businessId: business.id,
          phoneNumber: callerNumber,
        },
      },
      update: {
        name: customerName !== 'Client' ? customerName : undefined,
      },
      create: {
        businessId: business.id,
        phoneNumber: callerNumber,
        name: customerName,
      },
    });

    const callRecord = await db.callRecord.upsert({
      where: { vapiCallId },
      update: {
        summary: callSummary,
        structuredData: payload.message.artifact?.structuredOutputs || {},
      },
      create: {
        businessId: business.id,
        vapiCallId,
        assistantId,
        contactId: contact.id,
        callerNumber,
        summary: callSummary,
        structuredData: payload.message.artifact?.structuredOutputs || {},
      },
    });

    const motifLower = motifAppelRaw.toLowerCase();

    // 4. Branch 1: DEVIS (Route 1)
    if (motifLower.includes('devis')) {
      const formUrl = JotformIntegration.buildFormUrl(
        business.formUrl || env.JOTFORM_FORM_URL,
        vapiCallId
      );

      // Create ServiceRequest with status NOT_COMPLETED
      const serviceRequest = await db.serviceRequest.create({
        data: {
          businessId: business.id,
          contactId: contact.id,
          callRecordId: callRecord.id,
          vapiCallId,
          category: ServiceRequestCategory.DEVIS,
          status: ServiceRequestStatus.NOT_COMPLETED,
          serviceType,
          message,
        },
      });

      // Module 31: Send SMS to customer with personalized JotForm link
      const customerSms =
        `Bonjour, suite à votre appel, merci de remplir ce formulaire rapide avec vos coordonnées exactes (adresse du chantier et email) : ${formUrl}\n` +
        ` Cela nous permettra d'étudier votre demande de devis dans les meilleures conditions. L'équipe de Dani bâtiment.\n` +
        `(Merci de ne pas répondre à ce SMS généré automatiquement)`;

      await NotificationService.queueNotification({
        businessId: business.id,
        recipient: callerNumber,
        message: customerSms,
        from: senderPhone,
      });

      return { outcome: 'DEVIS', serviceRequestId: serviceRequest.id };
    }

    // 5. Branch 2: ANNULATION ou SUIVI (Route 2)
    if (motifLower.includes('annulation') || motifLower.includes('suivi')) {
      const category = motifLower.includes('annulation')
        ? ServiceRequestCategory.ANNULATION
        : ServiceRequestCategory.SUIVI;

      const serviceRequest = await db.serviceRequest.create({
        data: {
          businessId: business.id,
          contactId: contact.id,
          callRecordId: callRecord.id,
          vapiCallId,
          category,
          status: ServiceRequestStatus.MESSAGE,
          serviceType,
          message,
        },
      });

      // Module 43: SMS to customer
      const ackSms =
        `Bonjour, nous vous confirmons avoir bien pris en compte votre message/annulation suite à votre appel. ` +
        `L'information a été transmise au dossier. Cordialement, l'équipe Dani Bâtiment.\n` +
        `(Merci de ne pas répondre à ce SMS généré automatiquement)`;

      await NotificationService.queueNotification({
        businessId: business.id,
        recipient: callerNumber,
        message: ackSms,
        from: senderPhone,
      });

      // Module 45: SMS alert to staff
      const staffAlertSms =
        `🔧 SUIVI/ANNULATION :\n` +
        `-Nom: ${contact.name}\n` +
        `-numero:${callerNumber}\n` +
        `-Motif : ${motifAppelRaw}\n` +
        `-message:${message}\n` +
        `- Résumé : ${callSummary}\n`;

      await NotificationService.queueNotification({
        businessId: business.id,
        recipient: alertPhone,
        message: staffAlertSms,
        from: senderPhone,
      });

      return { outcome: 'ANNULATION_OU_SUIVI', serviceRequestId: serviceRequest.id };
    }

    // 6. Branch 3: INTERVENTION ou MESSAGE / Fallback (Route 3)
    const isIntervention = motifLower.includes('intervention');
    const category = isIntervention
      ? ServiceRequestCategory.INTERVENTION
      : ServiceRequestCategory.MESSAGE;

    const serviceRequest = await db.serviceRequest.create({
      data: {
        businessId: business.id,
        contactId: contact.id,
        callRecordId: callRecord.id,
        vapiCallId,
        category,
        status: ServiceRequestStatus.MESSAGE,
        serviceType,
        message,
      },
    });

    // Module 40: Customer SMS
    const customerMsg =
      `Bonjour, votre appel a bien été pris en compte. Nos équipes sont actuellement en intervention. ` +
      `Nous avons noté vos coordonnées et vous rappelons dès que possible. Bonne journée, Dani bâtiment.\n` +
      `(Merci de ne pas répondre à ce SMS généré automatiquement)`;

    await NotificationService.queueNotification({
      businessId: business.id,
      recipient: callerNumber,
      message: customerMsg,
      from: senderPhone,
    });

    // Module 51: Staff alert SMS
    const staffGeneralAlert =
      `📞 APPEL GÉNÉRAL : \n` +
      `nom:${contact.name}\n` +
      `phone:${callerNumber}\n` +
      `Message :${callSummary || message}\n` +
      `service:${serviceType}`;

    await NotificationService.queueNotification({
      businessId: business.id,
      recipient: alertPhone,
      message: staffGeneralAlert,
      from: senderPhone,
    });

    return { outcome: 'INTERVENTION_OU_MESSAGE', serviceRequestId: serviceRequest.id };
  }
}
