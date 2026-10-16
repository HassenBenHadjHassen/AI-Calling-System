import { NextRequest, NextResponse } from 'next/server';
import { verifyVapiSecret } from '@/lib/auth/vapi-auth';
import { VapiInboundRoutingPayloadSchema } from '@/lib/validation/schemas';
import { CallRoutingService } from '@/lib/services/call-routing.service';
import { logger } from '@/lib/logger';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/webhooks/vapi/inbound-routing',
    event: 'assistant-request',
    message: 'Vapi Inbound Call Routing Webhook is active.',
  });
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const rawCorrId = req.headers.get('x-correlation-id');

  // 1. Authenticate request using established Vapi secret verification
  const auth = verifyVapiSecret(req);
  if (!auth.authorized) {
    logger.warn('[Vapi Inbound Routing] Unauthorized request rejected', {
      error: auth.error,
    });
    return NextResponse.json(
      { error: 'Unauthorized', message: auth.error },
      { status: 401 }
    );
  }

  // 2. Parse request JSON body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // 3. Validate payload schema
  const parsed = VapiInboundRoutingPayloadSchema.safeParse(rawBody);

  if (!parsed.success) {
    logger.warn(
      `[Vapi Inbound Routing] Invalid webhook payload: ${JSON.stringify(parsed.error.issues)}`
    );

    return NextResponse.json(
      { error: 'Invalid payload schema', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const message = payload.message;
  const callId = message.call?.id;
  const correlationId = rawCorrId || (callId ? `vapi_${callId}` : `route_${Date.now().toString(36)}`);
  const log = logger.child({ module: 'VAPI_ROUTING:Webhook', correlationId });

  // 4. Handle non-routing event types safely
  if (message.type !== 'assistant-request') {
    log.info('[Vapi Inbound Routing] Ignored non-assistant-request event', {
      eventType: message.type,
    });
    return NextResponse.json(
      { message: `Event '${message.type}' ignored` },
      { status: 200 }
    );
  }

  // 5. Extract verified destination and caller phone numbers
  const destinationNumber = message.phoneNumber?.number || message.call?.phoneNumber?.number;
  const callerNumber = message.customer?.number || message.call?.customer?.number;

  log.info('[Vapi Inbound Routing] Processing assistant-request', {
    hasDestination: Boolean(destinationNumber),
    hasCaller: Boolean(callerNumber),
    callId,
  });

  // 6. Evaluate routing logic via CallRoutingService
  const result = await CallRoutingService.evaluateInboundCall({
    destinationNumber,
    callerNumber,
    callId,
  });

  log.info('[Vapi Inbound Routing] Routing decision evaluated', {
    decision: result.decision,
    businessSlug: result.businessSlug,
    durationMs: Date.now() - startTime,
  });

  // 7. Map decision to Vapi response contracts
  switch (result.decision) {
    // Case B: Blacklisted caller -> spam rejection error response
    case 'BLOCKED':
      return NextResponse.json(
        { error: 'Désolé, nous ne pouvons pas donner suite à votre appel. Au revoir.' },
        { status: 200 }
      );

    // Case C: Whitelisted caller -> direct transfer destination
    case 'DIRECT_TRANSFER':
      return NextResponse.json(
        {
          destination: {
            type: 'number',
            number: result.destinationNumber,
            message: '',
          },
        },
        { status: 200 }
      );

    // Case A & D: Routing disabled or normal caller -> return client voice assistant ID
    case 'ROUTING_DISABLED':
    case 'DEFAULT_ASSISTANT':
      return NextResponse.json(
        { assistantId: result.assistantId },
        { status: 200 }
      );

    // Tenant could not be identified -> fail closed safely without leaking another tenant
    case 'NOT_FOUND':
      return NextResponse.json(
        { error: 'Établissement non reconnu pour ce numéro d\'accueil.' },
        { status: 404 }
      );

    // Configuration error (e.g. missing assistant ID or invalid transfer number)
    case 'CONFIG_ERROR':
    default:
      return NextResponse.json(
        { error: result.error || 'Erreur de configuration d\'appel.' },
        { status: 200 }
      );
  }
}
