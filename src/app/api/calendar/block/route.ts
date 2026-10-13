import { NextRequest, NextResponse } from 'next/server';
import { InternalCalendarService } from '@/lib/services/internal-calendar.service';
import { TenantService } from '@/lib/services/tenant.service';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const BlockSlotSchema = z.object({
  title: z.string().min(1, 'Titre requis'),
  start: z.string().datetime(),
  end: z.string().datetime(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const rawCorrId = req.headers.get('x-correlation-id');
  const correlationId = rawCorrId || `cal_block_${Date.now().toString(36)}`;
  const log = logger.child({ module: 'CALENDAR:Block', correlationId });

  // 1. Session & Permission Authentication (Better Auth)
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      log.warn('[Calendar Block] Unauthenticated request rejected');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { headers: { 'X-Correlation-Id': correlationId }, status: 401 }
      );
    }

    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, allowedSections: true },
    });

    const isAuthorized =
      dbUser?.role === 'ADMIN' ||
      dbUser?.role === 'STAFF' ||
      dbUser?.allowedSections === 'ALL' ||
      dbUser?.allowedSections?.includes('calendar');

    if (!isAuthorized) {
      log.warn('[Calendar Block] Unauthorized user attempted to block slot', {
        userId: session.user.id,
        role: dbUser?.role,
      });
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { headers: { 'X-Correlation-Id': correlationId }, status: 403 }
      );
    }
  } catch (authErr: unknown) {
    log.error('[Calendar Block Auth Error]', { error: authErr });
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { headers: { 'X-Correlation-Id': correlationId }, status: 401 }
    );
  }

  try {
    const rawBody = await req.json();
    const parsed = BlockSlotSchema.safeParse(rawBody);

    if (!parsed.success) {
      log.warn('[Calendar Block] Validation failed', { errors: parsed.error.flatten().fieldErrors });
      return NextResponse.json(
        { success: false, errors: parsed.error.flatten().fieldErrors },
        { headers: { 'X-Correlation-Id': correlationId }, status: 400 }
      );
    }

    const tenant = await TenantService.ensureTenant('CABINET_MICHELLE');

    const appt = await InternalCalendarService.blockTimeSlot({
      businessId: tenant.id,
      title: parsed.data.title,
      start: new Date(parsed.data.start),
      end: new Date(parsed.data.end),
      notes: parsed.data.notes,
    });

    log.info(`[Calendar Block] Successfully blocked slot: "${parsed.data.title}"`, {
      appointmentId: appt.id,
      start: parsed.data.start,
      end: parsed.data.end,
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json(
      { success: true, appointment: appt },
      { headers: { 'X-Correlation-Id': correlationId } }
    );
  } catch (error: unknown) {
    log.error('[Calendar Block Error]', { error, durationMs: Date.now() - startTime });
    return NextResponse.json(
      { success: false, error: 'Failed to block time slot' },
      { headers: { 'X-Correlation-Id': correlationId }, status: 500 }
    );
  }
}
