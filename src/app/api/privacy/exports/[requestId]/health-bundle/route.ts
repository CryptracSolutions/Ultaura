export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import { composeHealthExportBundle } from '~/lib/ultaura/health/export';
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

/**
 * GET /api/privacy/exports/[requestId]/health-bundle
 *
 * Internal-only route (webhook-secret authenticated). Returns the full
 * decrypted health export bundle JSON for a processing export request.
 * Called by the export worker during ZIP assembly.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { requestId: string } },
) {
  const authError = validateWebhookSecret(request);
  if (authError) return authError;

  const { requestId } = params;

  try {
    const client = getSupabaseRouteHandlerClient({ admin: true });

    const { data: exportReq, error: exportError } = await client
      .from('ultaura_data_export_requests')
      .select('id, account_id, includes_health_profile, status, invalidated_at, format')
      .eq('id', requestId)
      .single();

    if (exportError || !exportReq) {
      return NextResponse.json({ error: 'Export not found' }, { status: 404 });
    }

    if (!exportReq.includes_health_profile) {
      return NextResponse.json({ error: 'Not a health-bearing export' }, { status: 404 });
    }

    if (exportReq.status !== 'processing') {
      return NextResponse.json({ error: 'Export not in processing state' }, { status: 409 });
    }

    if (exportReq.invalidated_at) {
      return NextResponse.json({ error: 'Export invalidated' }, { status: 409 });
    }

    const requestedFormat: 'json' | 'csv' =
      exportReq.format === 'csv' ? 'csv' : 'json';

    const bundle = await composeHealthExportBundle(
      exportReq.account_id,
      requestId,
      requestedFormat,
    );

    return NextResponse.json(bundle);
  } catch (error) {
    logger.error({ error, requestId }, 'Health bundle composition error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
