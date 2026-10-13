import { describe, it, expect, vi } from 'vitest';
import {
  isMateriallyIdenticalRequest,
  PatientIntakeService,
} from '@/lib/services/patient-intake.service';
import { db } from '@/lib/db';
import { TenantService } from '@/lib/services/tenant.service';
import { CalendarAvailabilityService } from '@/lib/services/calendar-availability.service';
import { twilioClient } from '@/lib/integrations/twilio';

describe('Idempotency Comparison & Conflict Detection Unit Tests', () => {
  const baseExisting = {
    id: 'req_test_001',
    requestType: 'APPOINTMENT',
    callerNumber: '+33612345678',
    patientName: 'Jean Dupont',
    requestedDate: '2026-10-20',
    requestedTime: '14:30',
    serviceType: 'Pansement',
    postalCode: '75008',
    summary: 'Changement de pansement post-opératoire',
    urgency: false,
  };

  it('recognizes an identical duplicate payload', () => {
    const incoming = {
      requestType: 'appointment',
      caller: '+33612345678',
      patientName: 'Jean Dupont',
      requestedDate: '2026-10-20',
      requestedTime: '14:30',
      serviceType: 'Pansement',
      postalCode: '75008',
      summary: 'Changement de pansement post-opératoire',
      urgency: false,
    };

    const result = isMateriallyIdenticalRequest(baseExisting, incoming);
    expect(result.identical).toBe(true);
    expect(result.differences).toHaveLength(0);
  });

  it('normalizes French time formats (14h30 vs 14:30) as identical', () => {
    const incoming = {
      requestType: 'appointment',
      caller: '+33612345678',
      patientName: 'Jean Dupont',
      requestedDate: '2026-10-20',
      requestedTime: '14h30',
      serviceType: 'Pansement',
      postalCode: '75008',
      summary: 'Changement de pansement post-opératoire',
    };

    const result = isMateriallyIdenticalRequest(baseExisting, incoming);
    expect(result.identical).toBe(true);
  });

  it('normalizes French date formats (20/10/2026 vs 2026-10-20) as identical', () => {
    const incoming = {
      requestType: 'appointment',
      caller: '+33612345678',
      patientName: 'Jean Dupont',
      requestedDate: '20/10/2026',
      requestedTime: '14:30',
      serviceType: 'Pansement',
      postalCode: '75008',
      summary: 'Changement de pansement post-opératoire',
    };

    const result = isMateriallyIdenticalRequest(baseExisting, incoming);
    expect(result.identical).toBe(true);
  });

  it('normalizes phone number formats (+33 6 12 34 56 78 vs 0612345678) as identical', () => {
    const incoming = {
      requestType: 'appointment',
      caller: '06 12 34 56 78',
      patientName: 'Jean Dupont',
      requestedDate: '2026-10-20',
      requestedTime: '14:30',
      serviceType: 'Pansement',
      postalCode: '75008',
      summary: 'Changement de pansement post-opératoire',
    };

    const result = isMateriallyIdenticalRequest(baseExisting, incoming);
    expect(result.identical).toBe(true);
  });

  it('detects conflict for different requested times', () => {
    const incoming = {
      requestType: 'appointment',
      caller: '+33612345678',
      patientName: 'Jean Dupont',
      requestedDate: '2026-10-20',
      requestedTime: '15:00',
      serviceType: 'Pansement',
      postalCode: '75008',
      summary: 'Changement de pansement post-opératoire',
    };

    const result = isMateriallyIdenticalRequest(baseExisting, incoming);
    expect(result.identical).toBe(false);
    expect(result.differences).toContain('requestedTime');
  });

  it('detects conflict for different requested dates', () => {
    const incoming = {
      requestType: 'appointment',
      caller: '+33612345678',
      patientName: 'Jean Dupont',
      requestedDate: '2026-10-21',
      requestedTime: '14:30',
      serviceType: 'Pansement',
      postalCode: '75008',
      summary: 'Changement de pansement post-opératoire',
    };

    const result = isMateriallyIdenticalRequest(baseExisting, incoming);
    expect(result.identical).toBe(false);
    expect(result.differences).toContain('requestedDate');
  });

  it('detects conflict for different caller numbers', () => {
    const incoming = {
      requestType: 'appointment',
      caller: '+33698765432',
      patientName: 'Jean Dupont',
      requestedDate: '2026-10-20',
      requestedTime: '14:30',
      serviceType: 'Pansement',
      postalCode: '75008',
      summary: 'Changement de pansement post-opératoire',
    };

    const result = isMateriallyIdenticalRequest(baseExisting, incoming);
    expect(result.identical).toBe(false);
    expect(result.differences).toContain('callerNumber');
  });

  it('detects conflict for different patient names', () => {
    const incoming = {
      requestType: 'appointment',
      caller: '+33612345678',
      patientName: 'Marie Martin',
      requestedDate: '2026-10-20',
      requestedTime: '14:30',
      serviceType: 'Pansement',
      postalCode: '75008',
      summary: 'Changement de pansement post-opératoire',
    };

    const result = isMateriallyIdenticalRequest(baseExisting, incoming);
    expect(result.identical).toBe(false);
    expect(result.differences).toContain('patientName');
  });

  it('detects conflict for different service types', () => {
    const incoming = {
      requestType: 'appointment',
      caller: '+33612345678',
      patientName: 'Jean Dupont',
      requestedDate: '2026-10-20',
      requestedTime: '14:30',
      serviceType: 'Prise de sang',
      postalCode: '75008',
      summary: 'Changement de pansement post-opératoire',
    };

    const result = isMateriallyIdenticalRequest(baseExisting, incoming);
    expect(result.identical).toBe(false);
    expect(result.differences).toContain('serviceType');
  });

  it('detects conflict for different summaries or messages', () => {
    const incoming = {
      requestType: 'appointment',
      caller: '+33612345678',
      patientName: 'Jean Dupont',
      requestedDate: '2026-10-20',
      requestedTime: '14:30',
      serviceType: 'Pansement',
      postalCode: '75008',
      summary: 'Vaccination grippe',
    };

    const result = isMateriallyIdenticalRequest(baseExisting, incoming);
    expect(result.identical).toBe(false);
    expect(result.differences).toContain('summary');
  });

  it('allows valid replay when optional summary is omitted on retry', () => {
    const incoming = {
      requestType: 'appointment',
      caller: '+33612345678',
      patientName: 'Jean Dupont',
      requestedDate: '2026-10-20',
      requestedTime: '14:30',
      serviceType: 'Pansement',
      postalCode: '75008',
      // summary omitted
    };

    const result = isMateriallyIdenticalRequest(baseExisting, incoming);
    expect(result.identical).toBe(true);
  });

  it('never leaks patient details or values in the differences array', () => {
    const incoming = {
      requestType: 'appointment',
      caller: '+33698765432',
      patientName: 'Marie Martin',
      requestedDate: '2026-10-25',
      requestedTime: '17:00',
      serviceType: 'Chimiothérapie',
      postalCode: '13001',
      summary: 'Soin palliatif confidentiel',
    };

    const result = isMateriallyIdenticalRequest(baseExisting, incoming);
    expect(result.identical).toBe(false);

    // Assert that differences array only contains clean field identifiers
    for (const diff of result.differences) {
      expect(diff).not.toContain('Marie');
      expect(diff).not.toContain('Jean');
      expect(diff).not.toContain('336');
      expect(diff).not.toContain('palliatif');
      expect(diff).not.toContain('2026');
      expect(diff).not.toContain('17:00');
      expect(diff).toMatch(/^(requestType|callerNumber|requestedDate|requestedTime|patientName|serviceType|postalCode|summary|urgency)$/);
    }
  });

  describe('P2002 Race Condition Recovery Path', () => {
    it('returns existing request on P2002 race when payloads are identical', async () => {
      vi.spyOn(TenantService, 'ensureTenant').mockResolvedValue({
        id: 'biz_michelle_test',
        name: 'Cabinet Michelle',
        slug: 'CABINET_MICHELLE',
        alertPhoneNumber: '+33600000000',
        inboundPhoneNumber: '+33100000000',
        calendarId: 'cal_test',
        createdAt: new Date(),
        updatedAt: new Date(),
        assistants: [],
        allowlistEntries: [],
      } as any);

      (vi.spyOn(CalendarAvailabilityService, 'checkDirectAvailability') as any).mockResolvedValue({
        isAvailable: true,
        reason: 'available',
        start: new Date(),
        end: new Date(),
      });
      (vi.spyOn(twilioClient, 'lookupLineType') as any).mockResolvedValue({
        type: 'mobile',
        carrierName: 'Test Carrier',
      });

      // Mock db.patientRequest.findUnique to simulate precheck missing, but P2002 existing
      let callCount = 0;
      (vi.spyOn(db.patientRequest, 'findUnique') as any).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // precheck returns null
          return null;
        }
        // P2002 recovery findUnique returns existing
        return {
          id: 'req_existing_p2002',
          businessId: 'biz_michelle_test',
          vapiCallId: 'call_p2002_001',
          callerNumber: '+33612345678',
          patientName: 'Jean Dupont',
          requestType: 'APPOINTMENT' as any,
          postalCode: '75008',
          serviceType: 'Pansement',
          requestedDate: '2026-10-20',
          requestedTime: '14:30',
          summary: 'Pansement post-op',
          urgency: false,
          status: 'PENDING' as any,
          metadata: null,
          contactId: 'cnt_001',
          callRecordId: 'rec_001',
          appointmentId: 'apt_001',
          serviceRequestId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });

      // Mock db.$transaction to throw P2002
      (vi.spyOn(db, '$transaction') as any).mockRejectedValue({
        code: 'P2002',
        message: 'Unique constraint failed on the fields: (`vapiCallId`,`requestType`)',
      });

      const result = await PatientIntakeService.handleDirectSubmission({
        callId: 'call_p2002_001',
        caller: '+33612345678',
        requestType: 'appointment',
        patientName: 'Jean Dupont',
        requestedDate: '2026-10-20',
        requestedTime: '14:30',
        serviceType: 'Pansement',
        postalCode: '75008',
        summary: 'Pansement post-op',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.requestId).toBe('req_existing_p2002');
        expect(result.isDuplicate).toBe(true);
      }

      vi.restoreAllMocks();
    });

    it('returns 409 IDEMPOTENCY_CONFLICT with generic message on P2002 race when payloads differ', async () => {
      vi.spyOn(TenantService, 'ensureTenant').mockResolvedValue({
        id: 'biz_michelle_test',
        name: 'Cabinet Michelle',
        slug: 'CABINET_MICHELLE',
        alertPhoneNumber: '+33600000000',
        inboundPhoneNumber: '+33100000000',
        calendarId: 'cal_test',
        createdAt: new Date(),
        updatedAt: new Date(),
        assistants: [],
        allowlistEntries: [],
      } as any);

      (vi.spyOn(CalendarAvailabilityService, 'checkDirectAvailability') as any).mockResolvedValue({
        isAvailable: true,
        reason: 'available',
        start: new Date(),
        end: new Date(),
      });
      (vi.spyOn(twilioClient, 'lookupLineType') as any).mockResolvedValue({
        type: 'mobile',
        carrierName: 'Test Carrier',
      });

      let callCount = 0;
      (vi.spyOn(db.patientRequest, 'findUnique') as any).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return null; // precheck
        return {
          id: 'req_existing_p2002',
          businessId: 'biz_michelle_test',
          vapiCallId: 'call_p2002_002',
          callerNumber: '+33612345678',
          patientName: 'Jean Dupont',
          requestType: 'APPOINTMENT' as any,
          postalCode: '75008',
          serviceType: 'Pansement',
          requestedDate: '2026-10-20',
          requestedTime: '14:30',
          summary: 'Pansement post-op',
          urgency: false,
          status: 'PENDING' as any,
          metadata: null,
          contactId: 'cnt_001',
          callRecordId: 'rec_001',
          appointmentId: 'apt_001',
          serviceRequestId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });

      (vi.spyOn(db, '$transaction') as any).mockRejectedValue({
        code: 'P2002',
        message: 'Unique constraint failed on the fields: (`vapiCallId`,`requestType`)',
      });

      const result = await PatientIntakeService.handleDirectSubmission({
        callId: 'call_p2002_002',
        caller: '+33612345678',
        requestType: 'appointment',
        patientName: 'Alice Secret', // Different patient name!
        requestedDate: '2026-10-20',
        requestedTime: '14:30',
        serviceType: 'Pansement',
        postalCode: '75008',
        summary: 'Pansement post-op',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(409);
        expect(result.conflict).toBe(true);
        expect(result.error).toBe('IDEMPOTENCY_CONFLICT');
        // Must NOT contain Alice, Jean, or field names
        expect(result.message).toBe('The same call ID was submitted with different request details.');
      }

      vi.restoreAllMocks();
    });
  });
});
