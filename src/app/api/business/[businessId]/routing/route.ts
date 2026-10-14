import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyBusinessAccess } from '@/lib/auth/business-auth';
import { RoutingSettingsUpdateSchema } from '@/lib/validation/schemas';
import { normalizePhoneNumber, isValidE164 } from '@/lib/validation/phone';
import { logger } from '@/lib/logger';

interface RouteContext {
  params: Promise<{ businessId: string }>;
}

/**
 * GET /api/business/[businessId]/routing
 * Retrieves the business's call routing configuration and routing rules.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const { businessId } = await context.params;
  const auth = await verifyBusinessAccess(req.headers, businessId);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const rules = await db.callerRoutingRule.findMany({
      where: { businessId: auth.business!.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      businessId: auth.business!.id,
      businessName: auth.business!.name,
      businessSlug: auth.business!.slug,
      inboundPhoneNumber: auth.business!.inboundPhoneNumber,
      outboundPhoneNumber: auth.business!.outboundPhoneNumber,
      routingEnabled: auth.business!.routingEnabled,
      priorityTransferNumber: auth.business!.priorityTransferNumber,
      rules,
    });
  } catch (error: unknown) {
    logger.error('Failed to retrieve routing settings', {
      module: 'API_ROUTING',
      businessId,
      error,
    });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des paramètres de routage' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/business/[businessId]/routing
 * Updates routingEnabled flag and priorityTransferNumber destination.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
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

  const parsed = RoutingSettingsUpdateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données de configuration invalides', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  let normalizedTransferNumber: string | null | undefined = undefined;
  if (parsed.data.priorityTransferNumber !== undefined) {
    if (parsed.data.priorityTransferNumber === null || parsed.data.priorityTransferNumber.trim() === '') {
      normalizedTransferNumber = null;
    } else {
      const norm = normalizePhoneNumber(parsed.data.priorityTransferNumber);
      if (!isValidE164(norm)) {
        return NextResponse.json(
          { error: 'Le numéro de transfert prioritaire doit être un numéro E.164 valide (ex: +33612345678).' },
          { status: 400 }
        );
      }
      normalizedTransferNumber = norm;
    }
  }

  try {
    const updated = await db.business.update({
      where: { id: auth.business!.id },
      data: {
        ...(parsed.data.routingEnabled !== undefined && {
          routingEnabled: parsed.data.routingEnabled,
        }),
        ...(normalizedTransferNumber !== undefined && {
          priorityTransferNumber: normalizedTransferNumber,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      businessId: updated.id,
      routingEnabled: updated.routingEnabled,
      priorityTransferNumber: updated.priorityTransferNumber,
    });
  } catch (error: unknown) {
    logger.error('Failed to update routing settings', {
      module: 'API_ROUTING',
      businessId,
      error,
    });
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour des paramètres de routage' },
      { status: 500 }
    );
  }
}
