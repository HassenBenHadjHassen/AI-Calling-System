import { getStripeClient, isStripeConfigured } from '../stripe/client';
import { STRIPE_PLANS, getPlan, BillingInterval, PlanConfig } from '../stripe/plans';
import { StripeConfigService, StripeConfigData } from './stripe-config.service';
import { env } from '../env';
import { logger } from '../logger';
import { db } from '../db';
import crypto from 'node:crypto';

export interface CreateCheckoutParams {
  planId: string;
  interval: BillingInterval;
  customerEmail?: string;
  businessName?: string;
  businessId?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutResult {
  url: string;
  sessionId: string;
  isDemo: boolean;
  plan: PlanConfig;
}

export class StripeService {
  /**
   * Creates a Stripe Checkout Session for subscription.
   * If Stripe keys are not yet configured, gracefully generates a secure demo session.
   */
  static async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const { planId, interval, customerEmail, businessName, businessId } = params;

    const plan = StripeConfigService.getPlans()[planId] || STRIPE_PLANS[planId];
    if (!plan) {
      throw new Error(`Plan inconnu: ${planId}`);
    }

    const appUrl = (env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const successUrl =
      params.successUrl ||
      `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&plan=${encodeURIComponent(plan.id)}&interval=${encodeURIComponent(interval)}`;
    const cancelUrl = params.cancelUrl || `${appUrl}/checkout/cancel?plan=${encodeURIComponent(plan.id)}`;

    const stripe = getStripeClient();

    // 1. Production / Live Stripe Mode
    if (stripe && isStripeConfigured()) {
      try {
        // Check if pre-configured price ID exists in dynamic admin config or env, else use dynamic recurring price_data
        const config = StripeConfigService.getConfig();
        const envPriceKey = plan.stripePriceEnvKey[interval];
        const priceMapping: Record<
          string,
          | 'stripePriceStarterMonthly'
          | 'stripePriceStarterAnnual'
          | 'stripePriceProMonthly'
          | 'stripePriceProAnnual'
          | 'stripePriceEnterpriseMonthly'
          | 'stripePriceEnterpriseAnnual'
        > = {
          STRIPE_PRICE_STARTER_MONTHLY: 'stripePriceStarterMonthly',
          STRIPE_PRICE_STARTER_ANNUAL: 'stripePriceStarterAnnual',
          STRIPE_PRICE_PRO_MONTHLY: 'stripePriceProMonthly',
          STRIPE_PRICE_PRO_ANNUAL: 'stripePriceProAnnual',
          STRIPE_PRICE_ENTERPRISE_MONTHLY: 'stripePriceEnterpriseMonthly',
          STRIPE_PRICE_ENTERPRISE_ANNUAL: 'stripePriceEnterpriseAnnual',
        };
        const configField = priceMapping[envPriceKey];
        const configuredPriceId = (configField ? config[configField]?.trim() : '') || env[envPriceKey]?.trim();

        let lineItem: any;
        if (configuredPriceId) {
          lineItem = {
            price: configuredPriceId,
            quantity: 1,
          };
        } else {
          // Dynamic recurring line item in EUR
          const unitAmount =
            interval === 'annual'
              ? plan.annualBilledTotal * 100 // in cents
              : plan.monthlyPrice * 100; // in cents

          lineItem = {
            price_data: {
              currency: 'eur',
              product_data: {
                name: `Abonnement VoxFlow AI — ${plan.name}`,
                description: `${plan.minutesIncluded} min/mois incluses, ${plan.simultaneousLines} ligne(s) simultanée(s). Facturation ${interval === 'annual' ? 'annuelle' : 'mensuelle'}.`,
                metadata: {
                  planId: plan.id,
                  interval,
                },
              },
              unit_amount: unitAmount,
              recurring: {
                interval: interval === 'annual' ? 'year' : 'month',
              },
            },
            quantity: 1,
          };
        }

        const session = await stripe.checkout.sessions.create({
          mode: 'subscription',
          billing_address_collection: 'required',
          tax_id_collection: { enabled: true },
          allow_promotion_codes: true,
          customer_email: customerEmail && customerEmail.includes('@') ? customerEmail : undefined,
          line_items: [lineItem],
          success_url: successUrl,
          cancel_url: cancelUrl,
          subscription_data: {
            metadata: {
              planId: plan.id,
              interval,
              businessName: businessName || 'Non spécifié',
              businessId: businessId || '',
            },
          },
          metadata: {
            planId: plan.id,
            interval,
            businessName: businessName || '',
            businessId: businessId || '',
          },
        });

        if (!session.url) {
          throw new Error('Stripe n’a pas retourné d’URL de redirection valide.');
        }

        logger.info('[StripeService] Created Checkout Session', {
          sessionId: session.id,
          planId: plan.id,
          interval,
        });

        return {
          url: session.url,
          sessionId: session.id,
          isDemo: false,
          plan,
        };
      } catch (error) {
        logger.error('[StripeService] Stripe API checkout failed, falling back to demo mode', {
          error,
          planId,
        });
        // Fall back to demo mode if Stripe API rejected credentials
      }
    }

    // 2. Demonstration / Pending API Keys Mode
    const demoSessionId = `demo_cs_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const demoUrl = `${appUrl}/checkout/demo-session?session_id=${demoSessionId}&plan=${encodeURIComponent(plan.id)}&interval=${encodeURIComponent(interval)}&email=${encodeURIComponent(customerEmail || '')}&company=${encodeURIComponent(businessName || '')}`;

    logger.info('[StripeService] Demo session initiated (Stripe keys pending)', {
      sessionId: demoSessionId,
      planId: plan.id,
    });

    return {
      url: demoUrl,
      sessionId: demoSessionId,
      isDemo: true,
      plan,
    };
  }

  /**
   * Creates a customer billing portal session to manage cards, invoices, and plans.
   */
  static async createCustomerPortalSession(params: {
    customerId?: string;
    returnUrl?: string;
  }): Promise<{ url: string; isDemo: boolean }> {
    const { customerId } = params;
    const appUrl = (env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const returnUrl = params.returnUrl || `${appUrl}/dashboard`;

    const stripe = getStripeClient();

    if (stripe && isStripeConfigured() && customerId) {
      try {
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: returnUrl,
        });
        return { url: portalSession.url, isDemo: false };
      } catch (error) {
        logger.error('[StripeService] Failed to create portal session', { error, customerId });
      }
    }

    // Demo portal fallback
    return {
      url: `${appUrl}/dashboard?tab=billing&demo_portal=true`,
      isDemo: true,
    };
  }

  /**
   * Validates and processes incoming Stripe Webhook events.
   */
  static async handleWebhook(rawBody: string | Buffer, signature: string) {
    const stripe = getStripeClient();
    if (!stripe) {
      throw new Error('Stripe client not configured');
    }

    const config = StripeConfigService.getConfig();
    const webhookSecret = config.stripeWebhookSecret?.trim() || env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET missing in environment or admin config');
    }

    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    logger.info(`[Stripe Webhook] Received event: ${event.type}`, { eventId: event.id });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        const customerEmail = session.customer_details?.email || session.customer_email;
        const metadata = session.metadata || {};

        logger.info('[Stripe Webhook] Checkout completed successfully', {
          customerId,
          subscriptionId,
          customerEmail,
          metadata,
        });

        // If a businessId is present, update business metadata with subscription details
        if (metadata.businessId) {
          try {
            await db.business.update({
              where: { id: metadata.businessId },
              data: {
                metadata: {
                  stripeCustomerId: customerId,
                  stripeSubscriptionId: subscriptionId,
                  subscriptionPlan: metadata.planId,
                  subscriptionInterval: metadata.interval,
                  subscriptionStatus: 'active',
                  subscribedAt: new Date().toISOString(),
                },
              },
            });
          } catch (err) {
            logger.error('[Stripe Webhook] Failed to associate subscription with business', {
              err,
              businessId: metadata.businessId,
            });
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as any;
        logger.info('[Stripe Webhook] Subscription updated', {
          subscriptionId: sub.id,
          status: sub.status,
          currentPeriodEnd: sub.current_period_end,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as any;
        logger.warn('[Stripe Webhook] Subscription canceled', {
          subscriptionId: sub.id,
          canceledAt: sub.canceled_at,
        });
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        logger.info('[Stripe Webhook] Invoice payment succeeded', {
          invoiceId: invoice.id,
          amountPaid: invoice.amount_paid,
          customer: invoice.customer,
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        logger.error('[Stripe Webhook] Invoice payment failed', {
          invoiceId: invoice.id,
          attemptCount: invoice.attempt_count,
        });
        break;
      }

      default:
        logger.info(`[Stripe Webhook] Unhandled event type ${event.type}`);
    }

    return { received: true, eventId: event.id };
  }
}
