import { NextRequest, NextResponse } from 'next/server';
import { StripeService } from '@/lib/services/stripe.service';
import { logger } from '@/lib/logger';

export const instant = false;

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    logger.warn('[Stripe Webhook] Missing stripe-signature header');
    return NextResponse.json(
      { error: 'En-tête stripe-signature manquant' },
      { status: 400 }
    );
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (err) {
    logger.error('[Stripe Webhook] Failed to read raw body', { err });
    return NextResponse.json({ error: 'Corps de requête illisible' }, { status: 400 });
  }

  try {
    const result = await StripeService.handleWebhook(rawBody, signature);
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    logger.error('[Stripe Webhook Error]', { message: err?.message || err });
    return NextResponse.json(
      { error: 'Webhook processing failed', details: err?.message },
      { status: 400 }
    );
  }
}
