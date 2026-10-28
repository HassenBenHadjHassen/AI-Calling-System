import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { StripeService } from '@/lib/services/stripe.service';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const user = session.user as any;
    let customerId: string | undefined;

    // Check if user has an assigned business with a stored Stripe customer ID
    if (user.assignedBusiness && user.assignedBusiness !== 'ALL') {
      const business = await db.business.findUnique({
        where: { slug: user.assignedBusiness },
      });
      if (business && business.metadata && typeof business.metadata === 'object') {
        customerId = (business.metadata as any).stripeCustomerId;
      }
    }

    const { url, isDemo } = await StripeService.createCustomerPortalSession({
      customerId,
      returnUrl: `${req.nextUrl.origin}/dashboard`,
    });

    return NextResponse.json({ success: true, url, isDemo });
  } catch (error: any) {
    logger.error('[API /api/stripe/portal Error]', { error: error?.message || error });
    return NextResponse.json(
      { error: 'Impossible d’ouvrir le portail de facturation', message: error?.message },
      { status: 500 }
    );
  }
}
