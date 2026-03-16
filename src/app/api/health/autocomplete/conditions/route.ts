export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import { searchConditions } from '~/lib/ultaura/health/autocomplete';

/**
 * GET /api/health/autocomplete/conditions?q=diabetes
 *
 * Returns ICD-10-CM condition suggestions from the NLM Clinical Tables API.
 * Requires an authenticated user session.
 */
export async function GET(request: Request) {
  const supabase = getSupabaseRouteHandlerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';

  if (!q.trim()) {
    return NextResponse.json([]);
  }

  const results = await searchConditions(q);
  return NextResponse.json(results);
}
