export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';

/**
 * GET /api/privacy/exports/[requestId]/download
 *
 * Authenticated download endpoint for Health-bearing exports.
 * For health_owner_only exports: verifies canonical account owner, reads
 * artifact from Supabase Storage, and streams it back.
 * For standard_account exports: redirects to the existing download_url.
 *
 * Error responses are generic — no information is revealed about whether
 * Health data exists or why access was denied.
 */
export async function GET(
  _request: Request,
  { params }: { params: { requestId: string } }
) {
  const { requestId } = params;

  if (!requestId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Authenticate the requesting user.
  const userClient = getSupabaseRouteHandlerClient();
  const { data: authData, error: authError } = await userClient.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = authData.user.id;

  // Use admin client to read the export request (bypasses RLS so we can
  // enforce owner verification in application code as a defense-in-depth layer).
  const adminClient = getSupabaseRouteHandlerClient({ admin: true });

  const { data: exportRequest, error: exportError } = await adminClient
    .from('ultaura_data_export_requests')
    .select(
      'id, account_id, status, visibility_scope, download_url, artifact_storage_path, artifact_extension, artifact_content_type, invalidated_at'
    )
    .eq('id', requestId)
    .maybeSingle();

  if (exportError || !exportRequest) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Verify the requesting user is the canonical account owner.
  const { data: account, error: accountError } = await adminClient
    .from('ultaura_accounts')
    .select('created_by_user_id')
    .eq('id', exportRequest.account_id)
    .maybeSingle();

  if (accountError || !account) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (account.created_by_user_id !== userId) {
    // Generic denial — do not reveal whether Health data exists.
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Block access if the export has been invalidated.
  if (exportRequest.invalidated_at) {
    return NextResponse.json({ error: 'Export unavailable' }, { status: 410 });
  }

  if (exportRequest.status !== 'ready') {
    return NextResponse.json({ error: 'Export not ready' }, { status: 409 });
  }

  const visibilityScope = exportRequest.visibility_scope ?? 'standard_account';

  if (visibilityScope === 'health_owner_only') {
    // Health-bearing export: stream artifact from Storage.
    const storagePath = exportRequest.artifact_storage_path;
    if (!storagePath) {
      return NextResponse.json({ error: 'Export unavailable' }, { status: 410 });
    }

    const { data: fileData, error: storageError } = await adminClient.storage
      .from('ultaura-exports')
      .download(storagePath);

    if (storageError || !fileData) {
      return NextResponse.json({ error: 'Export unavailable' }, { status: 410 });
    }

    const contentType =
      exportRequest.artifact_content_type ?? 'application/zip';
    const extension = exportRequest.artifact_extension ?? 'zip';

    const arrayBuffer = await fileData.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="export.${extension}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    });
  }

  // Standard export: redirect to the existing signed download URL.
  const downloadUrl = exportRequest.download_url;
  if (!downloadUrl) {
    return NextResponse.json({ error: 'Export unavailable' }, { status: 410 });
  }

  // Validate the URL is an https URL before redirecting.
  try {
    const parsed = new URL(downloadUrl);
    if (parsed.protocol !== 'https:') {
      return NextResponse.json({ error: 'Export unavailable' }, { status: 410 });
    }
  } catch {
    return NextResponse.json({ error: 'Export unavailable' }, { status: 410 });
  }

  return NextResponse.redirect(downloadUrl, { status: 302 });
}
