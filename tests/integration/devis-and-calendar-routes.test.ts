import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  db: {
    serviceRequest: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    contact: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    appointment: {
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    notificationJob: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    business: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { db } from '@/lib/db';
import { POST as devisSubmitHandler, GET as devisContextHandler } from '@/app/api/forms/devis/route';
import { GET as icalFeedHandler } from '@/app/api/calendar/michelle.ics/route';
import { POST as blockSlotHandler } from '@/app/api/calendar/block/route';

describe('Native Devis & Calendar Route Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/forms/devis', () => {
    it('validates schema and processes quote submission', async () => {
      (db.serviceRequest.findFirst as any).mockResolvedValue({
        id: 'sr_001',
        vapiCallId: 'vapi_test_001',
        contactId: 'ct_001',
        businessId: 'biz_001',
        status: 'NOT_COMPLETED',
        contact: { name: 'Client Test', phoneNumber: '+33612345678' },
        business: { id: 'biz_001', alertPhoneNumber: '+33612857915' },
      });
      (db.serviceRequest.update as any).mockResolvedValue({ id: 'sr_001', status: 'COMPLETED' });
      (db.contact.update as any).mockResolvedValue({});
      (db.notificationJob.findFirst as any).mockResolvedValue(null);
      (db.notificationJob.create as any).mockResolvedValue({});

      const req = new NextRequest('http://localhost:3000/api/forms/devis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: 'vapi_test_001',
          name: 'Jean Moulin',
          email: 'jean@moulin.fr',
          address: '10 Rue de la République',
          postalCode: '69002',
          city: 'Lyon',
          serviceType: 'Peinture',
          message: 'Travaux urgents',
        }),
      });

      const res = await devisSubmitHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.result.handled).toBe(true);
    });

    it('rejects invalid payload with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/forms/devis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // missing callId, name, address
          postalCode: '75001',
        }),
      });

      const res = await devisSubmitHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.issues).toBeDefined();
    });
  });

  describe('GET /api/forms/devis', () => {
    it('returns context for pre-filling when callId is valid', async () => {
      (db.serviceRequest.findFirst as any).mockResolvedValue({
        id: 'sr_002',
        vapiCallId: 'vapi_test_002',
        status: 'NOT_COMPLETED',
        serviceType: 'Plomberie',
        message: 'Fuite eau',
        email: null,
        address: null,
        postalCode: null,
        createdAt: new Date(),
        contact: { name: 'Marc Veyrat', phoneNumber: '+33699887766' },
      });

      const req = new NextRequest('http://localhost:3000/api/forms/devis?callId=vapi_test_002');
      const res = await devisContextHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('Marc Veyrat');
    });

    it('returns 400 when callId query param is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/forms/devis');
      const res = await devisContextHandler(req);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/calendar/michelle.ics', () => {
    it('returns standard RFC 5545 iCalendar feed with text/calendar header', async () => {
      (db.appointment.findMany as any).mockResolvedValue([
        {
          id: 'appt_ical_01',
          startTime: new Date('2026-10-15T10:00:00Z'),
          endTime: new Date('2026-10-15T11:00:00Z'),
          status: 'CONFIRMED',
          urgency: false,
          serviceType: 'Prise de sang',
          createdAt: new Date('2026-10-10T10:00:00Z'),
          contact: { name: 'Paul Bocuse', phoneNumber: '+33611223344' },
        },
      ]);

      const res = await icalFeedHandler();
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/calendar');

      const text = await res.text();
      expect(text).toContain('BEGIN:VCALENDAR');
      expect(text).toContain('VERSION:2.0');
      expect(text).toContain('Cabinet Michelle');
      expect(text).toContain('BEGIN:VEVENT');
      expect(text).toContain('Paul Bocuse');
      expect(text).toContain('END:VEVENT');
      expect(text).toContain('END:VCALENDAR');
    });
  });

  describe('POST /api/calendar/block', () => {
    it('creates blocked time slot and appointment', async () => {
      (db.business.findUnique as any).mockResolvedValue({
        id: 'biz_michelle_01',
        slug: 'CABINET_MICHELLE',
      });
      (db.contact.findFirst as any).mockResolvedValue({ id: 'contact_staff_01' });
      (db.appointment.create as any).mockResolvedValue({
        id: 'appt_block_01',
        serviceType: 'INDISPONIBLE: Formation',
        status: 'CONFIRMED',
      });

      const req = new NextRequest('http://localhost:3000/api/calendar/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Formation premiers secours',
          start: '2026-10-20T14:00:00Z',
          end: '2026-10-20T18:00:00Z',
          notes: 'Absente de 14h à 18h',
        }),
      });

      const res = await blockSlotHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.appointment.id).toBe('appt_block_01');
    });
  });
});
