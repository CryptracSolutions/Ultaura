import { NextRequest, NextResponse } from 'next/server';

import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import isUserSuperAdmin from '~/app/admin/utils/is-user-super-admin';
import getLogger from '~/core/logger';

export const dynamic = 'force-dynamic';

const logger = getLogger();
const INTERNAL_SECRET_HEADER = 'x-webhook-secret';

function getInternalSecret(): string | null {
  return process.env.ULTAURA_INTERNAL_API_SECRET || process.env.ULTAURA_API_SECRET || null;
}

export async function GET(request: NextRequest) {
  const client = getSupabaseRouteHandlerClient();
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = await isUserSuperAdmin({ client });

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const secret = getInternalSecret();
  if (!secret) {
    logger.error('ULTAURA_INTERNAL_API_SECRET/ULTAURA_API_SECRET is not configured');
    return NextResponse.json(
      {
        ok: false,
        code: 'SERVER_MISCONFIG',
        message: 'Internal API secret is not configured.',
        checkedAt: new Date().toISOString(),
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const endpoint = new URL('/api/internal/crypto-health', request.url);

  try {
    const response = await fetch(endpoint.toString(), {
      method: 'GET',
      headers: {
        [INTERNAL_SECRET_HEADER]: secret,
      },
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, {
      status: response.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    logger.error({ error }, 'Admin crypto-health proxy request failed');
    return NextResponse.json(
      {
        ok: false,
        code: 'PROXY_REQUEST_FAILED',
        message: 'Failed to query internal crypto health endpoint.',
        checkedAt: new Date().toISOString(),
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
