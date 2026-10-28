import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { StripeService } from '@/lib/services/stripe.service';
import { logger } from '@/lib/logger';

const CheckoutPayloadSchema = z.object({
  planId: z.enum(['starter', 'pro', 'enterprise']),
  interval: z.enum(['monthly', 'annual']).default('monthly'),
  customerEmail: z.string().email().optional().or(z.literal('')),
  businessName: z.string().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseResult = CheckoutPayloadSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Données de formulaire invalides',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { planId, interval, customerEmail, businessName, successUrl, cancelUrl } = parseResult.data;

    const result = await StripeService.createCheckoutSession({
      planId,
      interval,
      customerEmail: customerEmail || undefined,
      businessName: businessName || undefined,
      successUrl,
      cancelUrl,
    });

    return NextResponse.json({
      success: true,
      url: result.url,
      sessionId: result.sessionId,
      isDemo: result.isDemo,
      plan: {
        id: result.plan.id,
        name: result.plan.name,
        price: interval === 'annual' ? result.plan.annualMonthlyPrice : result.plan.monthlyPrice,
        interval,
      },
    });
  } catch (error: any) {
    logger.error('[API /api/stripe/checkout Error]', { error: error?.message || error });
    return NextResponse.json(
      {
        error: 'Échec de création de la session de paiement',
        message: error?.message || 'Erreur interne',
      },
      { status: 500 }
    );
  }
}
