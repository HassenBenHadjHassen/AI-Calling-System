import { NextResponse } from 'next/server';
import { StripeConfigService } from '@/lib/services/stripe-config.service';

export async function GET() {
  const plans = StripeConfigService.getPlans();
  return NextResponse.json({
    success: true,
    plans,
  });
}
