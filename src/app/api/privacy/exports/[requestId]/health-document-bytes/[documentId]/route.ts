export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import { decryptFileBuffer } from '~/lib/ultaura/health/document-crypto';
import getLogger from '~/core/logger';

const logger = getLogger();

function validateWebhookSecret(request: NextRequest): NextResponse | null {
  const expectedSecret = process.env.ULTAURA_INTERNAL_API_SECRET;
  const providedSecret = request.headers.get('x-webhook-secret');

  if (!expectedSecret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (!providedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const providedBuffer = Buffer.from(providedSecret, 'utf8');
  const expectedBuffer = Buffer.from(expectedSecret, 'utf8');

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(Uint8Array.from(providedBuffer), Uint8Array.from(expectedBuffer))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

/**
 * POST /api/privacy/exports/[requestId]/health-document-bytes/[documentId]
 *
 * Internal-only route (webhook-secret authenticated). Fetches and decrypts a
 * health document file for inclusion in an export ZIP.
 * Called by the export worker for each document in the bundle's documentFiles list.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string; documentId: string } },
) {
  const authError = validateWebhookSecret(request);
  if (authError) return authError;

  const { requestId, documentId } = params;

  try {
    const client = getSupabaseRouteHandlerClient({ admin: true });

    // Validate export request is in a valid processing state
    const { data: exportReq, error: exportError } = await client
      .from('ultaura_data_export_requests')
      .select('id, account_id, includes_health_profile, status, invalidated_at')
      .eq('id', requestId)
      .single();

    if (
      exportError ||
      !exportReq ||
      !exportReq.includes_health_profile ||
      exportReq.status !== 'processing' ||
      exportReq.invalidated_at
    ) {
      return NextResponse.json({ error: 'Invalid export request' }, { status: 404 });
    }

    // Load document — must belong to the export's account and be active
    const { data: doc, error: docError } = await client
      .from('ultaura_health_documents')
      .select('id, account_id, line_id, storage_object_key, mime_type, file_iv, file_tag, status')
      .eq('id', documentId)
      .eq('account_id', exportReq.account_id)
      .eq('status', 'active')
      .single();

    if (docError || !doc || !doc.storage_object_key) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Fetch encrypted blob from storage
    const { data: blob, error: storageError } = await client.storage
      .from('ultaura-health-documents')
      .download(doc.storage_object_key);

    if (storageError || !blob) {
      logger.error(
        { error: storageError, documentId, requestId },
        'Failed to download document blob for export',
      );
      return NextResponse.json({ error: 'Storage error' }, { status: 500 });
    }

    const encryptedBuffer = Buffer.from(await blob.arrayBuffer());
    const decrypted = await decryptFileBuffer(
      doc.account_id,
      doc.line_id,
      encryptedBuffer,
      doc.file_iv as unknown as string,
      doc.file_tag as unknown as string,
    );

    return new NextResponse(decrypted, {
      headers: {
        'Content-Type': doc.mime_type ?? 'application/octet-stream',
        'Cache-Control': 'no-store, private, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    logger.error({ error, documentId, requestId }, 'Health document bytes export error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
