export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import { queueHealthSuggestionCandidateInputSchema } from '@ultaura/schemas/telephony';
import getLogger from '~/core/logger';

const logger = getLogger();

function validateWebhookSecret(request: NextRequest): NextResponse | null {
  const expectedSecret = process.env.ULTAURA_INTERNAL_API_SECRET;
  const providedSecret = request.headers.get('x-webhook-secret');

  if (!expectedSecret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (!providedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const providedBuffer = Buffer.from(providedSecret, 'utf8');
  const expectedBuffer = Buffer.from(expectedSecret, 'utf8');

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(Uint8Array.from(providedBuffer), Uint8Array.from(expectedBuffer))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

export async function POST(request: NextRequest) {
  const authError = validateWebhookSecret(request);
  if (authError) return authError;

  const contractVersion = request.headers.get('x-ultaura-health-contract-version');
  if (contractVersion !== 'v1') {
    return NextResponse.json(
      { error: 'Missing or unsupported contract version' },
      { status: 400 },
    );
  }

  try {
    const body = await request.json();
    const parsed = queueHealthSuggestionCandidateInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const {
      lineId,
      callSessionId,
      suggestionType,
      suggestionMode,
      normalizedName,
      confidenceLabel,
      summaryParaphrase,
      proposedFields,
    } = parsed.data;

    const client = getSupabaseRouteHandlerClient({ admin: true });

    // Validate session/line match
    const { data: session } = await client
      .from('ultaura_call_sessions')
      .select('id, line_id, account_id')
      .eq('id', callSessionId)
      .eq('line_id', lineId)
      .maybeSingle();

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found or line mismatch' },
        { status: 404 },
      );
    }

    const { queueSuggestionFromTelephony } = await import(
      '~/lib/ultaura/health/suggestions'
    );

    const result = await queueSuggestionFromTelephony({
      accountId: session.account_id,
      lineId,
      callSessionId,
      suggestionType,
      suggestionMode,
      normalizedName,
      confidenceLabel,
      summaryParaphrase,
      proposedFields,
    });

    return NextResponse.json({
      schemaVersion: 'health-suggestions-v1',
      success: true,
      action: result.action,
    });
  } catch (error) {
    logger.error({ error }, 'Health suggestions endpoint error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
