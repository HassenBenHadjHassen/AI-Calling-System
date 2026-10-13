import { NextRequest, NextResponse } from 'next/server';
import {
  VapiServerMessagePayloadSchema,
  DirectPatientSubmissionSchema,
} from '@/lib/validation/schemas';
import { PatientIntakeService } from '@/lib/services/patient-intake.service';
import { WebhookProcessingService } from '@/lib/services/webhook-processing.service';
import { WebhookProvider } from '@prisma/client';
import { verifyVapiSecret } from '@/lib/auth/vapi-auth';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const rawCorrId = req.headers.get('x-correlation-id');

  // 1. Shared Authentication Verification
  const auth = verifyVapiSecret(req);
  if (!auth.authorized) {
    logger.warn('[Vapi Patient Intake] Unauthorized request rejected', {
      error: auth.error,
    });
    return NextResponse.json(
      { error: 'Unauthorized', message: auth.error },
      { status: 401 }
    );
  }

  // 2. Parse request JSON body
  let rawBody: any;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // 3. Format Detection:
  // Format B: Vapi post-call server webhook (contains message object)
  // Format A: Direct patient submission from Vapi API Request tool (contains requestType)
  const isPostCallWebhook =
    rawBody && typeof rawBody === 'object' && 'message' in rawBody && Boolean(rawBody.message);

  if (isPostCallWebhook) {
    return handlePostCallWebhook(req, rawBody, startTime, rawCorrId);
  }

  return handleDirectSubmission(req, rawBody, startTime, rawCorrId);
}

/**
 * Handles Format A: Direct patient submission from Vapi API Request tool (submit_patient_request)
 */
async function handleDirectSubmission(
  req: NextRequest,
  rawBody: any,
  startTime: number,
  rawCorrId: string | null
) {
  const callId = rawBody?.callId || `anon_${Date.now()}`;
  const correlationId = rawCorrId || `vapi_tool_${callId}`;

  const log = logger.child({
    module: 'WEBHOOK_VAPI:DirectSubmission',
    correlationId,
  });

  log.info('[Direct Submission] Parsing patient request payload', {
    callId,
    requestType: rawBody?.requestType,
  });

  const parsed = DirectPatientSubmissionSchema.safeParse(rawBody);

  if (!parsed.success) {
    log.warn('[Direct Submission] Validation failed', {
      issues: parsed.error.issues,
    });
    return NextResponse.json(
      {
        error: 'Validation error',
        message: 'Invalid request data',
        details: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      },
      {
        headers: { 'X-Correlation-Id': correlationId },
        status: 400,
      }
    );
  }

  try {
    const result = await PatientIntakeService.handleDirectSubmission(parsed.data);

    if (!result.success) {
      if (result.status === 409 || result.conflict) {
        log.warn('[Direct Submission] Conflict or slot unavailable', {
          error: result.error,
          message: result.message,
        });
        return NextResponse.json(
          {
            error: result.error || 'Conflict',
            message: result.message,
          },
          {
            headers: { 'X-Correlation-Id': correlationId },
            status: 409,
          }
        );
      }

      log.warn('[Direct Submission] Request rejected', {
        error: result.error,
        message: result.message,
      });
      return NextResponse.json(
        {
          error: result.error || 'Bad Request',
          message: result.message,
        },
        {
          headers: { 'X-Correlation-Id': correlationId },
          status: typeof result.status === 'number' ? result.status : 400,
        }
      );
    }

    log.info('[Direct Submission] Request processed successfully', {
      requestId: result.requestId,
      requestType: result.requestType,
      status: result.status,
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        success: true,
        requestId: result.requestId,
        requestType: result.requestType,
        status: result.status,
        message: result.message,
        ...(result.isDuplicate ? { isDuplicate: true } : {}),
      },
      {
        headers: { 'X-Correlation-Id': correlationId },
        status: 200,
      }
    );
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error('[Direct Submission Exception]', {
      error: err,
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: errMsg,
      },
      {
        headers: { 'X-Correlation-Id': correlationId },
        status: 500,
      }
    );
  }
}

/**
 * Handles Format B: Existing Vapi post-call server webhook (end-of-call-report)
 */
async function handlePostCallWebhook(
  req: NextRequest,
  rawBody: any,
  startTime: number,
  rawCorrId: string | null
) {
  const callId = rawBody?.message?.call?.id || `anon_${Date.now()}`;
  const correlationId = rawCorrId || `vapi_${callId}`;

  const log = logger.child({
    module: 'WEBHOOK_VAPI:CabinetMichelle',
    correlationId,
  });

  log.info('[Vapi Patient Intake] Post-call webhook received', {
    callId,
    type: rawBody?.message?.type,
  });

  const parsed = VapiServerMessagePayloadSchema.safeParse(rawBody);

  if (!parsed.success) {
    log.warn('[Vapi Patient Intake] Validation failed', {
      issues: parsed.error.issues,
    });
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.issues },
      {
        headers: { 'X-Correlation-Id': correlationId },
        status: 400,
      }
    );
  }

  const payload = parsed.data;
  const eventKey = `vapi_patient_intake_${callId}`;

  // Webhook deduplication
  const { isDuplicate, event } = await WebhookProcessingService.registerEvent({
    provider: WebhookProvider.VAPI,
    eventKey,
    eventType: 'patient_intake',
    correlationId,
    payload,
  });

  if (isDuplicate) {
    log.info(`[Vapi Patient Intake] Duplicate webhook ignored for callId: ${callId}`);
    return NextResponse.json(
      { success: true, message: 'Event already processed' },
      { headers: { 'X-Correlation-Id': correlationId } }
    );
  }

  try {
    const result = await PatientIntakeService.processIntake(payload);
    await WebhookProcessingService.markProcessed(event.id, correlationId);

    log.info('[Vapi Patient Intake] Intake processed successfully', {
      callId,
      outcome: result.outcome,
      appointmentId: result.appointmentId,
      callRecordId: result.callRecordId,
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json(
      { success: true, result },
      { headers: { 'X-Correlation-Id': correlationId } }
    );
  } catch (processError: unknown) {
    const errMsg = processError instanceof Error ? processError.message : String(processError);
    await WebhookProcessingService.markFailed(event.id, errMsg, correlationId);
    log.error('[Vapi Patient Intake Processing Error]', {
      error: processError,
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json(
      { error: 'Internal server error', message: errMsg },
      {
        headers: { 'X-Correlation-Id': correlationId },
        status: 500,
      }
    );
  }
}
