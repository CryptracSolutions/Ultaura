export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import getLogger from '~/core/logger';
import { parseOrganizationIdCookie } from '~/lib/server/cookies/organization.cookie';
import getCurrentOrganization from '~/lib/server/organizations/get-current-organization';
import { getUltauraAccount } from '~/lib/ultaura/accounts';
import { tokenizeText } from '~/lib/search/match';

const logger = getLogger();
const MAX_QUERY_LENGTH = 100;

type SearchTrackPayload = {
  event?: 'select_action' | 'select_result';
  query?: string;
  source?: string;
  actionId?: string;
  itemId?: string;
  href?: string;
  category?: string;
};

export async function POST(request: Request) {
  let payload: SearchTrackPayload | null = null;

  try {
    payload = (await request.json()) as SearchTrackPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (!payload?.event || !['select_action', 'select_result'].includes(payload.event)) {
    return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
  }

  const supabase = getSupabaseRouteHandlerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const organizationUid = await parseOrganizationIdCookie(userData.user.id);
  if (!organizationUid) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 403 });
  }

  const { organization } = await getCurrentOrganization({
    organizationUid,
    userId: userData.user.id,
  });

  if (!organization) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 403 });
  }

  const account = await getUltauraAccount(organization.id);
  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 403 });
  }

  const query = typeof payload.query === 'string'
    ? payload.query.slice(0, MAX_QUERY_LENGTH)
    : '';
  const tokenCount = tokenizeText(query, { minLength: 2, maxTokens: 12 }).length;

  logger.info(
    {
      accountId: account.id,
      userId: userData.user.id,
      event: payload.event,
      queryLength: query.length,
      queryTokenCount: tokenCount,
      source: payload.source ?? 'unknown',
      actionId: payload.actionId,
      itemId: payload.itemId,
      category: payload.category,
    },
    'Search usage event'
  );

  return NextResponse.json(
    { ok: true },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
