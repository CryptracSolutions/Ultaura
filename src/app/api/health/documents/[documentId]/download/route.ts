export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import { validateAndConsumeToken } from '~/lib/ultaura/health/document-tokens';
import { decryptFileBuffer } from '~/lib/ultaura/health/document-crypto';
import { isHealthEligiblePlan } from '~/lib/ultaura/health/entitlements';
import getLogger from '~/core/logger';

const logger = getLogger();

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store, private, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
  'X-Content-Type-Options': 'nosniff',
};

export async function POST(
  request: NextRequest,
  { params }: { params: { documentId: string } },
) {
  try {
    let body: { token?: string };
    try {
      body = (await request.json()) as { token?: string };
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { token } = body;
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

    const { documentId } = params;

    // Validate and atomically consume the one-time token
    const validation = await validateAndConsumeToken(token, documentId, 'download');
    if (!validation.valid) {
      return NextResponse.json({ error: validation.reason }, { status: 401 });
    }

    const { accountId, lineId } = validation;
    const client = getSupabaseRouteHandlerClient({ admin: true });

    // Re-check plan eligibility at consumption time (spec Section 8.8)
    const { data: account } = await client
      .from('ultaura_accounts')
      .select('plan_id, status')
      .eq('id', accountId)
      .single();

    if (!account || !account.plan_id || !isHealthEligiblePlan(account.plan_id, account.status)) {
      return NextResponse.json({ success: false, code: 'health_locked' }, { status: 403 });
    }

    // Load document record
    const { data: doc } = await client
      .from('ultaura_health_documents')
      .select('storage_object_key, mime_type, file_iv, file_tag, status')
      .eq('id', documentId)
      .eq('status', 'active')
      .single();

    if (!doc || !doc.storage_object_key) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Fetch encrypted blob from storage
    const { data: blob, error: storageError } = await client.storage
      .from('ultaura-health-documents')
      .download(doc.storage_object_key);

    if (storageError || !blob) {
      logger.error({ error: storageError, documentId }, 'Failed to download document blob');
      return NextResponse.json({ error: 'Failed to retrieve document' }, { status: 500 });
    }

    // Decrypt the file buffer
    const encryptedBuffer = Buffer.from(await blob.arrayBuffer());
    const decrypted = await decryptFileBuffer(
      accountId,
      lineId,
      encryptedBuffer,
      doc.file_iv as unknown as string,
      doc.file_tag as unknown as string,
    );

    // Log access (non-blocking — failure here must not block the response)
    void Promise.resolve(
      client.from('ultaura_health_document_access_log').insert({
        account_id: accountId,
        line_id: lineId,
        document_id: documentId,
        actor_user_id: validation.actorUserId || null,
        action: 'download',
        was_successful: true,
      }),
    ).catch((err: unknown) => logger.warn({ err }, 'Access log write failed'));

    return new NextResponse(decrypted, {
      headers: {
        'Content-Type': doc.mime_type ?? 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="document"',
        ...SECURITY_HEADERS,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Document download error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
