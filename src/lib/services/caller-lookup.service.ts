import { db } from '../db';
import { normalizePhoneNumber } from '../validation/phone';
import { VapiIntegration } from '../integrations/vapi';

export interface CallerLookupParams {
  callerNumber: string;
  assistantId: string;
  toolCallId: string;
}

export class CallerLookupService {
  /**
   * Reproduces the VIP and caller lookup behavior from Client_VIP.json.
   */
  static async lookupCaller(params: CallerLookupParams) {
    const normalizedPhone = normalizePhoneNumber(params.callerNumber);

    // 1. Resolve Assistant & Business Tenant
    const assistantConfig = await db.assistantConfig.findUnique({
      where: { assistantId: params.assistantId },
      include: { business: true },
    });

    if (!assistantConfig) {
      console.warn(`[CallerLookup] Unknown assistant ID: ${params.assistantId}`);
      return VapiIntegration.buildToolResponse(
        params.toolCallId,
        'Utilisateur est un nouveau client'
      );
    }

    const business = assistantConfig.business;

    // 2. Global / Tenant Whitelist / Allowlist Check (Module 31)
    const allowlistEntry = await db.callerAllowlist.findFirst({
      where: {
        businessId: business.id,
        phoneNumber: normalizedPhone,
        active: true,
      },
    });

    // 3. Cabinet Michelle Branch (Route 1)
    if (params.assistantId === '97808c43-384a-4f40-a8dd-9149ba4988f5' || business.slug === 'CABINET_MICHELLE') {
      // Whitelist match (Module 22)
      if (allowlistEntry) {
        return VapiIntegration.buildToolResponse(
          params.toolCallId,
          ' NUMERO EST UN liste blanche / whitelist, DONC TRASNFERT LAPPEL VERS LE LINFIRMIERE '
        );
      }

      // Existing client lookup (Module 4)
      const contact = await db.contact.findFirst({
        where: {
          businessId: business.id,
          phoneNumber: normalizedPhone,
        },
        include: {
          appointments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (contact && contact.appointments.length > 0) {
        const appt = contact.appointments[0];
        // Module 3 response
        return VapiIntegration.buildToolResponse(
          params.toolCallId,
          `Utilisateur est un client existant, Nom : ${contact.name}, Historique : ${appt.serviceType}, Heure: ${appt.time}, Date: ${appt.date}`
        );
      }

      // New client (Module 16)
      return VapiIntegration.buildToolResponse(
        params.toolCallId,
        'Utilisateur est un nouveau client'
      );
    }

    // 4. Dani Bâtiment Branch (Route 2)
    if (params.assistantId === '38a56410-a3b6-49d5-96f1-8cd572b3f81c' || business.slug === 'DANI_BATIMENT') {
      const contact = await db.contact.findFirst({
        where: {
          businessId: business.id,
          phoneNumber: normalizedPhone,
        },
        include: {
          requests: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (contact && contact.requests.length > 0) {
        const req = contact.requests[0];
        // Module 14 response
        return VapiIntegration.buildToolResponse(
          params.toolCallId,
          `NOM: ${contact.name}, service: ${req.serviceType || 'Non specifie'}, Motif: ${req.category}, Message: ${req.message || 'Aucun'}, ADRESSE: ${req.address || 'Non specifie'}`
        );
      }

      return VapiIntegration.buildToolResponse(
        params.toolCallId,
        'Utilisateur est un nouveau client pour les travaux de bâtiment'
      );
    }

    // Generic fallback
    return VapiIntegration.buildToolResponse(
      params.toolCallId,
      'Utilisateur est un nouveau client'
    );
  }
}
