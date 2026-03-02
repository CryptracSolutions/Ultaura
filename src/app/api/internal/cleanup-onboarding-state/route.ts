export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import getLogger from '~/core/logger';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import type { Database } from '~/database.types';

const logger = getLogger();
const INTERNAL_SECRET_HEADER = 'x-webhook-secret';
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;
type OnboardingStateIdRow = Pick<
  Database['public']['Tables']['ultaura_onboarding_state']['Row'],
  'id'
>;

const requestSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
});

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

async function handleRequest(request: NextRequest) {
  const expectedSecret = process.env.ULTAURA_INTERNAL_API_SECRET;
  const providedSecret = request.headers.get(INTERNAL_SECRET_HEADER);

  if (!expectedSecret) {
    logger.error('ULTAURA_INTERNAL_API_SECRET is not configured');
    return NextResponse.json(
      { error: 'Server misconfigured' },
      { status: 500 },
    );
  }

  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request parameters' },
      { status: 400 },
    );
  }

  const limit = parsed.data.limit ?? DEFAULT_LIMIT;
  const nowIso = new Date().toISOString();
  const adminClient = getSupabaseRouteHandlerClient({ admin: true });
  const { data: rows, error: selectError } = await adminClient
    .from('ultaura_onboarding_state')
    .select('id')
    .lt('expires_at', nowIso)
    .order('expires_at', { ascending: true })
    .limit(limit);

  if (selectError) {
    logger.error(
      { error: selectError },
      'Failed to load expired onboarding state rows',
    );
    return NextResponse.json(
      { error: 'Failed to load expired onboarding state rows' },
      { status: 500 },
    );
  }

  const typedRows: OnboardingStateIdRow[] = rows ?? [];
  const rowIds = typedRows.map((row) => row.id).filter(Boolean);

  if (rowIds.length === 0) {
    return NextResponse.json({
      success: true,
      deleted: 0,
      scanned: 0,
      limit,
    });
  }

  const { error: deleteError } = await adminClient
    .from('ultaura_onboarding_state')
    .delete()
    .in('id', rowIds);

  if (deleteError) {
    logger.error(
      { error: deleteError },
      'Failed to delete expired onboarding state rows',
    );
    return NextResponse.json(
      { error: 'Failed to delete expired onboarding state rows' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    deleted: rowIds.length,
    scanned: typedRows.length,
    limit,
  });
}
