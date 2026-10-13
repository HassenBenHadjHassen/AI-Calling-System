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
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
      callRecord: {
        findFirst: vi.fn(),
        upsert: vi.fn(),
      },
      serviceRequest: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      patientRequest: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
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

// Mock Twilio
vi.mock('@/lib/integrations/twilio', () => ({
  twilioClient: {
    sendSms: vi.fn().mockResolvedValue({ success: true, messageId: 'SM_mock_123' }),
    lookupLineType: vi.fn().mockResolvedValue({ type: 'mobile', carrier: 'Orange' }),
  },
}));

import { db } from '@/lib/db';
import { POST as patientIntakeHandler } from '@/app/api/webhooks/vapi/patient-intake/route';
import { AppointmentStatus, PatientRequestType, PatientRequestStatus } from '@prisma/client';

describe('Cabinet MICHEL Patient Intake API — Dual Format & Persistence', () => {
  const validSecret = 'my_secret_token_123';
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${validSecret}`,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (db.business.findUnique as any).mockResolvedValue({
      id: 'biz_michelle',
      slug: 'CABINET_MICHELLE',
      name: 'Cabinet Michelle',
      alertPhoneNumber: '+33612857915',
      calendarId: 'monaldi2b@gmail.com',
    });
    (db.contact.upsert as any).mockResolvedValue({
      id: 'contact_01',
      name: 'Jean Dupont',
      phoneNumber: '+33612345678',
    });
    (db.contact.update as any).mockResolvedValue({});
    (db.patient.upsert as any).mockResolvedValue({ id: 'patient_01' });
    (db.callRecord.upsert as any).mockResolvedValue({ id: 'call_rec_01' });
    (db.notificationJob.findFirst as any).mockResolvedValue(null);
    (db.notificationJob.create as any).mockResolvedValue({ id: 'job_01' });
    (db.notificationJob.findUnique as any).mockResolvedValue({
      id: 'job_01',
      status: 'PENDING',
      attemptCount: 0,
      maxAttempts: 5,
      recipient: '+33612857915',
      message: 'Test message',
    });
    (db.appointment.findMany as any).mockResolvedValue([]);
    (db.patientRequest.findUnique as any).mockResolvedValue(null);
    (db.patientRequest.findFirst as any).mockResolvedValue(null);
  });

  // 1. Valid appointment submission creates one pending request
  it('valid appointment submission creates one pending request (Format A)', async () => {
    (db.appointment.create as any).mockResolvedValue({
      id: 'appt_new_01',
      status: AppointmentStatus.PENDING,
      date: '2026-10-15',
      time: '10:00',
    });
    (db.patientRequest.create as any).mockResolvedValue({
      id: 'req_appt_01',
      requestType: PatientRequestType.APPOINTMENT,
      status: PatientRequestStatus.PENDING,
    });

    const body = {
      requestType: 'appointment',
      patientName: 'Jean Dupont',
      postalCode: '75008',
      serviceType: 'Pansement',
      requestedDate: '2026-10-15',
      requestedTime: '10:00',
      summary: 'Patient requests a dressing appointment.',
      urgency: false,
      caller: '+33612345678',
      callId: 'call_test_001',
    };

    const req = new NextRequest('http://localhost:3000/api/webhooks/vapi/patient-intake', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(body),
    });

    const res = await patientIntakeHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.requestId).toBe('req_appt_01');
    expect(json.requestType).toBe('appointment');
    expect(json.status).toBe('PENDING');
    expect(json.message).toContain('saved');

    // DB assertions
    expect(db.patientRequest.create).toHaveBeenCalledTimes(1);
    expect(db.appointment.create).toHaveBeenCalledTimes(1);
    expect(db.notificationJob.create).toHaveBeenCalledTimes(1);
  });

  // 2. Valid cancellation submission records a pending cancellation without immediately cancelling
  it('valid cancellation submission records a pending cancellation without immediately cancelling appointment', async () => {
    (db.appointment.findFirst as any).mockResolvedValue({
      id: 'appt_existing_confirmed',
      status: AppointmentStatus.CONFIRMED,
      date: '2026-10-15',
      time: '10:00',
      notes: 'Initial booking notes',
    });
    (db.serviceRequest.create as any).mockResolvedValue({ id: 'srv_cancel_01' });
    (db.patientRequest.create as any).mockResolvedValue({
      id: 'req_cancel_01',
      requestType: PatientRequestType.CANCELLATION,
      status: PatientRequestStatus.PENDING,
    });

    const body = {
      requestType: 'cancellation',
      patientName: 'Jean Dupont',
      postalCode: '',
      serviceType: 'Pansement',
      requestedDate: '2026-10-15',
      requestedTime: '10:00',
      summary: 'Patient wants to cancel the appointment.',
      urgency: false,
      caller: '+33612345678',
      callId: 'call_test_002',
    };

    const req = new NextRequest('http://localhost:3000/api/webhooks/vapi/patient-intake', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(body),
    });

    const res = await patientIntakeHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.requestType).toBe('cancellation');
    expect(json.status).toBe('PENDING');

    // Verify appointment was NOT marked CANCELLED
    expect(db.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'appt_existing_confirmed' },
        data: expect.objectContaining({
          notes: expect.stringContaining("DEMANDE D'ANNULATION EN ATTENTE"),
        }),
      })
    );
    expect(db.serviceRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: 'ANNULATION',
          status: 'NOT_COMPLETED',
        }),
      })
    );
  });

  // 3. Valid message submission saves the message and does not create an appointment
  it('valid message submission saves message and does not create an appointment', async () => {
    (db.serviceRequest.create as any).mockResolvedValue({ id: 'srv_msg_01' });
    (db.patientRequest.create as any).mockResolvedValue({
      id: 'req_msg_01',
      requestType: PatientRequestType.MESSAGE,
      status: PatientRequestStatus.PENDING,
    });

    const body = {
      requestType: 'message',
      patientName: 'Marie Curie',
      postalCode: '',
      serviceType: '',
      requestedDate: '',
      requestedTime: '',
      summary: 'Patient called to ask if Mme MICHEL can do home visits.',
      urgency: false,
      caller: '+33698765432',
      callId: 'call_test_003',
    };

    const req = new NextRequest('http://localhost:3000/api/webhooks/vapi/patient-intake', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(body),
    });

    const res = await patientIntakeHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.requestType).toBe('message');

    // DB assertions: appointment.create must NOT be called
    expect(db.appointment.create).not.toHaveBeenCalled();
    expect(db.serviceRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: 'MESSAGE',
          status: 'MESSAGE',
        }),
      })
    );
  });

  // 4. Missing required appointment fields are rejected (HTTP 400)
  it('missing required appointment fields are rejected with HTTP 400', async () => {
    const invalidBodies = [
      // Missing patientName
      {
        requestType: 'appointment',
        patientName: '',
        postalCode: '75008',
        serviceType: 'Pansement',
        requestedDate: '2026-10-15',
        requestedTime: '10:00',
        caller: '+33612345678',
        callId: 'c1',
      },
      // Missing postalCode
      {
        requestType: 'appointment',
        patientName: 'Jean',
        postalCode: '',
        serviceType: 'Pansement',
        requestedDate: '2026-10-15',
        requestedTime: '10:00',
        caller: '+33612345678',
        callId: 'c2',
      },
      // Invalid 3-digit postalCode
      {
        requestType: 'appointment',
        patientName: 'Jean',
        postalCode: '750',
        serviceType: 'Pansement',
        requestedDate: '2026-10-15',
        requestedTime: '10:00',
        caller: '+33612345678',
        callId: 'c3',
      },
      // Missing serviceType
      {
        requestType: 'appointment',
        patientName: 'Jean',
        postalCode: '75008',
        serviceType: '',
        requestedDate: '2026-10-15',
        requestedTime: '10:00',
        caller: '+33612345678',
        callId: 'c4',
      },
      // Missing caller
      {
        requestType: 'appointment',
        patientName: 'Jean',
        postalCode: '75008',
        serviceType: 'Pansement',
        requestedDate: '2026-10-15',
        requestedTime: '10:00',
        caller: '',
        callId: 'c5',
      },
    ];

    for (const body of invalidBodies) {
      const req = new NextRequest('http://localhost:3000/api/webhooks/vapi/patient-intake', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(body),
      });

      const res = await patientIntakeHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Validation error');
    }
  });

  // 5. Invalid dates and times are rejected
  it('invalid dates and past dates are rejected with HTTP 400', async () => {
    // Past date
    const pastReq = new NextRequest('http://localhost:3000/api/webhooks/vapi/patient-intake', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        requestType: 'appointment',
        patientName: 'Jean Dupont',
        postalCode: '75008',
        serviceType: 'Pansement',
        requestedDate: '2020-01-15',
        requestedTime: '10:00',
        caller: '+33612345678',
        callId: 'call_past',
      }),
    });

    const pastRes = await patientIntakeHandler(pastReq);
    expect(pastRes.status).toBe(400);

    // Unparseable date format
    const badDateReq = new NextRequest('http://localhost:3000/api/webhooks/vapi/patient-intake', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        requestType: 'appointment',
        patientName: 'Jean Dupont',
        postalCode: '75008',
        serviceType: 'Pansement',
        requestedDate: 'demain-matin',
        requestedTime: 'dix-heures',
        caller: '+33612345678',
        callId: 'call_bad_dt',
      }),
    });

    const badDateRes = await patientIntakeHandler(badDateReq);
    expect(badDateRes.status).toBe(400);
  });

  // 6. Weekend and out-of-hours requests handled according to clinic policy (HTTP 409)
  it('weekend and lunch break requests are rejected with HTTP 409 conflict', async () => {
    // 2026-10-17 is Saturday
    const satReq = new NextRequest('http://localhost:3000/api/webhooks/vapi/patient-intake', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        requestType: 'appointment',
        patientName: 'Jean Dupont',
        postalCode: '75008',
        serviceType: 'Pansement',
        requestedDate: '2026-10-17',
        requestedTime: '10:00',
        caller: '+33612345678',
        callId: 'call_sat',
      }),
    });

    const satRes = await patientIntakeHandler(satReq);
    expect(satRes.status).toBe(409);
    const satJson = await satRes.json();
    expect(satJson.error).toBe('OUTSIDE_BUSINESS_HOURS');

    // Lunch break (13:00 to 14:00) on a Thursday (2026-10-15)
    const lunchReq = new NextRequest('http://localhost:3000/api/webhooks/vapi/patient-intake', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        requestType: 'appointment',
        patientName: 'Jean Dupont',
        postalCode: '75008',
        serviceType: 'Pansement',
        requestedDate: '2026-10-15',
        requestedTime: '13:00',
        caller: '+33612345678',
        callId: 'call_lunch',
      }),
    });

    const lunchRes = await patientIntakeHandler(lunchReq);
    expect(lunchRes.status).toBe(409);
  });

  // 7. Unavailable appointment slots do not produce false success
  it('conflicting booked slot returns HTTP 409 conflict', async () => {
    // Mock existing booked appointment for that slot in DB
    (db.appointment.findMany as any).mockResolvedValue([
      {
        id: 'existing_conflict',
        startTime: new Date('2026-10-15T08:00:00Z'),
        endTime: new Date('2026-10-15T09:00:00Z'),
      },
    ]);

    const req = new NextRequest('http://localhost:3000/api/webhooks/vapi/patient-intake', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        requestType: 'appointment',
        patientName: 'Jean Dupont',
        postalCode: '75008',
        serviceType: 'Pansement',
        requestedDate: '2026-10-15',
        requestedTime: '10:00',
        caller: '+33612345678',
        callId: 'call_conflict',
      }),
    });

    const res = await patientIntakeHandler(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe('SLOT_CONFLICT');
    expect(db.appointment.create).not.toHaveBeenCalled();
  });

  // 8. Repeating the same submission does not create duplicates
  it('repeating the same submission returns existing record without creating duplicates', async () => {
    (db.patientRequest.findUnique as any).mockResolvedValue({
      id: 'existing_req_123',
      requestType: PatientRequestType.APPOINTMENT,
      status: PatientRequestStatus.PENDING,
    });

    const body = {
      requestType: 'appointment',
      patientName: 'Jean Dupont',
      postalCode: '75008',
      serviceType: 'Pansement',
      requestedDate: '2026-10-15',
      requestedTime: '10:00',
      caller: '+33612345678',
      callId: 'call_repeat_123',
    };

    const req = new NextRequest('http://localhost:3000/api/webhooks/vapi/patient-intake', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(body),
    });

    const res = await patientIntakeHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.requestId).toBe('existing_req_123');
    expect(json.isDuplicate).toBe(true);

    expect(db.patientRequest.create).not.toHaveBeenCalled();
    expect(db.appointment.create).not.toHaveBeenCalled();
  });

  // 9. Post-call webhook after pre-call submission does not create duplicate appointment or notification
  it('post-call webhook after pre-call submission enriches data without creating duplicate appointment', async () => {
    (db.webhookEvent.findUnique as any).mockResolvedValue(null);
    (db.webhookEvent.create as any).mockResolvedValue({ id: 'ev_post_01' });
    (db.webhookEvent.update as any).mockResolvedValue({});

    // Existing pre-call PatientRequest
    (db.patientRequest.findFirst as any).mockResolvedValue({
      id: 'req_midcall_01',
      requestType: PatientRequestType.APPOINTMENT,
      appointmentId: 'appt_midcall_01',
    });
    (db.appointment.findUnique as any).mockResolvedValue({
      id: 'appt_midcall_01',
      status: AppointmentStatus.PENDING,
      notes: 'Mid-call booking',
    });
    (db.appointment.update as any).mockResolvedValue({
      id: 'appt_midcall_01',
      status: AppointmentStatus.PENDING,
    });

    const postCallPayload = {
      message: {
        type: 'end-of-call-report',
        call: { id: 'call_midcall_01' },
        customer: { number: '+33612345678' },
        artifact: {
          summary: 'Detailed post-call summary of the call',
          structuredOutputs: {},
        },
      },
    };

    const req = new NextRequest('http://localhost:3000/api/webhooks/vapi/patient-intake', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(postCallPayload),
    });

    const res = await patientIntakeHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.result.appointmentId).toBe('appt_midcall_01');

    // No second appointment created
    expect(db.appointment.create).not.toHaveBeenCalled();
  });

  // 10. Ordinary post-call webhook without prior submission still works
  it('ordinary post-call webhook without prior submission still creates appointment normally', async () => {
    (db.webhookEvent.findUnique as any).mockResolvedValue(null);
    (db.webhookEvent.create as any).mockResolvedValue({ id: 'ev_post_02' });
    (db.webhookEvent.update as any).mockResolvedValue({});
    (db.patientRequest.findFirst as any).mockResolvedValue(null);
    (db.appointment.findFirst as any).mockResolvedValue(null);
    (db.appointment.create as any).mockResolvedValue({
      id: 'appt_post_normal',
      status: AppointmentStatus.CONFIRMED_URGENT,
    });

    const payload = {
      message: {
        type: 'end-of-call-report',
        call: { id: 'call_normal_01' },
        customer: { number: '+33612345678' },
        artifact: {
          summary: 'Routine intake call',
          structuredOutputs: {
            '389d26dd-40e4-4670-9f2b-5acd1c40e6ee': {
              name: 'patient_intake',
              result: {
                patient_name: 'Alice Martin',
                date: '2026-10-15',
                heure: '14:00',
                code_postal: '75008',
                service_type: 'Pansement',
                urgency: true,
              },
            },
          },
        },
      },
    };

    const req = new NextRequest('http://localhost:3000/api/webhooks/vapi/patient-intake', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(payload),
    });

    const res = await patientIntakeHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(db.appointment.create).toHaveBeenCalledTimes(1);
  });

  // 11. Message-only calls are not misclassified as routine appointments
  it('message-only calls are saved as ServiceRequest and do not create routine appointments', async () => {
    (db.webhookEvent.findUnique as any).mockResolvedValue(null);
    (db.webhookEvent.create as any).mockResolvedValue({ id: 'ev_post_msg' });
    (db.webhookEvent.update as any).mockResolvedValue({});
    (db.patientRequest.findFirst as any).mockResolvedValue(null);
    (db.serviceRequest.create as any).mockResolvedValue({ id: 'srv_msg_post' });

    const payload = {
      message: {
        type: 'end-of-call-report',
        call: { id: 'call_msg_01' },
        customer: { number: '+33612345678' },
        artifact: {
          summary: 'Caller wanted to leave a message regarding invoice',
          structuredOutputs: {
            'e9485024-57be-4f6c-a745-4fef80b809a2': {
              name: 'call_outcome',
              result: true,
            },
            '389d26dd-40e4-4670-9f2b-5acd1c40e6ee': {
              name: 'patient_intake',
              result: {
                patient_name: 'Paul Durand',
                service_type: 'Message pour Mme MICHEL',
                message: 'Prière de me rappeler concernant le devis',
              },
            },
          },
        },
      },
    };

    const req = new NextRequest('http://localhost:3000/api/webhooks/vapi/patient-intake', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(payload),
    });

    const res = await patientIntakeHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result.outcome).toBe('MESSAGE_SAVED');
    expect(db.appointment.create).not.toHaveBeenCalled();
  });

  // 12. Requests with missing or incorrect credentials are rejected (HTTP 401)
  it('requests with missing or incorrect credentials are rejected with HTTP 401', async () => {
    // Missing credentials
    const noAuthReq = new NextRequest('http://localhost:3000/api/webhooks/vapi/patient-intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'message', callId: 'c_test' }),
    });

    const noAuthRes = await patientIntakeHandler(noAuthReq);
    expect(noAuthRes.status).toBe(401);

    // Incorrect Bearer token
    const wrongAuthReq = new NextRequest('http://localhost:3000/api/webhooks/vapi/patient-intake', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid_secret_token',
      },
      body: JSON.stringify({ requestType: 'message', callId: 'c_test' }),
    });

    const wrongAuthRes = await patientIntakeHandler(wrongAuthReq);
    expect(wrongAuthRes.status).toBe(401);
  });

  // 13. Database failures do not return success (HTTP 500)
  it('database failures do not return success (HTTP 500)', async () => {
    (db.patientRequest.findUnique as any).mockRejectedValue(new Error('Connection lost to PostgreSQL'));

    const req = new NextRequest('http://localhost:3000/api/webhooks/vapi/patient-intake', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        requestType: 'message',
        patientName: 'Jean Dupont',
        summary: 'A message',
        caller: '+33612345678',
        callId: 'call_db_fail',
      }),
    });

    const res = await patientIntakeHandler(req);
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.error).toBe('Internal server error');
    expect(json.success).toBeUndefined();
  });

  // 14. Support x-vapi-secret header as valid authentication mechanism
  it('authenticates successfully with x-vapi-secret header', async () => {
    (db.serviceRequest.create as any).mockResolvedValue({ id: 'srv_msg_xheader' });
    (db.patientRequest.create as any).mockResolvedValue({
      id: 'req_msg_xheader',
      requestType: PatientRequestType.MESSAGE,
      status: PatientRequestStatus.PENDING,
    });

    const req = new NextRequest('http://localhost:3000/api/webhooks/vapi/patient-intake', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vapi-secret': validSecret,
      },
      body: JSON.stringify({
        requestType: 'message',
        caller: '+33612345678',
        callId: 'call_x_header',
        summary: 'Message using x-vapi-secret',
      }),
    });

    const res = await patientIntakeHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
