import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock DB
vi.mock('@/lib/db', () => {
  return {
    db: {
      business: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      assistantConfig: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      callerAllowlist: {
        findFirst: vi.fn(),
        upsert: vi.fn(),
      },
      contact: {
        findFirst: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
      },
      patient: {
        upsert: vi.fn(),
      },
      appointment: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      callRecord: {
        upsert: vi.fn(),
      },
      serviceRequest: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      webhookEvent: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      notificationJob: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

import { db } from '@/lib/db';
import { POST as clientVipHandler } from '@/app/api/webhooks/vapi/tools/client-vip/route';
import { POST as calendarHandler } from '@/app/api/webhooks/vapi/tools/calendar-availability/route';
import { POST as patientIntakeHandler } from '@/app/api/webhooks/vapi/patient-intake/route';
import { POST as daniBatimentHandler } from '@/app/api/webhooks/vapi/dani-batiment/route';
import { POST as twilioHandler } from '@/app/api/webhooks/twilio/inbound-sms/route';
import { POST as jotformHandler } from '@/app/api/webhooks/jotform/submission/route';
import fixtures from '../fixtures/make_scenarios.json';

describe('Next.js API Route Handlers Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.notificationJob.findUnique as any).mockResolvedValue({
      id: 'job_01',
      status: 'PENDING',
      attemptCount: 0,
      maxAttempts: 5,
      recipient: '+33612857915',
      message: 'Test alert',
    });
  });

  it('POST /api/webhooks/vapi/tools/client-vip returns valid Vapi tool result', async () => {
    (db.assistantConfig.findUnique as any).mockResolvedValue({
      assistantId: '97808c43-384a-4f40-a8dd-9149ba4988f5',
      business: { id: 'biz_01', slug: 'CABINET_MICHELLE' },
    });
    (db.callerAllowlist.findFirst as any).mockResolvedValue({ id: 'wl_01' });

    const req = new NextRequest('http://localhost:3000/api/webhooks/vapi/tools/client-vip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fixtures.clientVip.whitelistCaller),
    });

    const res = await clientVipHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.results).toBeDefined();
    expect(json.results[0].toolCallId).toBe('call_whitelist_001');
    expect(json.results[0].result).toContain('whitelist');
  });

  it('POST /api/webhooks/vapi/tools/calendar-availability returns free/busy response', async () => {
    const req = new NextRequest('http://localhost:3000/api/webhooks/vapi/tools/calendar-availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fixtures.calendarAvailability.summerDstSlot),
    });

    const res = await calendarHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.results[0].toolCallId).toBe('call_cal_summer_001');
    expect(json.results[0].result).toContain('available=True');
  });

  it('POST /api/webhooks/vapi/patient-intake processes intake and handles deduplication', async () => {
    (db.webhookEvent.findUnique as any).mockResolvedValue(null);
    (db.webhookEvent.create as any).mockResolvedValue({ id: 'ev_intake_01' });
    (db.webhookEvent.update as any).mockResolvedValue({});
    (db.business.findUnique as any).mockResolvedValue({
      id: 'biz_michelle',
      slug: 'CABINET_MICHELLE',
      alertPhoneNumber: '+33612857915',
    });
    (db.contact.upsert as any).mockResolvedValue({ id: 'contact_01', name: 'Claire Martin' });
    (db.patient.upsert as any).mockResolvedValue({ id: 'patient_01' });
    (db.callRecord.upsert as any).mockResolvedValue({ id: 'call_01' });
    (db.contact.update as any).mockResolvedValue({});
    (db.appointment.create as any).mockResolvedValue({ id: 'appt_01' });
    (db.notificationJob.findFirst as any).mockResolvedValue(null);
    (db.notificationJob.create as any).mockResolvedValue({});

    const req = new NextRequest('http://localhost:3000/api/webhooks/vapi/patient-intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fixtures.patientIntake.urgentMobile),
    });

    const res = await patientIntakeHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.result.outcome).toBe('CONFIRMED_URGENT');
  });

  it('POST /api/webhooks/vapi/dani-batiment processes building calls', async () => {
    (db.webhookEvent.findUnique as any).mockResolvedValue(null);
    (db.webhookEvent.create as any).mockResolvedValue({ id: 'ev_bat_01' });
    (db.webhookEvent.update as any).mockResolvedValue({});
    (db.business.findUnique as any).mockResolvedValue({
      id: 'biz_batiment',
      slug: 'DANI_BATIMENT',
      outboundPhoneNumber: '+33939036462',
      formUrl: 'https://form.jotform.com/260901590611047?callId={callId}',
    });
    (db.contact.upsert as any).mockResolvedValue({ id: 'contact_bat_01', name: 'Lucie Bernard' });
    (db.callRecord.upsert as any).mockResolvedValue({ id: 'call_bat_01' });
    (db.serviceRequest.create as any).mockResolvedValue({ id: 'req_01' });
    (db.notificationJob.findFirst as any).mockResolvedValue(null);
    (db.notificationJob.create as any).mockResolvedValue({});

    const req = new NextRequest('http://localhost:3000/api/webhooks/vapi/dani-batiment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fixtures.daniBatiment.devis),
    });

    const res = await daniBatimentHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.result.outcome).toBe('DEVIS');
  });

  it('POST /api/webhooks/twilio/inbound-sms returns valid TwiML XML', async () => {
    (db.webhookEvent.findUnique as any).mockResolvedValue(null);
    (db.webhookEvent.create as any).mockResolvedValue({ id: 'ev_sms_01' });
    (db.webhookEvent.update as any).mockResolvedValue({});
    (db.business.findUnique as any).mockResolvedValue({
      id: 'biz_michelle',
      slug: 'CABINET_MICHELLE',
      inboundPhoneNumber: '+33939033663',
    });
    (db.appointment.findFirst as any).mockResolvedValue({
      id: 'appt_01',
      date: '2026-10-15',
      time: '14h00',
      startTime: new Date('2026-10-15T12:00:00Z'),
      endTime: new Date('2026-10-15T13:00:00Z'),
      contact: { name: 'Jean Dupont', phoneNumber: '+33601020304' },
    });
    (db.appointment.update as any).mockResolvedValue({});
    (db.notificationJob.findFirst as any).mockResolvedValue(null);
    (db.notificationJob.create as any).mockResolvedValue({});

    const formData = new FormData();
    formData.append('From', '+33612857915');
    formData.append('Body', 'OUI');
    formData.append('MessageSid', 'SM_test_sid_123');

    const req = new NextRequest('http://localhost:3000/api/webhooks/twilio/inbound-sms', {
      method: 'POST',
      body: formData,
    });

    const res = await twilioHandler(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/xml');

    const xmlText = await res.text();
    expect(xmlText).toContain('<Response');
  });

  it('POST /api/webhooks/jotform/submission enriches CRM request', async () => {
    (db.webhookEvent.findUnique as any).mockResolvedValue(null);
    (db.webhookEvent.create as any).mockResolvedValue({ id: 'ev_jot_01' });
    (db.webhookEvent.update as any).mockResolvedValue({});
    (db.serviceRequest.findFirst as any).mockResolvedValue({
      id: 'req_01',
      vapiCallId: 'vapi_batiment_devis_201',
      contactId: 'contact_01',
      status: 'NOT_COMPLETED',
      contact: { name: 'Lucie Bernard', phoneNumber: '+33655443322' },
      business: { id: 'biz_batiment' },
    });
    (db.serviceRequest.update as any).mockResolvedValue({ id: 'req_01', status: 'COMPLETED' });
    (db.contact.update as any).mockResolvedValue({});
    (db.notificationJob.findFirst as any).mockResolvedValue(null);
    (db.notificationJob.create as any).mockResolvedValue({});

    const req = new NextRequest('http://localhost:3000/api/webhooks/jotform/submission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fixtures.jotform.validSubmission),
    });

    const res = await jotformHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.result.handled).toBe(true);
  });
});
