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
  event?: 'select_action' | 'select_result' | 'query_executed' | 'filter_changed';
  query?: string;
  source?: string;
  searchId?: string;
  typeFilter?: string;
  latencyMs?: number;
  resultCount?: number;
  zeroResults?: boolean;
  timeToClickMs?: number;
  categoryCounts?: Record<string, number>;
  actionId?: string;
  itemId?: string;
  href?: string;
  category?: string;
};

const ALLOWED_EVENTS = new Set<SearchTrackPayload['event']>([
  'select_action',
  'select_result',
  'query_executed',
  'filter_changed',
]);

export async function POST(request: Request) {
  let payload: SearchTrackPayload | null = null;

  try {
    payload = (await request.json()) as SearchTrackPayload;
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_payload' }, { status: 202 });
  }

  if (!payload?.event || !ALLOWED_EVENTS.has(payload.event)) {
    return NextResponse.json({ ok: false, reason: 'invalid_event' }, { status: 202 });
  }

  const supabase = getSupabaseRouteHandlerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 202 });
  }

  const organizationUid = await parseOrganizationIdCookie(userData.user.id);
  if (!organizationUid) {
    return NextResponse.json({ ok: false, reason: 'organization_missing' }, { status: 202 });
  }

  const { organization } = await getCurrentOrganization({
    organizationUid,
    userId: userData.user.id,
  });

  if (!organization) {
    return NextResponse.json({ ok: false, reason: 'organization_forbidden' }, { status: 202 });
  }

  const account = await getUltauraAccount(organization.id);
  if (!account) {
    return NextResponse.json({ ok: false, reason: 'account_missing' }, { status: 202 });
  }

  const query = typeof payload.query === 'string'
    ? payload.query.slice(0, MAX_QUERY_LENGTH)
    : '';
  const tokenCount = tokenizeText(query, { minLength: 2, maxTokens: 12 }).length;
  const categoryCounts =
    payload.categoryCounts && typeof payload.categoryCounts === 'object'
      ? Object.entries(payload.categoryCounts).reduce((acc, [key, value]) => {
          if (typeof value === 'number' && Number.isFinite(value)) {
            acc[key] = value;
          }
          return acc;
        }, {} as Record<string, number>)
      : undefined;

  logger.info(
    {
      accountId: account.id,
      userId: userData.user.id,
      event: payload.event,
      searchId: payload.searchId,
      queryLength: query.length,
      queryTokenCount: tokenCount,
      source: payload.source ?? 'unknown',
      typeFilter: payload.typeFilter,
      latencyMs: payload.latencyMs,
      resultCount: payload.resultCount,
      zeroResults: payload.zeroResults,
      timeToClickMs: payload.timeToClickMs,
      categoryCounts,
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
