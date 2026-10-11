import { NextRequest, NextResponse } from 'next/server';
import { DevisSubmissionSchema } from '@/lib/validation/schemas';
import { DevisIntakeService } from '@/lib/services/devis-intake.service';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseResult = DevisSubmissionSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          issues: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await DevisIntakeService.processSubmission(parseResult.data);

    if (!result.handled) {
      return NextResponse.json(
        {
          success: false,
          error: result.reason || 'Failed to process devis submission',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[POST /api/forms/devis Error]:', message);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const callId = searchParams.get('callId');

    if (!callId) {
      return NextResponse.json(
        { success: false, error: 'callId query parameter required' },
        { status: 400 }
      );
    }

    const context = await DevisIntakeService.getSubmissionContext(callId);

    if (!context) {
      return NextResponse.json(
        { success: false, error: 'Devis request not found for this callId' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: context,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[GET /api/forms/devis Error]:', message);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
