import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CallRoutingService } from '@/lib/services/call-routing.service';
import { db } from '@/lib/db';
import { RoutingAction } from '@prisma/client';

// Mock DB
vi.mock('@/lib/db', () => ({
  db: {
    business: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    assistantConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    callerAllowlist: {
      upsert: vi.fn(),
    },
    callerRoutingRule: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe('CallRoutingService (Unit Tests)', () => {
  const mockCabinetBusiness = {
    id: 'biz_michelle_uuid',
    slug: 'CABINET_MICHELLE',
    name: 'Cabinet Michelle',
    inboundPhoneNumber: '+33939033663',
    outboundPhoneNumber: null,
    priorityTransferNumber: '+33612857915',
    routingEnabled: true,
    assistants: [
      {
        id: 'asst_cfg_1',
        assistantId: 'assistant_michelle_id',
        businessId: 'biz_michelle_uuid',
      },
    ],
  };

  const mockDaniBusiness = {
    id: 'biz_dani_uuid',
    slug: 'DANI_BATIMENT',
    name: 'Dani Bâtiment',
    inboundPhoneNumber: null,
    outboundPhoneNumber: '+33939036462',
    priorityTransferNumber: '+33699887766',
    routingEnabled: true,
    assistants: [
      {
        id: 'asst_cfg_2',
        assistantId: 'assistant_dani_id',
        businessId: 'biz_dani_uuid',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveBusinessByDestination', () => {
    it('resolves business matching destination phone number', async () => {
      (db.business.findFirst as any).mockResolvedValue(mockCabinetBusiness);

      const business = await CallRoutingService.resolveBusinessByDestination('+33939033663');
      expect(business).toBeDefined();
      expect(business?.slug).toBe('CABINET_MICHELLE');
      expect(db.business.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { inboundPhoneNumber: '+33939033663' },
              { outboundPhoneNumber: '+33939033663' },
            ],
          }),
        })
      );
    });

    it('returns null when destination number does not match any business', async () => {
      (db.business.findFirst as any).mockResolvedValue(null);

      const business = await CallRoutingService.resolveBusinessByDestination('+33199999999');
      expect(business).toBeNull();
    });

    it('returns null when destination number is missing or empty', async () => {
      const business = await CallRoutingService.resolveBusinessByDestination('');
      expect(business).toBeNull();
    });
  });

  describe('evaluateInboundCall', () => {
    it('returns NOT_FOUND if destination number does not match any business', async () => {
      (db.business.findFirst as any).mockResolvedValue(null);

      const result = await CallRoutingService.evaluateInboundCall({
        destinationNumber: '+33199999999',
        callerNumber: '+33612345678',
      });

      expect(result.decision).toBe('NOT_FOUND');
      expect(result.error).toContain('not recognized');
    });

    it('returns ROUTING_DISABLED and assistantId if routing is disabled for business', async () => {
      (db.business.findFirst as any).mockResolvedValue({
        ...mockCabinetBusiness,
        routingEnabled: false,
      });

      const result = await CallRoutingService.evaluateInboundCall({
        destinationNumber: '+33939033663',
        callerNumber: '+33612345678',
      });

      expect(result.decision).toBe('ROUTING_DISABLED');
      expect(result.assistantId).toBe('assistant_michelle_id');
      expect(db.callerRoutingRule.findFirst).not.toHaveBeenCalled();
    });

    it('returns BLOCKED with spam rejection error when caller is blacklisted', async () => {
      (db.business.findFirst as any).mockResolvedValue(mockCabinetBusiness);
      (db.callerRoutingRule.findFirst as any).mockResolvedValue({
        id: 'rule_block_1',
        businessId: mockCabinetBusiness.id,
        phoneNumber: '+33699999999',
        action: RoutingAction.BLOCK,
        label: 'Robot Spammer',
        active: true,
      });

      const result = await CallRoutingService.evaluateInboundCall({
        destinationNumber: '+33939033663',
        callerNumber: '+33699999999',
      });

      expect(result.decision).toBe('BLOCKED');
      expect(result.error).toBe('Cet appel ne peut pas être pris en charge.');
      expect(result.ruleId).toBe('rule_block_1');
    });

    it('returns DIRECT_TRANSFER with destination when caller is whitelisted', async () => {
      (db.business.findFirst as any).mockResolvedValue(mockCabinetBusiness);
      (db.callerRoutingRule.findFirst as any).mockResolvedValue({
        id: 'rule_direct_1',
        businessId: mockCabinetBusiness.id,
        phoneNumber: '+33611223344',
        action: RoutingAction.DIRECT,
        label: 'Directeur Cabinet',
        active: true,
      });

      const result = await CallRoutingService.evaluateInboundCall({
        destinationNumber: '+33939033663',
        callerNumber: '+33611223344',
      });

      expect(result.decision).toBe('DIRECT_TRANSFER');
      expect(result.destinationNumber).toBe('+33612857915');
      expect(result.ruleId).toBe('rule_direct_1');
    });

    it('returns CONFIG_ERROR if DIRECT rule matches but priorityTransferNumber is missing', async () => {
      (db.business.findFirst as any).mockResolvedValue({
        ...mockCabinetBusiness,
        priorityTransferNumber: null,
      });
      (db.callerRoutingRule.findFirst as any).mockResolvedValue({
        id: 'rule_direct_1',
        businessId: mockCabinetBusiness.id,
        phoneNumber: '+33611223344',
        action: RoutingAction.DIRECT,
        active: true,
      });

      const result = await CallRoutingService.evaluateInboundCall({
        destinationNumber: '+33939033663',
        callerNumber: '+33611223344',
      });

      expect(result.decision).toBe('CONFIG_ERROR');
      expect(result.error).toContain('Configuration de transfert prioritaire invalide');
    });

    it('returns DEFAULT_ASSISTANT if caller does not match any rule', async () => {
      (db.business.findFirst as any).mockResolvedValue(mockCabinetBusiness);
      (db.callerRoutingRule.findFirst as any).mockResolvedValue(null);

      const result = await CallRoutingService.evaluateInboundCall({
        destinationNumber: '+33939033663',
        callerNumber: '+33655555555',
      });

      expect(result.decision).toBe('DEFAULT_ASSISTANT');
      expect(result.assistantId).toBe('assistant_michelle_id');
    });

    it('ignores inactive rules and defaults to AI assistant', async () => {
      (db.business.findFirst as any).mockResolvedValue(mockCabinetBusiness);
      // Prisma query filters { active: true }, so inactive rule returns null
      (db.callerRoutingRule.findFirst as any).mockResolvedValue(null);

      const result = await CallRoutingService.evaluateInboundCall({
        destinationNumber: '+33939033663',
        callerNumber: '+33699999999',
      });

      expect(result.decision).toBe('DEFAULT_ASSISTANT');
      expect(result.assistantId).toBe('assistant_michelle_id');
    });

    it('handles missing or empty caller number safely without crashing', async () => {
      (db.business.findFirst as any).mockResolvedValue(mockCabinetBusiness);

      const result = await CallRoutingService.evaluateInboundCall({
        destinationNumber: '+33939033663',
        callerNumber: undefined,
      });

      expect(result.decision).toBe('DEFAULT_ASSISTANT');
      expect(result.assistantId).toBe('assistant_michelle_id');
    });

    it('strictly isolates businesses: Dani caller rule does not leak into Cabinet Michelle', async () => {
      // Incoming call to Dani Bâtiment destination
      (db.business.findFirst as any).mockResolvedValue(mockDaniBusiness);
      (db.callerRoutingRule.findFirst as any).mockImplementation((args: any) => {
        // Only return rule if businessId matches Dani
        if (args.where.businessId === mockDaniBusiness.id && args.where.phoneNumber === '+33688888888') {
          return Promise.resolve({
            id: 'rule_dani_1',
            businessId: mockDaniBusiness.id,
            phoneNumber: '+33688888888',
            action: RoutingAction.BLOCK,
            active: true,
          });
        }
        return Promise.resolve(null);
      });

      const result = await CallRoutingService.evaluateInboundCall({
        destinationNumber: '+33939036462', // Dani inbound
        callerNumber: '+33688888888',
      });

      expect(result.decision).toBe('BLOCKED');
      expect(result.businessSlug).toBe('DANI_BATIMENT');
    });
  });
});
