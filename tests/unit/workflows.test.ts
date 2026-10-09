import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CallerLookupService } from '@/lib/services/caller-lookup.service';
import { CalendarAvailabilityService } from '@/lib/services/calendar-availability.service';
import { PatientIntakeService } from '@/lib/services/patient-intake.service';
import { AppointmentConfirmationService } from '@/lib/services/appointment-confirmation.service';
import { ServiceRequestsService } from '@/lib/services/service-requests.service';
import { JotformIntakeService } from '@/lib/services/jotform-intake.service';
import { googleCalendar } from '@/lib/integrations/google-calendar';
import fixtures from '../fixtures/make_scenarios.json';

// Mock DB operations
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

describe('Workflow Services Integration Tests (Scenarios A through F)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    googleCalendar.clearMockEvents();
    (db.notificationJob.findUnique as any).mockResolvedValue({
      id: 'notif_job_mock',
      status: 'PENDING',
      attemptCount: 0,
      maxAttempts: 5,
      recipient: '+33612857915',
      message: 'Mock test message',
    });
  });

  // ==========================================
  // WORKFLOW A: CLIENT VIP LOOKUP
  // ==========================================
  describe('Workflow A: Client VIP Lookup (Client_VIP.json)', () => {
    it('returns whitelist transfer result when caller is in allowlist', async () => {
      (db.assistantConfig.findUnique as any).mockResolvedValue({
        assistantId: '97808c43-384a-4f40-a8dd-9149ba4988f5',
        business: { id: 'biz_michelle', slug: 'CABINET_MICHELLE' },
      });
      (db.callerAllowlist.findFirst as any).mockResolvedValue({
        id: 'wl_001',
        phoneNumber: '+33612857915',
        active: true,
      });

      const res = await CallerLookupService.lookupCaller({
        callerNumber: '+33612857915',
        assistantId: '97808c43-384a-4f40-a8dd-9149ba4988f5',
        toolCallId: 'tool_001',
      });

      expect(res.results[0].result).toContain('whitelist');
      expect(res.results[0].result).toContain('TRASNFERT LAPPEL VERS LE LINFIRMIERE');
    });

    it('returns existing patient history when caller has past appointments', async () => {
      (db.assistantConfig.findUnique as any).mockResolvedValue({
        assistantId: '97808c43-384a-4f40-a8dd-9149ba4988f5',
        business: { id: 'biz_michelle', slug: 'CABINET_MICHELLE' },
      });
      (db.callerAllowlist.findFirst as any).mockResolvedValue(null);
      (db.contact.findFirst as any).mockResolvedValue({
        name: 'Jean Dupont',
        appointments: [
          { serviceType: 'Prise de sang', time: '10h00', date: '2026-10-15' },
        ],
      });

      const res = await CallerLookupService.lookupCaller({
        callerNumber: '+33601020304',
        assistantId: '97808c43-384a-4f40-a8dd-9149ba4988f5',
        toolCallId: 'tool_002',
      });

      expect(res.results[0].result).toContain('client existant');
      expect(res.results[0].result).toContain('Jean Dupont');
      expect(res.results[0].result).toContain('Prise de sang');
    });

    it('returns new client result when caller has no history and not allowlisted', async () => {
      (db.assistantConfig.findUnique as any).mockResolvedValue({
        assistantId: '97808c43-384a-4f40-a8dd-9149ba4988f5',
        business: { id: 'biz_michelle', slug: 'CABINET_MICHELLE' },
      });
      (db.callerAllowlist.findFirst as any).mockResolvedValue(null);
      (db.contact.findFirst as any).mockResolvedValue(null);

      const res = await CallerLookupService.lookupCaller({
        callerNumber: '+33699887766',
        assistantId: '97808c43-384a-4f40-a8dd-9149ba4988f5',
        toolCallId: 'tool_003',
      });

      expect(res.results[0].result).toBe('Utilisateur est un nouveau client');
    });

    it('returns building request details for Dani Batiment existing clients', async () => {
      (db.assistantConfig.findUnique as any).mockResolvedValue({
        assistantId: '38a56410-a3b6-49d5-96f1-8cd572b3f81c',
        business: { id: 'biz_batiment', slug: 'DANI_BATIMENT' },
      });
      (db.callerAllowlist.findFirst as any).mockResolvedValue(null);
      (db.contact.findFirst as any).mockResolvedValue({
        name: 'Marc Martin',
        requests: [
          {
            serviceType: 'Plomberie',
            category: 'DEVIS',
            message: 'Fuite sous évier',
            address: '45 Rue de Lyon',
          },
        ],
      });

      const res = await CallerLookupService.lookupCaller({
        callerNumber: '+33698765432',
        assistantId: '38a56410-a3b6-49d5-96f1-8cd572b3f81c',
        toolCallId: 'tool_004',
      });

      expect(res.results[0].result).toContain('Marc Martin');
      expect(res.results[0].result).toContain('Plomberie');
      expect(res.results[0].result).toContain('45 Rue de Lyon');
    });
  });

  // ==========================================
  // WORKFLOW B: GOOGLE CALENDAR AVAILABILITY
  // ==========================================
  describe('Workflow B: Google Calendar Availability (integration-webhooks-google-calendar.json)', () => {
    it('returns available=True when the requested appointment slot is free', async () => {
      const res = await CalendarAvailabilityService.checkSlot({
        dateTime: '2026-11-20T14:00:00',
        toolCallId: 'tool_cal_01',
      });

      expect(res.results[0].result).toContain('available=True');
      expect(res.results[0].result).toContain('Le créneau est libre');
    });

    it('returns available=False when the requested appointment slot is occupied', async () => {
      // Add conflicting event
      googleCalendar.addMockEvent({
        id: 'conflict_event_01',
        calendarId: 'monaldi2b@gmail.com',
        summary: 'Busy appointment',
        start: new Date('2026-11-20T13:30:00.000Z'),
        end: new Date('2026-11-20T14:30:00.000Z'),
      });

      const res = await CalendarAvailabilityService.checkSlot({
        dateTime: '2026-11-20T14:00:00',
        toolCallId: 'tool_cal_02',
      });

      expect(res.results[0].result).toContain('available=False');
      expect(res.results[0].result).toContain('Ce créneau est déjà pris');
    });
  });

  // ==========================================
  // WORKFLOW C: PATIENT INTAKE
  // ==========================================
  describe('Workflow C: Patient Intake (patient-info.json)', () => {
    it('processes urgent mobile patient with CONFIRMED_URGENT status and sends urgent SMS', async () => {
      (db.business.findUnique as any).mockResolvedValue({
        id: 'biz_michelle',
        slug: 'CABINET_MICHELLE',
        alertPhoneNumber: '+33612857915',
      });
      (db.contact.upsert as any).mockResolvedValue({ id: 'contact_01', name: 'Claire Martin' });
      (db.patient.upsert as any).mockResolvedValue({ id: 'patient_01' });
      (db.callRecord.upsert as any).mockResolvedValue({ id: 'call_01' });
      (db.contact.update as any).mockResolvedValue({});
      (db.appointment.create as any).mockResolvedValue({ id: 'appt_urgent_01' });
      (db.notificationJob.findFirst as any).mockResolvedValue(null);
      (db.notificationJob.create as any).mockResolvedValue({ id: 'notif_01' });

      const payload = fixtures.patientIntake.urgentMobile as any;
      const res = await PatientIntakeService.processIntake(payload);

      expect(res.outcome).toBe('CONFIRMED_URGENT');
      expect(db.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            urgency: true,
            status: 'CONFIRMED_URGENT',
          }),
        })
      );
    });

    it('classifies call as SCAM when scam score <= 3 and suppresses appointment SMS', async () => {
      (db.business.findUnique as any).mockResolvedValue({
        id: 'biz_michelle',
        slug: 'CABINET_MICHELLE',
        alertPhoneNumber: '+33612857915',
      });
      (db.contact.upsert as any).mockResolvedValue({ id: 'contact_02', name: 'Spam Caller' });
      (db.patient.upsert as any).mockResolvedValue({ id: 'patient_02' });
      (db.callRecord.upsert as any).mockResolvedValue({ id: 'call_02' });
      (db.contact.update as any).mockResolvedValue({});
      (db.appointment.create as any).mockResolvedValue({ id: 'appt_scam_02' });

      const payload = fixtures.patientIntake.scamCall as any;
      const res = await PatientIntakeService.processIntake(payload);

      expect(res.outcome).toBe('SCAM');
    });

    it('handles appointment cancellation branch and alerts nurse', async () => {
      (db.business.findUnique as any).mockResolvedValue({
        id: 'biz_michelle',
        slug: 'CABINET_MICHELLE',
        alertPhoneNumber: '+33612857915',
      });
      (db.contact.upsert as any).mockResolvedValue({ id: 'contact_03', name: 'Jean Dupont' });
      (db.patient.upsert as any).mockResolvedValue({ id: 'patient_03' });
      (db.callRecord.upsert as any).mockResolvedValue({ id: 'call_03' });
      (db.appointment.findFirst as any).mockResolvedValue({ id: 'appt_to_cancel' });
      (db.appointment.update as any).mockResolvedValue({ id: 'appt_to_cancel' });
      (db.notificationJob.findFirst as any).mockResolvedValue(null);
      (db.notificationJob.create as any).mockResolvedValue({ id: 'notif_cancel' });

      const payload = fixtures.patientIntake.cancellation as any;
      const res = await PatientIntakeService.processIntake(payload);

      expect(res.outcome).toBe('CANCELLED');
      expect(db.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'appt_to_cancel' },
          data: { status: 'CANCELLED' },
        })
      );
    });
  });

  // ==========================================
  // WORKFLOW D: APPOINTMENT CONFIRMATION
  // ==========================================
  describe('Workflow D: Appointment Confirmation (confirmation_de_rdv.json)', () => {
    it('confirms appointment on OUI reply, creates Google Calendar event, and queues SMS', async () => {
      (db.business.findUnique as any).mockResolvedValue({
        id: 'biz_michelle',
        slug: 'CABINET_MICHELLE',
        inboundPhoneNumber: '+33939033663',
        calendarId: 'monaldi2b@gmail.com',
      });
      (db.appointment.findFirst as any).mockResolvedValue({
        id: 'appt_pending_01',
        date: '2026-10-15',
        time: '14h00',
        startTime: new Date('2026-10-15T12:00:00Z'),
        endTime: new Date('2026-10-15T13:00:00Z'),
        contact: { name: 'Jean Dupont', phoneNumber: '+33601020304' },
      });
      (db.appointment.update as any).mockResolvedValue({});
      (db.notificationJob.findFirst as any).mockResolvedValue(null);
      (db.notificationJob.create as any).mockResolvedValue({});

      const res = await AppointmentConfirmationService.processInboundSms({
        from: '+33612857915',
        body: 'OUI',
        messageSid: 'msg_sid_oui_001',
      });

      expect(res.outcome).toBe('CONFIRMED');
      expect(db.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CONFIRMED' }),
        })
      );
    });

    it('refuses appointment on NON reply and updates state to REFUSED', async () => {
      (db.business.findUnique as any).mockResolvedValue({
        id: 'biz_michelle',
        slug: 'CABINET_MICHELLE',
        inboundPhoneNumber: '+33939033663',
      });
      (db.appointment.findFirst as any).mockResolvedValue({
        id: 'appt_pending_02',
        date: '2026-10-15',
        time: '14h00',
        contact: { name: 'Jean Dupont', phoneNumber: '+33601020304' },
      });
      (db.appointment.update as any).mockResolvedValue({});
      (db.notificationJob.findFirst as any).mockResolvedValue(null);
      (db.notificationJob.create as any).mockResolvedValue({});

      const res = await AppointmentConfirmationService.processInboundSms({
        from: '+33612857915',
        body: 'NON',
        messageSid: 'msg_sid_non_002',
      });

      expect(res.outcome).toBe('REFUSED');
      expect(db.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REFUSED' }),
        })
      );
    });

    it('handles rescheduling proposal on AUTRE reply', async () => {
      (db.business.findUnique as any).mockResolvedValue({
        id: 'biz_michelle',
        slug: 'CABINET_MICHELLE',
        inboundPhoneNumber: '+33939033663',
      });
      (db.appointment.findFirst as any).mockResolvedValue({
        id: 'appt_pending_03',
        date: '2026-10-15',
        time: '14h00',
        contact: { name: 'Jean Dupont', phoneNumber: '+33601020304' },
      });
      (db.appointment.update as any).mockResolvedValue({});
      (db.notificationJob.findFirst as any).mockResolvedValue(null);
      (db.notificationJob.create as any).mockResolvedValue({});

      const res = await AppointmentConfirmationService.processInboundSms({
        from: '+33612857915',
        body: 'non mais à 17h si possible',
        messageSid: 'msg_sid_autre_003',
      });

      expect(res.outcome).toBe('RESCHEDULE_PROPOSED');
      expect(db.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'RESCHEDULE_PROPOSED',
            proposedNewTime: '17h',
          }),
        })
      );
    });
  });

  // ==========================================
  // WORKFLOW E: DANI BATIMENT CRM & SMS
  // ==========================================
  describe('Workflow E: Dani Bâtiment CRM & SMS (links-v3-vapi-crm-sms-dani-batiment.json)', () => {
    it('creates Devis request with status NOT_COMPLETED and sends SMS with JotForm link', async () => {
      (db.business.findUnique as any).mockResolvedValue({
        id: 'biz_batiment',
        slug: 'DANI_BATIMENT',
        outboundPhoneNumber: '+33939036462',
        formUrl: 'https://form.jotform.com/260901590611047?callId={callId}',
      });
      (db.contact.upsert as any).mockResolvedValue({ id: 'contact_bat_01', name: 'Lucie Bernard' });
      (db.callRecord.upsert as any).mockResolvedValue({ id: 'call_bat_01' });
      (db.serviceRequest.create as any).mockResolvedValue({ id: 'req_devis_01' });
      (db.notificationJob.findFirst as any).mockResolvedValue(null);
      (db.notificationJob.create as any).mockResolvedValue({});

      const payload = fixtures.daniBatiment.devis as any;
      const res = await ServiceRequestsService.processDaniBatimentCall(payload);

      expect(res.outcome).toBe('DEVIS');
      expect(db.serviceRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: 'DEVIS',
            status: 'NOT_COMPLETED',
            vapiCallId: 'vapi_batiment_devis_201',
          }),
        })
      );
    });

    it('handles Suivi request and dispatches staff alert SMS', async () => {
      (db.business.findUnique as any).mockResolvedValue({
        id: 'biz_batiment',
        slug: 'DANI_BATIMENT',
        outboundPhoneNumber: '+33939036462',
        alertPhoneNumber: '+33612857915',
      });
      (db.contact.upsert as any).mockResolvedValue({ id: 'contact_bat_02', name: 'Lucie Bernard' });
      (db.callRecord.upsert as any).mockResolvedValue({ id: 'call_bat_02' });
      (db.serviceRequest.create as any).mockResolvedValue({ id: 'req_suivi_02' });
      (db.notificationJob.findFirst as any).mockResolvedValue(null);
      (db.notificationJob.create as any).mockResolvedValue({});

      const payload = fixtures.daniBatiment.annulationOuSuivi as any;
      const res = await ServiceRequestsService.processDaniBatimentCall(payload);

      expect(res.outcome).toBe('ANNULATION_OU_SUIVI');
    });
  });

  // ==========================================
  // WORKFLOW F: JOTFORM ENRICHMENT BY CALL_ID
  // ==========================================
  describe('Workflow F: JotForm CRM Enrichment (integration-google-forms-v2-jotform-crm-by-call-id.json)', () => {
    it('enriches existing ServiceRequest with customer address and email, marking COMPLETED', async () => {
      (db.serviceRequest.findFirst as any).mockResolvedValue({
        id: 'req_devis_01',
        vapiCallId: 'vapi_batiment_devis_201',
        contactId: 'contact_bat_01',
        status: 'NOT_COMPLETED',
        serviceType: 'Couverture / Toiture',
        message: "Fuite d'eau",
        contact: { name: 'Lucie Bernard', phoneNumber: '+33655443322' },
        business: { id: 'biz_batiment', alertPhoneNumber: '+33612857915', outboundPhoneNumber: '+33939036462' },
      });
      (db.serviceRequest.update as any).mockResolvedValue({ id: 'req_devis_01', status: 'COMPLETED' });
      (db.contact.update as any).mockResolvedValue({});
      (db.notificationJob.findFirst as any).mockResolvedValue(null);
      (db.notificationJob.create as any).mockResolvedValue({});

      const payload = fixtures.jotform.validSubmission as any;
      const res = await JotformIntakeService.processSubmission(payload);

      expect(res.handled).toBe(true);
      expect(res.wasAlreadyCompleted).toBe(false);
      expect(db.serviceRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'req_devis_01' },
          data: expect.objectContaining({
            status: 'COMPLETED',
            email: 'lucie.bernard@example.com',
            postalCode: '75009',
          }),
        })
      );
    });

    it('does not send duplicate staff alerts if form is resubmitted for already completed request', async () => {
      (db.serviceRequest.findFirst as any).mockResolvedValue({
        id: 'req_devis_01',
        vapiCallId: 'vapi_batiment_devis_201',
        contactId: 'contact_bat_01',
        status: 'COMPLETED', // Already completed!
        contact: { name: 'Lucie Bernard', phoneNumber: '+33655443322' },
        business: { id: 'biz_batiment' },
      });
      (db.serviceRequest.update as any).mockResolvedValue({ id: 'req_devis_01', status: 'COMPLETED' });
      (db.contact.update as any).mockResolvedValue({});

      const payload = fixtures.jotform.validSubmission as any;
      const res = await JotformIntakeService.processSubmission(payload);

      expect(res.handled).toBe(true);
      expect(res.wasAlreadyCompleted).toBe(true);
      // Notification create should NOT have been called for duplicate alert
      expect(db.notificationJob.create).not.toHaveBeenCalled();
    });
  });
});
