import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { headers } from 'next/headers';
import { StripeConfigService } from '@/lib/services/stripe-config.service';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const UpdateConfigSchema = z.object({
  stripeSecretKey: z.string().optional(),
  stripePublishableKey: z.string().optional(),
  stripeWebhookSecret: z.string().optional(),

  // Plan Prices in EUR (€ HT)
  starterMonthlyPrice: z.coerce.number().min(0).optional(),
  starterAnnualPrice: z.coerce.number().min(0).optional(),
  starterMinutes: z.coerce.number().min(0).optional(),

  proMonthlyPrice: z.coerce.number().min(0).optional(),
  proAnnualPrice: z.coerce.number().min(0).optional(),
  proMinutes: z.coerce.number().min(0).optional(),

  enterpriseMonthlyPrice: z.coerce.number().min(0).optional(),
  enterpriseAnnualPrice: z.coerce.number().min(0).optional(),
  enterpriseMinutes: z.coerce.number().min(0).optional(),

  // Optional Stripe Price IDs (from src/lib/env.ts)
  stripePriceStarterMonthly: z.string().optional(),
  stripePriceStarterAnnual: z.string().optional(),
  stripePriceProMonthly: z.string().optional(),
  stripePriceProAnnual: z.string().optional(),
  stripePriceEnterpriseMonthly: z.string().optional(),
  stripePriceEnterpriseAnnual: z.string().optional(),
  testConnection: z.boolean().optional(),
});

function maskKey(key?: string): string {
  if (!key || key.length < 10) return key ? '••••••••' : '';
  const prefix = key.slice(0, 7);
  const suffix = key.slice(-4);
  return `${prefix}••••••••${suffix}`;
}

async function checkAdminAuth(req: NextRequest) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.user?.id) {
    return null;
  }
  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user || user.role !== 'ADMIN') {
    return null;
  }
  return { session, user };
}

