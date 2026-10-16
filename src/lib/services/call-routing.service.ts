import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { normalizePhoneNumber, isValidE164 } from '@/lib/validation/phone';
import { TenantService } from './tenant.service';
import { RoutingAction } from '@prisma/client';
import { logger } from '@/lib/logger';

export type RoutingDecisionType =
  | 'NOT_FOUND'
  | 'ROUTING_DISABLED'
  | 'BLOCKED'
  | 'DIRECT_TRANSFER'
  | 'DEFAULT_ASSISTANT'
  | 'CONFIG_ERROR';

export interface RoutingEvaluationResult {
  decision: RoutingDecisionType;
  assistantId?: string;
  destinationNumber?: string;
  error?: string;
  businessId?: string;
  businessSlug?: string;
  ruleId?: string;
}

export class CallRoutingService {
  /**
   * Resolves the client business using the incoming destination phone number dialed by the caller.
   * NEVER resolves business based on the caller's number to guarantee tenant isolation.
   */
  static async resolveBusinessByDestination(destinationPhone?: string | null) {
    if (!destinationPhone) return null;
    const normalized = normalizePhoneNumber(destinationPhone);
    if (!normalized) return null;

    // 1. Direct DB lookup by configured inbound or outbound phone number
    let business = await db.business.findFirst({
      where: {
        OR: [
          { inboundPhoneNumber: normalized },
          { outboundPhoneNumber: normalized },
        ],
      },
      include: {
        assistants: true,
      },
    });

    if (business) return business;

    // 2. Fallback to bootstrap defaults if matching known cabinet/building phones
    const cabinetInbound = normalizePhoneNumber(env.CABINET_INBOUND_PHONE);
    const batimentOutbound = normalizePhoneNumber(env.BATIMENT_OUTBOUND_PHONE);

    if (normalized === cabinetInbound) {
      await TenantService.ensureTenant('CABINET_MICHELLE');
      business = await db.business.findUnique({
        where: { slug: 'CABINET_MICHELLE' },
        include: { assistants: true },
      });
      return business;
    }

    if (normalized === batimentOutbound) {
      await TenantService.ensureTenant('DANI_BATIMENT');
      business = await db.business.findUnique({
        where: { slug: 'DANI_BATIMENT' },
        include: { assistants: true },
      });
      return business;
    }

    return null;
  }

  /**
   * Evaluates an incoming call against the business's call routing rules.
   * Operates within strict latency limits for Vapi's 7.5s webhook deadline.
   */
  static async evaluateInboundCall(params: {
    destinationNumber?: string;
    callerNumber?: string;
    callId?: string;
  }): Promise<RoutingEvaluationResult> {
    const log = logger.child({
      module: 'VAPI_ROUTING:Service',
      correlationId: params.callId || `route_${Date.now().toString(36)}`,
    });

    // 1. Resolve business from destination number only
    const business = await this.resolveBusinessByDestination(params.destinationNumber);
    if (!business) {
      log.warn('[CallRouting] Destination phone number does not map to any tenant', {
        destinationProvided: Boolean(params.destinationNumber),
      });
      return {
        decision: 'NOT_FOUND',
        error: 'Destination phone number is not recognized by any tenant',
      };
    }

    // 2. Resolve client assistant ID
    let assistantId = business.assistants?.[0]?.assistantId;
    if (!assistantId) {
      if (business.slug === 'CABINET_MICHELLE') {
        assistantId = env.CABINET_ASSISTANT_ID;
      } else if (business.slug === 'DANI_BATIMENT') {
        assistantId = env.BATIMENT_ASSISTANT_ID;
      }
    }

    if (!assistantId) {
      log.error('[CallRouting] Business has no configured voice assistant ID', {
        businessId: business.id,
        slug: business.slug,
      });
      return {
        decision: 'CONFIG_ERROR',
        error: 'No assistant ID configured for resolved tenant',
        businessId: business.id,
        businessSlug: business.slug,
      };
    }

    // 3. Case A: Routing is disabled -> normal assistant selection immediately
    if (!business.routingEnabled) {
      log.info('[CallRouting] Call routing is disabled for tenant; routing to default assistant', {
        businessId: business.id,
        slug: business.slug,
        assistantId,
      });
      return {
        decision: 'ROUTING_DISABLED',
        assistantId,
        businessId: business.id,
        businessSlug: business.slug,
      };
    }

    // 4. Check caller number
    const normalizedCaller = normalizePhoneNumber(params.callerNumber);
    if (!normalizedCaller) {
      log.info('[CallRouting] Caller number missing or invalid; defaulting to normal assistant', {
        businessId: business.id,
        slug: business.slug,
      });
      return {
        decision: 'DEFAULT_ASSISTANT',
        assistantId,
        businessId: business.id,
        businessSlug: business.slug,
      };
    }

    // 5. Query matching active rule in database
    const matchingRule = await db.callerRoutingRule.findFirst({
      where: {
        businessId: business.id,
        phoneNumber: normalizedCaller,
        active: true,
      },
    });

    if (!matchingRule) {
      log.info('[CallRouting] Caller has no active routing rule; connecting to default assistant', {
        businessId: business.id,
        slug: business.slug,
        assistantId,
      });
      return {
        decision: 'DEFAULT_ASSISTANT',
        assistantId,
        businessId: business.id,
        businessSlug: business.slug,
      };
    }

    // 6. Case B: Caller is blacklisted (BLOCK)
    if (matchingRule.action === RoutingAction.BLOCK) {
      log.warn('[CallRouting] Blacklisted caller rejected before AI assistant start', {
        businessId: business.id,
        slug: business.slug,
        ruleId: matchingRule.id,
        label: matchingRule.label,
      });
      return {
        decision: 'BLOCKED',
        error: 'Désolé, nous ne pouvons pas donner suite à votre appel. Au revoir.',
        businessId: business.id,
        businessSlug: business.slug,
        ruleId: matchingRule.id,
      };
    }

    // 7. Case C: Caller is whitelisted (DIRECT transfer)
    if (matchingRule.action === RoutingAction.DIRECT) {
      const priorityDest = normalizePhoneNumber(business.priorityTransferNumber);
      if (!priorityDest || !isValidE164(priorityDest)) {
        log.error('[CallRouting] Whitelist DIRECT rule matched but priorityTransferNumber is missing or invalid', {
          businessId: business.id,
          slug: business.slug,
          ruleId: matchingRule.id,
          configuredDestination: business.priorityTransferNumber,
        });
        return {
          decision: 'CONFIG_ERROR',
          error: 'Configuration de transfert prioritaire invalide pour cet établissement.',
          businessId: business.id,
          businessSlug: business.slug,
          ruleId: matchingRule.id,
        };
      }

      log.info('[CallRouting] Whitelisted caller transferred directly to priority number', {
        businessId: business.id,
        slug: business.slug,
        ruleId: matchingRule.id,
        destination: priorityDest,
      });

      return {
        decision: 'DIRECT_TRANSFER',
        destinationNumber: priorityDest,
        businessId: business.id,
        businessSlug: business.slug,
        ruleId: matchingRule.id,
      };
    }

    // Default fallback
    return {
      decision: 'DEFAULT_ASSISTANT',
      assistantId,
      businessId: business.id,
      businessSlug: business.slug,
    };
  }
}
