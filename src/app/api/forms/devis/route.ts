import { NextRequest, NextResponse } from 'next/server';
import { DevisSubmissionSchema } from '@/lib/validation/schemas';
import { DevisIntakeService } from '@/lib/services/devis-intake.service';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const rawCorrId = req.headers.get('x-correlation-id');
  const correlationId = rawCorrId || `form_devis_${Date.now().toString(36)}`;
  const log = logger.child({ module: 'DEVIS:Submission', correlationId });

  try {
    const rawBody = await req.json();
    log.info('[Devis Form] Submission received', { callId: rawBody?.callId });

    const parseResult = DevisSubmissionSchema.safeParse(rawBody);

    if (!parseResult.success) {
      log.warn('[Devis Form] Validation failed', {
        issues: parseResult.error.flatten().fieldErrors,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          issues: parseResult.error.flatten().fieldErrors,
        },
        { headers: { 'X-Correlation-Id': correlationId }, status: 400 }
      );
    }

    const result = await DevisIntakeService.processSubmission(parseResult.data);

    if (!result.handled) {
      log.warn('[Devis Form] Submission not handled', { reason: result.reason });
      return NextResponse.json(
        {
          success: false,
          error: result.reason || 'Failed to process devis submission',
        },
        { headers: { 'X-Correlation-Id': correlationId }, status: 404 }
      );
    }

    log.info('[Devis Form] Submission successfully processed and notification sent', {
      callId: parseResult.data.callId,
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        success: true,
        result,
      },
      { headers: { 'X-Correlation-Id': correlationId } }
    );
  } catch (error: unknown) {
    log.error('[POST /api/forms/devis Error]', { error, durationMs: Date.now() - startTime });
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { headers: { 'X-Correlation-Id': correlationId }, status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = new URL(req.url);
  const callId = searchParams.get('callId');
  const correlationId = `form_get_${callId || Date.now().toString(36)}`;
  const log = logger.child({ module: 'DEVIS:PreFill', correlationId });

  try {
    if (!callId) {
      return NextResponse.json(
        { success: false, error: 'callId query parameter required' },
        { headers: { 'X-Correlation-Id': correlationId }, status: 400 }
      );
    }

    const context = await DevisIntakeService.getSubmissionContext(callId);

    if (!context) {
      log.warn(`[Devis Form] Context not found for callId: ${callId}`);
      return NextResponse.json(
        { success: false, error: 'Devis request not found for this callId' },
        { headers: { 'X-Correlation-Id': correlationId }, status: 404 }
      );
    }

    log.info(`[Devis Form] Successfully loaded pre-fill data for callId: ${callId}`, {
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        success: true,
        data: context,
      },
      { headers: { 'X-Correlation-Id': correlationId } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('[GET /api/forms/devis Error]', { error, durationMs: Date.now() - startTime });
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', details: message },
      { headers: { 'X-Correlation-Id': correlationId }, status: 500 }
    );
  }
}
