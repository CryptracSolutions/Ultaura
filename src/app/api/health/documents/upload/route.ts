export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import { encryptHealthPayload } from '~/lib/ultaura/health/crypto';
import { encryptFileBuffer } from '~/lib/ultaura/health/document-crypto';
import { writeHealthHistoryEntry } from '~/lib/ultaura/health/history';
import { isHealthOwner } from '~/lib/ultaura/health/access';
import type { StoredDocumentPayload, HealthDocumentCategory, HealthDocumentHistorySnapshot } from '@ultaura/types';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

// Map mime type → valid file extensions
const MIME_ALLOWLIST: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/heic': ['.heic'],
};

// Magic byte signatures for file type verification
function verifyMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false;
  switch (mimeType) {
    case 'application/pdf':
      // %PDF (hex: 25 50 44 46)
      return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
    case 'image/jpeg':
      // FF D8 FF
      return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    case 'image/png':
      // 89 50 4E 47 0D 0A 1A 0A
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47
        && buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A;
    case 'image/heic':
      // 'ftyp' at byte offset 4 (hex: 66 74 79 70)
      return buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70;
    default:
      return false;
  }
}

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx === -1) return '';
  return filename.slice(idx).toLowerCase();
}

export async function POST(request: NextRequest) {
  // 1. Authenticate user
  const supabase = getSupabaseRouteHandlerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const actorUserId = authData.user.id;

  // 2. Parse formData
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const lineId = formData.get('lineId') as string | null;
  const title = formData.get('title') as string | null;
  const category = (formData.get('category') as string | null) || null;
  const documentDate = (formData.get('documentDate') as string | null) || null;
  const notes = (formData.get('notes') as string | null) || null;

  // 3. Validate inputs
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (!lineId) {
    return NextResponse.json({ error: 'lineId is required' }, { status: 400 });
  }
  if (!title || title.trim().length === 0) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  if (title.length > 120) {
    return NextResponse.json({ error: 'title must be 120 characters or fewer' }, { status: 400 });
  }
  if (notes && notes.length > 2000) {
    return NextResponse.json({ error: 'notes must be 2000 characters or fewer' }, { status: 400 });
  }

  const mimeType = file.type;
  if (!MIME_ALLOWLIST[mimeType]) {
    return NextResponse.json(
      { error: 'File type not supported. Allowed: PDF, JPEG, PNG, HEIC', code: 'document_file_type_not_supported' },
      { status: 422 },
    );
  }

  const originalFilename = file.name;
  const extension = getExtension(originalFilename);
  const allowedExtensions = MIME_ALLOWLIST[mimeType];
  if (!allowedExtensions.includes(extension)) {
    return NextResponse.json(
      { error: `File extension "${extension}" does not match content type "${mimeType}"`, code: 'document_file_type_not_supported' },
      { status: 422 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File size exceeds 25 MB limit', code: 'document_file_too_large' },
      { status: 422 },
    );
  }

  // 4. Verify ownership and get accountId — use admin client for lookup, user client for auth check
  const adminClient = getSupabaseRouteHandlerClient({ admin: true });

  const { data: line, error: lineError } = await adminClient
    .from('ultaura_lines')
    .select('id, account_id')
    .eq('id', lineId)
    .single();

  if (lineError || !line) {
    return NextResponse.json({ error: 'Line not found' }, { status: 404 });
  }

  const accountId = line.account_id;

  const owned = await isHealthOwner(accountId, actorUserId);
  if (!owned) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // 5. Rate limit: no more than 10 uploads per line in the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await adminClient
    .from('ultaura_health_documents')
    .select('id', { count: 'exact', head: true })
    .eq('line_id', lineId)
    .gte('created_at', oneHourAgo);

  if (typeof recentCount === 'number' && recentCount >= 10) {
    return NextResponse.json(
      { error: 'Upload rate limit reached. Maximum 10 documents per hour per line.' },
      { status: 429 },
    );
  }

  // 6. Encrypt metadata payload
  const storedPayload: StoredDocumentPayload = {
    title: title.trim(),
    category: (category as HealthDocumentCategory | null) ?? null,
    documentDate: documentDate ?? null,
    notes: notes ?? null,
    originalFilename,
  };

  const encryptedPayload = await encryptHealthPayload(
    accountId,
    lineId,
    JSON.stringify(storedPayload),
  );

  // 7. Create document row with status='uploading'
  const { data: docRow, error: insertError } = await adminClient
    .from('ultaura_health_documents')
    .insert({
      account_id: accountId,
      line_id: lineId,
      status: 'uploading',
      uploaded_by_user_id: actorUserId,
      updated_by_user_id: actorUserId,
      payload_ciphertext: encryptedPayload.ciphertext,
      payload_iv: encryptedPayload.iv,
      payload_tag: encryptedPayload.tag,
      payload_alg: encryptedPayload.alg,
      payload_kid: encryptedPayload.kid,
    })
    .select('id')
    .single();

  if (insertError || !docRow) {
    return NextResponse.json(
      { error: `Failed to create document record: ${insertError?.message}` },
      { status: 500 },
    );
  }

  const documentId = docRow.id;

  try {
    // 8. Read file and verify magic bytes match declared MIME type
    const fileBytes = await file.arrayBuffer();
    const plainBuffer = Buffer.from(fileBytes);

    if (!verifyMagicBytes(plainBuffer, mimeType)) {
      // Mark the uploading row as failed before returning
      await adminClient
        .from('ultaura_health_documents')
        .update({ status: 'failed', upload_failed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', documentId);
      return NextResponse.json(
        { error: 'File content does not match declared type', code: 'document_file_type_not_supported' },
        { status: 422 },
      );
    }

    // 9. Encrypt file buffer
    const { encryptedBuffer, iv: fileIv, tag: fileTag, alg: fileAlg, kid: fileKid } =
      await encryptFileBuffer(accountId, lineId, plainBuffer);

    // 9. Upload encrypted buffer to storage
    const storageKey = `${crypto.randomUUID()}.bin`;
    const { error: storageError } = await adminClient.storage
      .from('ultaura-health-documents')
      .upload(storageKey, encryptedBuffer, {
        contentType: 'application/octet-stream',
        upsert: false,
      });

    if (storageError) {
      throw new Error(`Storage upload failed: ${storageError.message}`);
    }

    // 10. Update row to status='active'
    const { data: finalRow, error: updateError } = await adminClient
      .from('ultaura_health_documents')
      .update({
        status: 'active',
        storage_object_key: storageKey,
        mime_type: mimeType,
        file_extension: extension,
        file_size_bytes: file.size,
        file_iv: fileIv,
        file_tag: fileTag,
        file_alg: fileAlg,
        file_kid: fileKid,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)
      .select('id, line_id, account_id, mime_type, file_extension, file_size_bytes, status, created_at, updated_at')
      .single();

    if (updateError || !finalRow) {
      throw new Error(`Failed to finalize document: ${updateError?.message}`);
    }

    // 11. Write history
    const historySnapshot: HealthDocumentHistorySnapshot = {
      title: storedPayload.title,
      category: storedPayload.category ?? null,
      documentDate: storedPayload.documentDate ?? null,
      notes: storedPayload.notes ?? null,
      originalFilename: storedPayload.originalFilename ?? null,
    };

    await writeHealthHistoryEntry({
      accountId,
      lineId,
      itemKind: 'document',
      itemId: documentId,
      action: 'created',
      actorType: 'owner',
      actorUserId,
      payload: { itemKind: 'document', action: 'created', snapshot: historySnapshot },
    });

    // 12. Return document entity
    return NextResponse.json({
      id: finalRow.id,
      lineId: finalRow.line_id,
      title: storedPayload.title,
      category: storedPayload.category,
      documentDate: storedPayload.documentDate,
      notes: storedPayload.notes,
      mimeType: finalRow.mime_type,
      fileExtension: finalRow.file_extension,
      fileSizeBytes: finalRow.file_size_bytes,
      status: finalRow.status,
      createdAt: finalRow.created_at,
      updatedAt: finalRow.updated_at,
    });
  } catch (err) {
    // On failure after row was created: mark row as failed
    await adminClient
      .from('ultaura_health_documents')
      .update({
        status: 'failed',
        upload_failed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
