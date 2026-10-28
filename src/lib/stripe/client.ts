import Stripe from 'stripe';
import { StripeConfigService } from '../services/stripe-config.service';

let cachedClient: Stripe | null = null;
let lastKeyUsed: string = '';

/**
 * Returns a configured Stripe client instance if STRIPE_SECRET_KEY is present in env or admin config.
 */
export function getStripeClient(): Stripe | null {
  const config = StripeConfigService.getConfig();
  const secretKey = config.stripeSecretKey?.trim();

  if (!secretKey) {
    return null;
  }

  // If key changed from admin UI, instantiate a new Stripe client
  if (!cachedClient || lastKeyUsed !== secretKey) {
    cachedClient = new Stripe(secretKey, {
      typescript: true,
      appInfo: {
        name: 'VoxFlow AI Calling System',
        version: '1.0.0',
      },
    });
    lastKeyUsed = secretKey;
  }

  return cachedClient;
}

/**
 * Indicates whether live or test Stripe keys are actively configured.
 */
export function isStripeConfigured(): boolean {
  const config = StripeConfigService.getConfig();
  return Boolean(config.stripeSecretKey && config.stripeSecretKey.trim().length > 0);
}
