import { NextRequest, NextResponse } from 'next/server';
import { InternalCalendarService } from '@/lib/services/internal-calendar.service';
import { TenantService } from '@/lib/services/tenant.service';
import { z } from 'zod';

const BlockSlotSchema = z.object({
  title: z.string().min(1, 'Titre requis'),
  start: z.string().datetime(),
  end: z.string().datetime(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = BlockSlotSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
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

    return NextResponse.json({
      success: true,
      appointment: appt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[POST /api/calendar/block Error]:', message);
    return NextResponse.json(
      { success: false, error: 'Failed to block time slot' },
      { status: 500 }
    );
  }
}
