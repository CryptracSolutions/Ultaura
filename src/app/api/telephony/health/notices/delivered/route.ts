export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import getLogger from '~/core/logger';

const logger = getLogger();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    return NextResponse.json({ error: 'Missing or unsupported contract version' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { lineId, noticeId, callSessionId } = body as {
      lineId?: string;
      noticeId?: string;
      callSessionId?: string;
    };

    if (!lineId || !noticeId || !callSessionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!UUID_REGEX.test(lineId) || !UUID_REGEX.test(noticeId) || !UUID_REGEX.test(callSessionId)) {
      return NextResponse.json({ error: 'Invalid UUID format' }, { status: 400 });
    }

    const client = getSupabaseRouteHandlerClient({ admin: true });

    // Validate session/line match
    const { data: session } = await client
      .from('ultaura_call_sessions')
      .select('id, line_id')
      .eq('id', callSessionId)
      .eq('line_id', lineId)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: 'Session not found or line mismatch' }, { status: 404 });
    }

    // Mark notice as delivered
    const { error } = await client
      .from('ultaura_health_call_notices')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        delivered_call_session_id: callSessionId,
      })
      .eq('id', noticeId)
      .eq('line_id', lineId);

    if (error) {
      logger.error({ error, noticeId, lineId }, 'Failed to mark notice delivered');
      return NextResponse.json({ error: 'Failed to mark notice delivered' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Notice delivered endpoint error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
