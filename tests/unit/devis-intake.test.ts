import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DevisIntakeService } from '@/lib/services/devis-intake.service';

vi.mock('@/lib/db', () => ({
  db: {
    serviceRequest: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    contact: {
      update: vi.fn(),
    },
    notificationJob: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { db } from '@/lib/db';

describe('DevisIntakeService (Native Form Intake)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully processes native devis submission and marks COMPLETED', async () => {
    (db.serviceRequest.findFirst as any).mockResolvedValue({
      id: 'req_native_01',
      vapiCallId: 'call_test_123',
      contactId: 'contact_test_01',
      businessId: 'biz_batiment_01',
      status: 'NOT_COMPLETED',
      contact: {
        name: 'Alex Martin',
        phoneNumber: '+33612345678',
      },
      business: {
        id: 'biz_batiment_01',
        alertPhoneNumber: '+33612857915',
        outboundPhoneNumber: '+33939036462',
      },
    });

    (db.serviceRequest.update as any).mockResolvedValue({
      id: 'req_native_01',
      status: 'COMPLETED',
    });
    (db.contact.update as any).mockResolvedValue({});
    (db.notificationJob.findFirst as any).mockResolvedValue(null);
    (db.notificationJob.create as any).mockResolvedValue({});

    const result = await DevisIntakeService.processSubmission({
      callId: 'call_test_123',
      name: 'Alex Martin Rénov',
      email: 'alex@example.com',
      address: '15 Rue de la Paix',
      postalCode: '75002',
      city: 'Paris',
      serviceType: 'Rénovation Cuisine',
      message: 'Travaux à démarrer en novembre',
    });

    expect(result.handled).toBe(true);
    expect(result.wasAlreadyCompleted).toBe(false);

    expect(db.serviceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req_native_01' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          address: '15 Rue de la Paix',
          postalCode: '75002',
          email: 'alex@example.com',
          serviceType: 'Rénovation Cuisine',
          message: 'Travaux à démarrer en novembre',
        }),
      })
    );

    expect(db.contact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'contact_test_01' },
        data: expect.objectContaining({
          name: 'Alex Martin Rénov',
          email: 'alex@example.com',
          address: '15 Rue de la Paix',
          postalCode: '75002',
          city: 'Paris',
        }),
      })
    );

    expect(db.notificationJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipient: '+33612857915',
          message: expect.stringContaining('NOUVEAU DEVIS (Formulaire Web)'),
        }),
      })
    );
  });

  it('skips duplicate notification if serviceRequest was already COMPLETED', async () => {
    (db.serviceRequest.findFirst as any).mockResolvedValue({
      id: 'req_native_02',
      vapiCallId: 'call_test_already_completed',
      contactId: 'contact_test_02',
      businessId: 'biz_batiment_01',
      status: 'COMPLETED',
      contact: {
        name: 'Alex Martin',
        phoneNumber: '+33612345678',
      },
      business: {
        id: 'biz_batiment_01',
      },
    });

    (db.serviceRequest.update as any).mockResolvedValue({ id: 'req_native_02' });
    (db.contact.update as any).mockResolvedValue({});

    const result = await DevisIntakeService.processSubmission({
      callId: 'call_test_already_completed',
      name: 'Alex Martin',
      address: '15 Rue de la Paix',
      postalCode: '75002',
    });

    expect(result.handled).toBe(true);
    expect(result.wasAlreadyCompleted).toBe(true);
    expect(db.notificationJob.create).not.toHaveBeenCalled();
  });

  it('returns handled: false when callId is not found', async () => {
    (db.serviceRequest.findFirst as any).mockResolvedValue(null);

    const result = await DevisIntakeService.processSubmission({
      callId: 'non_existent_call',
      name: 'Inconnu',
      address: 'Rue Inconnue',
      postalCode: '00000',
    });

    expect(result.handled).toBe(false);
    expect(result.reason).toBe('ServiceRequest not found');
  });

  it('fetches submission context for client hydration', async () => {
    (db.serviceRequest.findFirst as any).mockResolvedValue({
      id: 'req_ctx_01',
      vapiCallId: 'call_ctx_01',
      status: 'NOT_COMPLETED',
      serviceType: 'Peinture',
      message: 'Besoin devis 50m2',
      email: 'client@paris.fr',
      address: '22 Avenue Foch',
      postalCode: '75116',
      createdAt: new Date('2026-10-10T10:00:00Z'),
      contact: {
        name: 'Sarah Connor',
        phoneNumber: '+33698765432',
        email: 'client@paris.fr',
        address: '22 Avenue Foch',
        postalCode: '75116',
        city: 'Paris',
      },
    });

    const ctx = await DevisIntakeService.getSubmissionContext('call_ctx_01');
    expect(ctx).not.toBeNull();
    expect(ctx?.callId).toBe('call_ctx_01');
    expect(ctx?.name).toBe('Sarah Connor');
    expect(ctx?.phoneNumber).toBe('+33698765432');
    expect(ctx?.serviceType).toBe('Peinture');
  });
});
