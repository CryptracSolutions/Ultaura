export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import { createAccessToken } from '~/lib/ultaura/health/document-tokens';
import { isHealthEligiblePlan } from '~/lib/ultaura/health/entitlements';
import getLogger from '~/core/logger';

const logger = getLogger();

export async function POST(
  request: NextRequest,
  { params }: { params: { documentId: string } },
) {
  try {
    // 1. Authenticate user
    const authClient = getSupabaseRouteHandlerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 2. Parse body
    let body: { action?: string };
    try {
      body = (await request.json()) as { action?: string };
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { action } = body;
    if (!action || !['preview', 'download'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { documentId } = params;
    const adminClient = getSupabaseRouteHandlerClient({ admin: true });

    // 3. Load document and verify it exists and is active
    const { data: doc } = await adminClient
      .from('ultaura_health_documents')
      .select('id, account_id, line_id, status')
      .eq('id', documentId)
      .eq('status', 'active')
      .maybeSingle();

    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // 4. Verify the requesting user owns the account
    const { data: account } = await adminClient
      .from('ultaura_accounts')
      .select('id, created_by_user_id, plan_id, status')
      .eq('id', doc.account_id)
      .single();

    if (!account || account.created_by_user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 5. Check plan eligibility
    if (!isHealthEligiblePlan(account.plan_id ?? '', account.status)) {
      return NextResponse.json({ error: 'Plan not eligible' }, { status: 403 });
    }

    // 6. Generate and return token
    const result = await createAccessToken(
      documentId,
      doc.line_id,
      doc.account_id,
      user.id,
      action as 'preview' | 'download',
    );

    if ('error' in result) {
      const status = result.error === 'Token rate limit exceeded' ? 429 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error({ error }, 'Access token generation error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
