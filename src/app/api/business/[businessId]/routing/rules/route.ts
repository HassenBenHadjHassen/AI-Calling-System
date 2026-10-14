import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyBusinessAccess } from '@/lib/auth/business-auth';
import { CreateRoutingRuleSchema } from '@/lib/validation/schemas';
import { normalizePhoneNumber, isValidE164 } from '@/lib/validation/phone';
import { logger } from '@/lib/logger';

interface RouteContext {
  params: Promise<{ businessId: string }>;
}

/**
 * POST /api/business/[businessId]/routing/rules
 * Adds a new whitelist (DIRECT) or blacklist (BLOCK) routing rule.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const { businessId } = await context.params;
  const auth = await verifyBusinessAccess(req.headers, businessId);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = CreateRoutingRuleSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données de la règle invalides', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const normalizedPhone = normalizePhoneNumber(parsed.data.phoneNumber);
  if (!isValidE164(normalizedPhone)) {
    return NextResponse.json(
      { error: 'Le numéro de téléphone doit être un numéro E.164 valide (ex: +33612345678).' },
      { status: 400 }
    );
  }

  try {
    // Check for duplicate rule within this business
    const existing = await db.callerRoutingRule.findUnique({
      where: {
        businessId_phoneNumber: {
          businessId: auth.business!.id,
          phoneNumber: normalizedPhone,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Une règle existe déjà pour ce numéro de téléphone dans cet établissement.' },
        { status: 409 }
      );
    }

    const rule = await db.callerRoutingRule.create({
      data: {
        businessId: auth.business!.id,
        phoneNumber: normalizedPhone,
        action: parsed.data.action,
        label: parsed.data.label?.trim() || null,
        active: parsed.data.active ?? true,
      },
    });

    return NextResponse.json(
      { success: true, rule },
      { status: 201 }
    );
  } catch (error: unknown) {
    logger.error('Failed to create routing rule', {
      module: 'API_ROUTING',
      businessId,
      error,
    });
    return NextResponse.json(
      { error: 'Erreur lors de la création de la règle de routage' },
      { status: 500 }
    );
  }
}