export async function GET(req: NextRequest) {
  try {
    const authCheck = await checkAdminAuth(req);
    if (!authCheck) {
      return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
    }

    const config = StripeConfigService.getConfig();
    const isConfigured = Boolean(config.stripeSecretKey && config.stripeSecretKey.trim().length > 0);

    return NextResponse.json({
      success: true,
      config: {
        stripeSecretKeyMasked: maskKey(config.stripeSecretKey),
        stripeSecretKeyConfigured: isConfigured,
        stripePublishableKey: config.stripePublishableKey,
        stripeWebhookSecret: config.stripeWebhookSecret,

        // Plan Prices & Quotas
        starterMonthlyPrice: config.starterMonthlyPrice,
        starterAnnualPrice: config.starterAnnualPrice,
        starterMinutes: config.starterMinutes,

        proMonthlyPrice: config.proMonthlyPrice,
        proAnnualPrice: config.proAnnualPrice,
        proMinutes: config.proMinutes,

        enterpriseMonthlyPrice: config.enterpriseMonthlyPrice,
        enterpriseAnnualPrice: config.enterpriseAnnualPrice,
        enterpriseMinutes: config.enterpriseMinutes,

        // Price IDs
        stripePriceStarterMonthly: config.stripePriceStarterMonthly,
        stripePriceStarterAnnual: config.stripePriceStarterAnnual,
        stripePriceProMonthly: config.stripePriceProMonthly,
        stripePriceProAnnual: config.stripePriceProAnnual,
        stripePriceEnterpriseMonthly: config.stripePriceEnterpriseMonthly,
        stripePriceEnterpriseAnnual: config.stripePriceEnterpriseAnnual,
        lastUpdated: config.lastUpdated,
      },
      webhookUrl: `${req.nextUrl.origin}/api/stripe/webhook`,
    });
  } catch (error: any) {
    logger.error('[GET /api/admin/stripe-config Error]', { error });
    return NextResponse.json({ error: 'Erreur lors de la lecture de la configuration' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCheck = await checkAdminAuth(req);
    if (!authCheck) {
      return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
    }

    const body = await req.json();
    const parseResult = UpdateConfigSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const currentConfig = StripeConfigService.getConfig();

    // Only update secret key if a new one was provided (ignore if empty or masked placeholder)
    let secretKeyToSave = currentConfig.stripeSecretKey;
    if (data.stripeSecretKey && !data.stripeSecretKey.includes('••••')) {
      secretKeyToSave = data.stripeSecretKey.trim();
    }

    const saved = StripeConfigService.saveConfig({
      stripeSecretKey: secretKeyToSave,
      stripePublishableKey: data.stripePublishableKey !== undefined ? data.stripePublishableKey.trim() : currentConfig.stripePublishableKey,
      stripeWebhookSecret: data.stripeWebhookSecret !== undefined ? data.stripeWebhookSecret.trim() : currentConfig.stripeWebhookSecret,

      // Plan Prices & Quotas
      starterMonthlyPrice: data.starterMonthlyPrice !== undefined ? data.starterMonthlyPrice : currentConfig.starterMonthlyPrice,
      starterAnnualPrice: data.starterAnnualPrice !== undefined ? data.starterAnnualPrice : currentConfig.starterAnnualPrice,
      starterMinutes: data.starterMinutes !== undefined ? data.starterMinutes : currentConfig.starterMinutes,

      proMonthlyPrice: data.proMonthlyPrice !== undefined ? data.proMonthlyPrice : currentConfig.proMonthlyPrice,
      proAnnualPrice: data.proAnnualPrice !== undefined ? data.proAnnualPrice : currentConfig.proAnnualPrice,
      proMinutes: data.proMinutes !== undefined ? data.proMinutes : currentConfig.proMinutes,

      enterpriseMonthlyPrice: data.enterpriseMonthlyPrice !== undefined ? data.enterpriseMonthlyPrice : currentConfig.enterpriseMonthlyPrice,
      enterpriseAnnualPrice: data.enterpriseAnnualPrice !== undefined ? data.enterpriseAnnualPrice : currentConfig.enterpriseAnnualPrice,
      enterpriseMinutes: data.enterpriseMinutes !== undefined ? data.enterpriseMinutes : currentConfig.enterpriseMinutes,

      // Stripe Price IDs
      stripePriceStarterMonthly: data.stripePriceStarterMonthly !== undefined ? data.stripePriceStarterMonthly.trim() : currentConfig.stripePriceStarterMonthly,
      stripePriceStarterAnnual: data.stripePriceStarterAnnual !== undefined ? data.stripePriceStarterAnnual.trim() : currentConfig.stripePriceStarterAnnual,
      stripePriceProMonthly: data.stripePriceProMonthly !== undefined ? data.stripePriceProMonthly.trim() : currentConfig.stripePriceProMonthly,
      stripePriceProAnnual: data.stripePriceProAnnual !== undefined ? data.stripePriceProAnnual.trim() : currentConfig.stripePriceProAnnual,
      stripePriceEnterpriseMonthly: data.stripePriceEnterpriseMonthly !== undefined ? data.stripePriceEnterpriseMonthly.trim() : currentConfig.stripePriceEnterpriseMonthly,
      stripePriceEnterpriseAnnual: data.stripePriceEnterpriseAnnual !== undefined ? data.stripePriceEnterpriseAnnual.trim() : currentConfig.stripePriceEnterpriseAnnual,
    });

    let testResult = null;
    if (data.testConnection) {
      testResult = await StripeConfigService.testConnection(secretKeyToSave);
    }

    return NextResponse.json({
      success: true,
      message: 'Tarifs et configuration Stripe enregistrés avec succès.',
      config: {
        stripeSecretKeyMasked: maskKey(saved.stripeSecretKey),
        stripeSecretKeyConfigured: Boolean(saved.stripeSecretKey),
        stripePublishableKey: saved.stripePublishableKey,
        stripeWebhookSecret: saved.stripeWebhookSecret,

        starterMonthlyPrice: saved.starterMonthlyPrice,
        starterAnnualPrice: saved.starterAnnualPrice,
        starterMinutes: saved.starterMinutes,

        proMonthlyPrice: saved.proMonthlyPrice,
        proAnnualPrice: saved.proAnnualPrice,
        proMinutes: saved.proMinutes,

        enterpriseMonthlyPrice: saved.enterpriseMonthlyPrice,
        enterpriseAnnualPrice: saved.enterpriseAnnualPrice,
        enterpriseMinutes: saved.enterpriseMinutes,

        stripePriceStarterMonthly: saved.stripePriceStarterMonthly,
        stripePriceStarterAnnual: saved.stripePriceStarterAnnual,
        stripePriceProMonthly: saved.stripePriceProMonthly,
        stripePriceProAnnual: saved.stripePriceProAnnual,
        stripePriceEnterpriseMonthly: saved.stripePriceEnterpriseMonthly,
        stripePriceEnterpriseAnnual: saved.stripePriceEnterpriseAnnual,
        lastUpdated: saved.lastUpdated,
      },
      testResult,
    });
  } catch (error: any) {
    logger.error('[POST /api/admin/stripe-config Error]', { error });
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde de la configuration' }, { status: 500 });
  }
}
