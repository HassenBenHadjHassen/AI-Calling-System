import fs from 'node:fs';
import path from 'node:path';
import { env } from '../env';
import { logger } from '../logger';
import Stripe from 'stripe';
import { createDynamicPlans, PlanConfig } from '../stripe/plans';

export interface StripeConfigData {
  stripeSecretKey: string;
  stripePublishableKey: string;
  stripeWebhookSecret: string;

  // Plan Prices in EUR (€ HT) set by Admin
  starterMonthlyPrice: number;
  starterAnnualPrice: number;
  starterMinutes: number;

  proMonthlyPrice: number;
  proAnnualPrice: number;
  proMinutes: number;

  enterpriseMonthlyPrice: number;
  enterpriseAnnualPrice: number;
  enterpriseMinutes: number;

  // Optional Stripe Price IDs (from src/lib/env.ts L71-L76)
  stripePriceStarterMonthly: string;
  stripePriceStarterAnnual: string;
  stripePriceProMonthly: string;
  stripePriceProAnnual: string;
  stripePriceEnterpriseMonthly: string;
  stripePriceEnterpriseAnnual: string;

  lastUpdated?: string;
}

const CONFIG_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'stripe-config.json');

class StripeConfigService {
  private static cachedConfig: StripeConfigData | null = null;

  /**
   * Reads current Stripe configuration, merging env defaults with any admin saved overrides.
   */
  static getConfig(): StripeConfigData {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    let fileOverrides: Partial<StripeConfigData> = {};

    try {
      if (fs.existsSync(CONFIG_FILE_PATH)) {
        const raw = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
        fileOverrides = JSON.parse(raw);
      }
    } catch (err) {
      logger.warn('[StripeConfigService] Could not read stripe-config.json, using env defaults', { err });
    }

    this.cachedConfig = {
      stripeSecretKey: fileOverrides.stripeSecretKey ?? env.STRIPE_SECRET_KEY ?? '',
      stripePublishableKey: fileOverrides.stripePublishableKey ?? env.STRIPE_PUBLISHABLE_KEY ?? '',
      stripeWebhookSecret: fileOverrides.stripeWebhookSecret ?? env.STRIPE_WEBHOOK_SECRET ?? '',

      starterMonthlyPrice: typeof fileOverrides.starterMonthlyPrice === 'number' ? fileOverrides.starterMonthlyPrice : 79,
      starterAnnualPrice: typeof fileOverrides.starterAnnualPrice === 'number' ? fileOverrides.starterAnnualPrice : 63,
      starterMinutes: typeof fileOverrides.starterMinutes === 'number' ? fileOverrides.starterMinutes : 200,

      proMonthlyPrice: typeof fileOverrides.proMonthlyPrice === 'number' ? fileOverrides.proMonthlyPrice : 189,
      proAnnualPrice: typeof fileOverrides.proAnnualPrice === 'number' ? fileOverrides.proAnnualPrice : 149,
      proMinutes: typeof fileOverrides.proMinutes === 'number' ? fileOverrides.proMinutes : 650,

      enterpriseMonthlyPrice: typeof fileOverrides.enterpriseMonthlyPrice === 'number' ? fileOverrides.enterpriseMonthlyPrice : 489,
      enterpriseAnnualPrice: typeof fileOverrides.enterpriseAnnualPrice === 'number' ? fileOverrides.enterpriseAnnualPrice : 389,
      enterpriseMinutes: typeof fileOverrides.enterpriseMinutes === 'number' ? fileOverrides.enterpriseMinutes : 2000,

      stripePriceStarterMonthly: fileOverrides.stripePriceStarterMonthly ?? env.STRIPE_PRICE_STARTER_MONTHLY ?? '',
      stripePriceStarterAnnual: fileOverrides.stripePriceStarterAnnual ?? env.STRIPE_PRICE_STARTER_ANNUAL ?? '',
      stripePriceProMonthly: fileOverrides.stripePriceProMonthly ?? env.STRIPE_PRICE_PRO_MONTHLY ?? '',
      stripePriceProAnnual: fileOverrides.stripePriceProAnnual ?? env.STRIPE_PRICE_PRO_ANNUAL ?? '',
      stripePriceEnterpriseMonthly: fileOverrides.stripePriceEnterpriseMonthly ?? env.STRIPE_PRICE_ENTERPRISE_MONTHLY ?? '',
      stripePriceEnterpriseAnnual: fileOverrides.stripePriceEnterpriseAnnual ?? env.STRIPE_PRICE_ENTERPRISE_ANNUAL ?? '',
      lastUpdated: fileOverrides.lastUpdated,
    };

    return this.cachedConfig;
  }

  /**
   * Saves updated Stripe configuration overrides.
   */
  static saveConfig(updates: Partial<StripeConfigData>): StripeConfigData {
    const current = this.getConfig();

    const merged: StripeConfigData = {
      ...current,
      ...updates,
      lastUpdated: new Date().toISOString(),
    };

    try {
      const dir = path.dirname(CONFIG_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(merged, null, 2), 'utf-8');
      logger.info('[StripeConfigService] Persisted Stripe configuration to file');
    } catch (err) {
      logger.error('[StripeConfigService] Failed to write stripe-config.json', { err });
    }

    this.cachedConfig = merged;
    return merged;
  }

  /**
   * Returns plan catalog merged with live price & quota overrides set by the admin.
   */
  static getPlans(): Record<string, PlanConfig> {
    const config = this.getConfig();
    return createDynamicPlans(config);
  }

  /**
   * Tests connection with configured Stripe secret key.
   */
  static async testConnection(secretKeyOverride?: string): Promise<{
    success: boolean;
    message: string;
    livemode?: boolean;
    accountId?: string;
  }> {
    const config = this.getConfig();
    const key = secretKeyOverride?.trim() || config.stripeSecretKey.trim();

    if (!key) {
      return {
        success: false,
        message: 'Aucune clé secrète Stripe (STRIPE_SECRET_KEY) configurée.',
      };
    }

    try {
      const stripe = new Stripe(key, { typescript: true });
      const balance = await stripe.balance.retrieve();

      return {
        success: true,
        message: `Connexion Stripe réussie (${balance.livemode ? 'Mode Production / Live' : 'Mode Test / Sandbox'}).`,
        livemode: balance.livemode,
      };
    } catch (err: any) {
      logger.error('[StripeConfigService] Connection test failed', { error: err?.message || err });
      return {
        success: false,
        message: err?.message || 'Échec de connexion à l’API Stripe.',
      };
    }
  }
}

export { StripeConfigService };
