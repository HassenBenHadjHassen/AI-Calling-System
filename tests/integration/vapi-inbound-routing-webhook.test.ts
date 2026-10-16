import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as inboundRoutingPost, GET as inboundRoutingGet } from '@/app/api/webhooks/vapi/inbound-routing/route';
import { GET as routingSettingsGet, PATCH as routingSettingsPatch } from '@/app/api/business/[businessId]/routing/route';
import { POST as routingRuleCreate } from '@/app/api/business/[businessId]/routing/rules/route';
import { PATCH as routingRulePatch, DELETE as routingRuleDelete } from '@/app/api/business/[businessId]/routing/rules/[ruleId]/route';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { RoutingAction } from '@prisma/client';

// Mock DB
vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
    business: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
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

// Mock Better Auth
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

describe('Vapi Inbound Routing Webhook & API Routes (Integration Tests)', () => {
  const mockBusiness = {
    id: 'biz_michelle_001',
    slug: 'CABINET_MICHELLE',
    name: 'Cabinet Michelle',
    inboundPhoneNumber: '+33939033663',
    outboundPhoneNumber: null,
    priorityTransferNumber: '+33612857915',
    routingEnabled: true,
    assistants: [
      {
        id: 'asst_1',
        assistantId: '97808c43-384a-4f40-a8dd-9149ba4988f5',
        businessId: 'biz_michelle_001',
      },
    ],
  };

  const VALID_AUTH_TOKEN = process.env.VAPI_WEBHOOK_SECRET || 'my_secret_token_123';
  const VALID_AUTH_HEADER = `Bearer ${VALID_AUTH_TOKEN}`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/webhooks/vapi/inbound-routing', () => {
    it('returns 401 when request is unauthenticated', async () => {
      const req = new NextRequest('http://localhost:3000/api/webhooks/vapi/inbound-routing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: { type: 'assistant-request' },
        }),
      });

      const res = await inboundRoutingPost(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 400 when JSON body is invalid or malformed', async () => {
      const req = new NextRequest('http://localhost:3000/api/webhooks/vapi/inbound-routing', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': VALID_AUTH_HEADER,
        },
        body: 'invalid-json-string{',
      });

      const res = await inboundRoutingPost(req);
      expect(res.status).toBe(400);
    });

    it('safely ignores non-assistant-request event with 200 OK', async () => {
      const req = new NextRequest('http://localhost:3000/api/webhooks/vapi/inbound-routing', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-vapi-secret': VALID_AUTH_TOKEN,
        },
        body: JSON.stringify({
          message: {
            type: 'status-update',
            call: { id: 'call_123' },
          },
        }),
      });

      const res = await inboundRoutingPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toContain('ignored');
    });

    it('Case B: Rejects blacklisted caller before starting assistant (Vapi spam rejection format)', async () => {
      (db.business.findFirst as any).mockResolvedValue(mockBusiness);
      (db.callerRoutingRule.findFirst as any).mockResolvedValue({
        id: 'rule_block_1',
        businessId: mockBusiness.id,
        phoneNumber: '+33699887766',
        action: RoutingAction.BLOCK,
        label: 'Spam robot',
        active: true,
      });

      const req = new NextRequest('http://localhost:3000/api/webhooks/vapi/inbound-routing', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': VALID_AUTH_HEADER,
        },
        body: JSON.stringify({
          message: {
            type: 'assistant-request',
            call: {
              id: 'call_test_block',
              phoneNumber: { number: '+33939033663' },
              customer: { number: '+33699887766' },
            },
          },
        }),
      });

      const res = await inboundRoutingPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        error: 'Désolé, nous ne pouvons pas donner suite à votre appel. Au revoir.',
      });
    });

    it('Case C: Transfers whitelisted caller directly to priority destination', async () => {
      (db.business.findFirst as any).mockResolvedValue(mockBusiness);
      (db.callerRoutingRule.findFirst as any).mockResolvedValue({
        id: 'rule_direct_1',
        businessId: mockBusiness.id,
        phoneNumber: '+33611223344',
        action: RoutingAction.DIRECT,
        label: 'Dr. Coordonnateur',
        active: true,
      });

      const req = new NextRequest('http://localhost:3000/api/webhooks/vapi/inbound-routing', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': VALID_AUTH_HEADER,
        },
        body: JSON.stringify({
          message: {
            type: 'assistant-request',
            call: {
              id: 'call_test_direct',
              phoneNumber: { number: '+33939033663' },
              customer: { number: '+33611223344' },
            },
          },
        }),
      });

      const res = await inboundRoutingPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        destination: {
          type: 'number',
          number: '+33612857915',
          message: '',
        },
      });
    });

    it('Case D: Connects normal caller to default AI voice assistant', async () => {
      (db.business.findFirst as any).mockResolvedValue(mockBusiness);
      (db.callerRoutingRule.findFirst as any).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/webhooks/vapi/inbound-routing', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': VALID_AUTH_HEADER,
        },
        body: JSON.stringify({
          message: {
            type: 'assistant-request',
            call: {
              id: 'call_test_normal',
              phoneNumber: { number: '+33939033663' },
              customer: { number: '+33655555555' },
            },
          },
        }),
      });

      const res = await inboundRoutingPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        assistantId: '97808c43-384a-4f40-a8dd-9149ba4988f5',
      });
    });

    it('Case A: Routing disabled returns assistantId directly', async () => {
      (db.business.findFirst as any).mockResolvedValue({
        ...mockBusiness,
        routingEnabled: false,
      });

      const req = new NextRequest('http://localhost:3000/api/webhooks/vapi/inbound-routing', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': VALID_AUTH_HEADER,
        },
        body: JSON.stringify({
          message: {
            type: 'assistant-request',
            call: {
              id: 'call_test_disabled',
              phoneNumber: { number: '+33939033663' },
              customer: { number: '+33699887766' },
            },
          },
        }),
      });

      const res = await inboundRoutingPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        assistantId: '97808c43-384a-4f40-a8dd-9149ba4988f5',
      });
    });

    it('fails safely with 404 if incoming destination number is unknown', async () => {
      (db.business.findFirst as any).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/webhooks/vapi/inbound-routing', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': VALID_AUTH_HEADER,
        },
        body: JSON.stringify({
          message: {
            type: 'assistant-request',
            call: {
              id: 'call_test_unknown_dest',
              phoneNumber: { number: '+33199999999' },
              customer: { number: '+33655555555' },
            },
          },
        }),
      });

      const res = await inboundRoutingPost(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain('non reconnu');
    });

    it('GET /api/webhooks/vapi/inbound-routing returns health check status', async () => {
      const res = await inboundRoutingGet();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ok');
      expect(data.event).toBe('assistant-request');
    });
  });

  describe('Routing Settings & Rules API Endpoints', () => {
    const adminUser = {
      id: 'admin_user_01',
      email: 'admin@example.com',
      role: 'ADMIN',
      assignedBusiness: 'ALL',
      allowedSections: 'ALL',
    };

    const michelleStaffUser = {
      id: 'staff_michelle_01',
      email: 'staff@cabinet.fr',
      role: 'USER',
      assignedBusiness: 'CABINET_MICHELLE',
      allowedSections: 'ALL',
    };

    const daniStaffUser = {
      id: 'staff_dani_01',
      email: 'staff@batiment.fr',
      role: 'USER',
      assignedBusiness: 'DANI_BATIMENT',
      allowedSections: 'ALL',
    };

    it('GET /api/business/[businessId]/routing returns settings and rules for admin', async () => {
      (auth.api.getSession as any).mockResolvedValue({ user: adminUser });
      (db.user.findUnique as any).mockResolvedValue(adminUser);
      (db.business.findFirst as any).mockResolvedValue(mockBusiness);
      (db.callerRoutingRule.findMany as any).mockResolvedValue([
        {
          id: 'rule_1',
          businessId: mockBusiness.id,
          phoneNumber: '+33612345678',
          action: RoutingAction.DIRECT,
          label: 'Directeur',
          active: true,
        },
      ]);

      const req = new NextRequest('http://localhost:3000/api/business/biz_michelle_001/routing');
      const res = await routingSettingsGet(req, {
        params: Promise.resolve({ businessId: 'biz_michelle_001' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.businessId).toBe('biz_michelle_001');
      expect(data.routingEnabled).toBe(true);
      expect(data.rules).toHaveLength(1);
    });

    it('PATCH /api/business/[businessId]/routing updates routingEnabled and transfer number', async () => {
      (auth.api.getSession as any).mockResolvedValue({ user: michelleStaffUser });
      (db.user.findUnique as any).mockResolvedValue(michelleStaffUser);
      (db.business.findFirst as any).mockResolvedValue(mockBusiness);
      (db.business.update as any).mockResolvedValue({
        ...mockBusiness,
        routingEnabled: true,
        priorityTransferNumber: '+33611112222',
      });

      const req = new NextRequest('http://localhost:3000/api/business/biz_michelle_001/routing', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          routingEnabled: true,
          priorityTransferNumber: '0611112222',
        }),
      });

      const res = await routingSettingsPatch(req, {
        params: Promise.resolve({ businessId: 'biz_michelle_001' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(db.business.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priorityTransferNumber: '+33611112222',
          }),
        })
      );
    });

    it('POST /api/business/[businessId]/routing/rules rejects duplicate phone number with 409', async () => {
      (auth.api.getSession as any).mockResolvedValue({ user: michelleStaffUser });
      (db.user.findUnique as any).mockResolvedValue(michelleStaffUser);
      (db.business.findFirst as any).mockResolvedValue(mockBusiness);
      (db.callerRoutingRule.findUnique as any).mockResolvedValue({
        id: 'existing_rule',
        phoneNumber: '+33612345678',
      });

      const req = new NextRequest('http://localhost:3000/api/business/biz_michelle_001/routing/rules', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: '0612345678',
          action: 'BLOCK',
          label: 'Spammer',
        }),
      });

      const res = await routingRuleCreate(req, {
        params: Promise.resolve({ businessId: 'biz_michelle_001' }),
      });

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('existe déjà');
    });

    it('POST /api/business/[businessId]/routing/rules successfully creates rule with 201', async () => {
      (auth.api.getSession as any).mockResolvedValue({ user: michelleStaffUser });
      (db.user.findUnique as any).mockResolvedValue(michelleStaffUser);
      (db.business.findFirst as any).mockResolvedValue(mockBusiness);
      (db.callerRoutingRule.findUnique as any).mockResolvedValue(null);
      (db.callerRoutingRule.create as any).mockResolvedValue({
        id: 'new_rule_1',
        businessId: mockBusiness.id,
        phoneNumber: '+33612345678',
        action: RoutingAction.BLOCK,
        label: 'Spam robot',
        active: true,
      });

      const req = new NextRequest('http://localhost:3000/api/business/biz_michelle_001/routing/rules', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: '0612345678',
          action: 'BLOCK',
          label: 'Spam robot',
        }),
      });

      const res = await routingRuleCreate(req, {
        params: Promise.resolve({ businessId: 'biz_michelle_001' }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.rule.phoneNumber).toBe('+33612345678');
    });

    it('PATCH /api/business/[businessId]/routing/rules/[ruleId] updates existing rule', async () => {
      (auth.api.getSession as any).mockResolvedValue({ user: michelleStaffUser });
      (db.user.findUnique as any).mockResolvedValue(michelleStaffUser);
      (db.business.findFirst as any).mockResolvedValue(mockBusiness);
      (db.callerRoutingRule.findFirst as any).mockResolvedValue({
        id: 'rule_1',
        businessId: mockBusiness.id,
        phoneNumber: '+33612345678',
        action: RoutingAction.BLOCK,
        label: 'Old label',
        active: true,
      });
      (db.callerRoutingRule.update as any).mockResolvedValue({
        id: 'rule_1',
        businessId: mockBusiness.id,
        phoneNumber: '+33612345678',
        action: RoutingAction.BLOCK,
        label: 'New label',
        active: false,
      });

      const req = new NextRequest('http://localhost:3000/api/business/biz_michelle_001/routing/rules/rule_1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          label: 'New label',
          active: false,
        }),
      });

      const res = await routingRulePatch(req, {
        params: Promise.resolve({ businessId: 'biz_michelle_001', ruleId: 'rule_1' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.rule.label).toBe('New label');
      expect(data.rule.active).toBe(false);
    });

    it('DELETE /api/business/[businessId]/routing/rules/[ruleId] deletes rule', async () => {
      (auth.api.getSession as any).mockResolvedValue({ user: michelleStaffUser });
      (db.user.findUnique as any).mockResolvedValue(michelleStaffUser);
      (db.business.findFirst as any).mockResolvedValue(mockBusiness);
      (db.callerRoutingRule.findFirst as any).mockResolvedValue({
        id: 'rule_1',
        businessId: mockBusiness.id,
      });
      (db.callerRoutingRule.delete as any).mockResolvedValue({});

      const req = new NextRequest('http://localhost:3000/api/business/biz_michelle_001/routing/rules/rule_1', {
        method: 'DELETE',
      });

      const res = await routingRuleDelete(req, {
        params: Promise.resolve({ businessId: 'biz_michelle_001', ruleId: 'rule_1' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.deletedRuleId).toBe('rule_1');
    });

    it('prevents cross-tenant access: Dani user cannot manage Cabinet Michelle routing', async () => {
      (auth.api.getSession as any).mockResolvedValue({ user: daniStaffUser });
      (db.user.findUnique as any).mockResolvedValue(daniStaffUser);
      (db.business.findFirst as any).mockResolvedValue(mockBusiness);

      const req = new NextRequest('http://localhost:3000/api/business/biz_michelle_001/routing');
      const res = await routingSettingsGet(req, {
        params: Promise.resolve({ businessId: 'biz_michelle_001' }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('droits d’accès');
    });
  });
});
