import { NextResponse } from 'next/server';

import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import isUserSuperAdmin from '~/app/admin/utils/is-user-super-admin';
import getLogger from '~/core/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };

  try {
    const client = getSupabaseRouteHandlerClient();
    const { data, error: authError } = await client.auth.getUser();

    if (authError || !data.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
    }

    const isAdmin = await isUserSuperAdmin({ client });

    if (!isAdmin) {
      return NextResponse.json({ error: 'Not found' }, { status: 404, headers });
    }

    // Query active sessions
    const { count: activeSessions } = await client
      .from('ultaura_call_sessions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['in_progress', 'ringing'])
      .is('ended_at', null);

    // Query today's handoffs
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: handoffs } = await client
      .from('ultaura_session_handoffs')
      .select('status, duration_ms')
      .gte('created_at', todayStart.toISOString());

    const handoffsToday = handoffs?.length ?? 0;
    const successfulHandoffs = handoffs?.filter((h) => h.status === 'success') ?? [];
    const successfulHandoffsToday = successfulHandoffs.length;

    const avgHandoffDurationMs =
      successfulHandoffs.length > 0
        ? Math.round(
            successfulHandoffs.reduce((sum, h) => sum + (h.duration_ms ?? 0), 0) /
              successfulHandoffs.length,
          )
        : null;

    return NextResponse.json(
      {
        activeSessions: activeSessions ?? null,
        handoffsToday,
        successfulHandoffsToday,
        avgHandoffDurationMs,
        checkedAt: new Date().toISOString(),
      },
      { headers },
    );
  } catch (error) {
    const logger = await getLogger();
    logger.error({ error }, 'Failed to fetch live sessions');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers },
    );
  }
}
