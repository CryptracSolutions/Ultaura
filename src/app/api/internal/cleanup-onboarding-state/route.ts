export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import getLogger from '~/core/logger';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';

const logger = getLogger();
const INTERNAL_SECRET_HEADER = 'x-webhook-secret';
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;

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
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
  }

  const limit = parsed.data.limit ?? DEFAULT_LIMIT;
  const nowIso = new Date().toISOString();
  const adminClient = getSupabaseRouteHandlerClient({ admin: true });
  const tableName = 'ultaura_onboarding_state' as any;

  const { data: rows, error: selectError } = await adminClient
    .from(tableName)
    .select('id')
    .lt('expires_at', nowIso)
    .order('expires_at', { ascending: true })
    .limit(limit);

  if (selectError) {
    logger.error({ error: selectError }, 'Failed to load expired onboarding state rows');
    return NextResponse.json(
      { error: 'Failed to load expired onboarding state rows' },
      { status: 500 },
    );
  }

  const rowIds = (rows ?? []).map((row) => row.id as string).filter(Boolean);

  if (rowIds.length === 0) {
    return NextResponse.json({
      success: true,
      deleted: 0,
      scanned: 0,
      limit,
    });
  }

  const { error: deleteError } = await adminClient
    .from(tableName)
    .delete()
    .in('id', rowIds);

  if (deleteError) {
    logger.error({ error: deleteError }, 'Failed to delete expired onboarding state rows');
    return NextResponse.json(
      { error: 'Failed to delete expired onboarding state rows' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    deleted: rowIds.length,
    scanned: rows?.length ?? 0,
    limit,
  });
}
