import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyBusinessAccess } from '@/lib/auth/business-auth';
import { UpdateRoutingRuleSchema } from '@/lib/validation/schemas';
import { normalizePhoneNumber, isValidE164 } from '@/lib/validation/phone';
import { logger } from '@/lib/logger';

interface RouteContext {
  params: Promise<{ businessId: string; ruleId: string }>;
}

/**
 * PATCH /api/business/[businessId]/routing/rules/[ruleId]
 * Updates an existing routing rule (phoneNumber, action, label, active).
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const { businessId, ruleId } = await context.params;
  const auth = await verifyBusinessAccess(req.headers, businessId);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // 1. Verify rule exists and belongs to this business
  const existingRule = await db.callerRoutingRule.findFirst({
    where: {
      id: ruleId,
      businessId: auth.business!.id,
    },
  });

  if (!existingRule) {
    return NextResponse.json(
      { error: 'Règle de routage introuvable pour cet établissement.' },
      { status: 404 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = UpdateRoutingRuleSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données de mise à jour invalides', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  let normalizedPhone: string | undefined = undefined;
  if (parsed.data.phoneNumber !== undefined) {
    normalizedPhone = normalizePhoneNumber(parsed.data.phoneNumber);
    if (!isValidE164(normalizedPhone)) {
      return NextResponse.json(
        { error: 'Le numéro de téléphone doit être un numéro E.164 valide (ex: +33612345678).' },
        { status: 400 }
      );
    }

    // Check duplicate if changing phone number
    if (normalizedPhone !== existingRule.phoneNumber) {
      const duplicate = await db.callerRoutingRule.findUnique({
        where: {
          businessId_phoneNumber: {
            businessId: auth.business!.id,
            phoneNumber: normalizedPhone,
          },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Une autre règle existe déjà pour ce numéro de téléphone dans cet établissement.' },
          { status: 409 }
        );
      }
    }
  }

  try {
    const updatedRule = await db.callerRoutingRule.update({
      where: { id: existingRule.id },
      data: {
        ...(normalizedPhone !== undefined && { phoneNumber: normalizedPhone }),
        ...(parsed.data.action !== undefined && { action: parsed.data.action }),
        ...(parsed.data.label !== undefined && {
          label: parsed.data.label?.trim() || null,
        }),
        ...(parsed.data.active !== undefined && { active: parsed.data.active }),
      },
    });

    return NextResponse.json({ success: true, rule: updatedRule });
  } catch (error: unknown) {
    logger.error('Failed to update routing rule', {
      module: 'API_ROUTING',
      businessId,
      ruleId,
      error,
    });
    return NextResponse.json(
      { error: 'Erreur lors de la modification de la règle' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/business/[businessId]/routing/rules/[ruleId]
 * Deletes a routing rule for a business.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const { businessId, ruleId } = await context.params;
  const auth = await verifyBusinessAccess(req.headers, businessId);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Verify rule belongs to this business
  const existingRule = await db.callerRoutingRule.findFirst({
    where: {
      id: ruleId,
      businessId: auth.business!.id,
    },
  });

  if (!existingRule) {
    return NextResponse.json(
      { error: 'Règle de routage introuvable pour cet établissement.' },
      { status: 404 }
    );
  }

  try {
    await db.callerRoutingRule.delete({
      where: { id: existingRule.id },
    });

    return NextResponse.json({
      success: true,
      deletedRuleId: ruleId,
      message: 'Règle supprimée avec succès.',
    });
  } catch (error: unknown) {
    logger.error('Failed to delete routing rule', {
      module: 'API_ROUTING',
      businessId,
      ruleId,
      error,
    });
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la règle' },
      { status: 500 }
    );
  }
}
