import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { BusinessType, WorkflowType } from '@prisma/client';

export class TenantService {
  /**
   * Ensures the requested business tenant, its assistant configurations,
   * and allowlists exist in PostgreSQL without requiring any external seed script.
   */
  static async ensureTenant(slug: 'CABINET_MICHELLE' | 'DANI_BATIMENT') {
    if (slug === 'CABINET_MICHELLE') {
      let business = await db.business.findUnique({
        where: { slug: 'CABINET_MICHELLE' },
        include: { assistants: true, allowlistEntries: true },
      });

      if (!business) {
        business = await db.business.create({
          data: {
            slug: 'CABINET_MICHELLE',
            name: 'Cabinet Michelle',
            businessType: BusinessType.HEALTHCARE,
            timezone: env.TIMEZONE,
            inboundPhoneNumber: env.CABINET_INBOUND_PHONE,
            alertPhoneNumber: env.NURSE_ALERT_PHONE_NUMBER,
            calendarId: env.CABINET_CALENDAR_ID,
          },
          include: { assistants: true, allowlistEntries: true },
        });
      }

      // Ensure assistant configuration exists
      const assistantId = env.CABINET_ASSISTANT_ID;
      const assistants = business.assistants || [];
      const hasAssistant = assistants.some((a) => a.assistantId === assistantId);
      if (!hasAssistant && assistantId && db.assistantConfig?.upsert) {
        await db.assistantConfig.upsert({
          where: { assistantId },
          update: { businessId: business.id },
          create: {
            assistantId,
            businessId: business.id,
            name: 'Assistant Cabinet Michelle',
            workflowType: WorkflowType.PATIENT_CARE,
          },
        });
      }

      // Ensure nurse alert phone is on allowlist
      const alertPhone = business.alertPhoneNumber || env.NURSE_ALERT_PHONE_NUMBER;
      if (alertPhone && db.callerAllowlist?.upsert) {
        await db.callerAllowlist.upsert({
          where: {
            businessId_phoneNumber: {
              businessId: business.id,
              phoneNumber: alertPhone,
            },
          },
          update: { active: true },
          create: {
            businessId: business.id,
            phoneNumber: alertPhone,
            label: 'Infirmière Michelle (Whitelist)',
            active: true,
          },
        });
      }

      return business;
    } else {
      let business = await db.business.findUnique({
        where: { slug: 'DANI_BATIMENT' },
        include: { assistants: true, allowlistEntries: true },
      });

      if (!business) {
        business = await db.business.create({
          data: {
            slug: 'DANI_BATIMENT',
            name: 'Dani Bâtiment',
            businessType: BusinessType.BUILDING_SERVICES,
            timezone: env.TIMEZONE,
            outboundPhoneNumber: env.BATIMENT_OUTBOUND_PHONE,
            alertPhoneNumber: env.BATIMENT_ALERT_PHONE_NUMBER,
            formUrl: env.JOTFORM_FORM_URL,
          },
          include: { assistants: true, allowlistEntries: true },
        });
      }

      // Ensure assistant configuration exists
      const assistantId = env.BATIMENT_ASSISTANT_ID;
      const assistants = business.assistants || [];
      const hasAssistant = assistants.some((a) => a.assistantId === assistantId);
      if (!hasAssistant && assistantId && db.assistantConfig?.upsert) {
        await db.assistantConfig.upsert({
          where: { assistantId },
          update: { businessId: business.id },
          create: {
            assistantId,
            businessId: business.id,
            name: 'Assistant Dani Bâtiment',
            workflowType: WorkflowType.BUILDING_SERVICES,
          },
        });
      }

      // Ensure staff alert phone is on allowlist
      const alertPhone = business.alertPhoneNumber || env.BATIMENT_ALERT_PHONE_NUMBER;
      if (alertPhone && db.callerAllowlist?.upsert) {
        await db.callerAllowlist.upsert({
          where: {
            businessId_phoneNumber: {
              businessId: business.id,
              phoneNumber: alertPhone,
            },
          },
          update: { active: true },
          create: {
            businessId: business.id,
            phoneNumber: alertPhone,
            label: 'Équipe Dani Bâtiment (Whitelist)',
            active: true,
          },
        });
      }

      return business;
    }
  }

  /**
   * Resolves tenant by incoming assistant ID, auto-provisioning known defaults if missing.
   * Returns null if assistant ID cannot be resolved to any tenant (fails closed).
   */
  static async resolveTenantByAssistantId(assistantId?: string) {
    if (assistantId) {
      const config = await db.assistantConfig.findUnique({
        where: { assistantId },
        include: { business: true },
      });
      if (config) return config.business;

      if (assistantId === env.BATIMENT_ASSISTANT_ID || assistantId === '38a56410-a3b6-49d5-96f1-8cd572b3f81c') {
        return this.ensureTenant('DANI_BATIMENT');
      }

      if (assistantId === env.CABINET_ASSISTANT_ID || assistantId === '97808c43-384a-4f40-a8dd-9149ba4988f5') {
        return this.ensureTenant('CABINET_MICHELLE');
      }

      // Unmapped assistant ID: fail closed
      return null;
    }
    return null;
  }
}
