import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DateTime } from 'luxon';
import { logger } from '@/lib/logger';

function formatIcalDateTime(date: Date): string {
  return DateTime.fromJSDate(date, { zone: 'utc' }).toFormat("yyyyMMdd'T'HHmmss'Z'");
}

function escapeIcalText(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export async function GET() {
  try {
    // Fetch upcoming and recent appointments for Cabinet Michelle
    const appointments = await db.appointment.findMany({
      where: {
        status: {
          in: ['CONFIRMED', 'CONFIRMED_URGENT', 'PENDING'],
        },
      },
      include: {
        contact: true,
        patient: true,
      },
      orderBy: { startTime: 'asc' },
      take: 200,
    });

    const nowStr = formatIcalDateTime(new Date());

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AI Calling System//Cabinet Michelle//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Cabinet Michelle - Rendez-vous',
      'X-WR-TIMEZONE:Europe/Paris',
    ];

    for (const appt of appointments) {
      const isUrgent = appt.urgency || appt.status === 'CONFIRMED_URGENT';
      const patientName = appt.contact?.name || 'Patient';
      const phone = appt.contact?.phoneNumber || 'Non renseigné';
      const service = appt.serviceType || 'Soins Infirmiers';

      const summary = `${isUrgent ? '🚨 URGENT: ' : '🩺 RDV: '}${patientName} (${service})`;
      const description =
        `Patient : ${patientName}\\n` +
        `Téléphone : ${phone}\\n` +
        `Prestation : ${service}\\n` +
        `Statut : ${appt.status}\\n` +
        `Créé le : ${appt.createdAt.toISOString()}\\n` +
        (appt.notes ? `Notes : ${appt.notes}` : '');

      lines.push(
        'BEGIN:VEVENT',
        `UID:${appt.id}@aicallingsystem.local`,
        `DTSTAMP:${nowStr}`,
        `DTSTART:${formatIcalDateTime(appt.startTime)}`,
        `DTEND:${formatIcalDateTime(appt.endTime)}`,
        `SUMMARY:${escapeIcalText(summary)}`,
        `DESCRIPTION:${escapeIcalText(description)}`,
        `STATUS:${appt.status === 'PENDING' ? 'TENTATIVE' : 'CONFIRMED'}`,
        'END:VEVENT'
      );
    }

    lines.push('END:VCALENDAR');

    const icsContent = lines.join('\r\n') + '\r\n';

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="michelle-calendar.ics"',
        'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
      },
    });
  } catch (error: unknown) {
    logger.error('iCal feed generation error', {
      module: 'ICAL_FEED',
      error,
    });
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
