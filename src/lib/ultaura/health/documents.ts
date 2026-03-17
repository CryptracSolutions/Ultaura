import 'server-only';

import getSupabaseServerActionClient from '~/core/supabase/action-client';
import { encryptHealthPayload, decryptHealthPayload, preloadLineDEK } from './crypto';
import { writeHealthHistoryEntry } from './history';
import { mapHealthDocumentRow } from './types';
import type {
  HealthDocument,
  StoredDocumentPayload,
  HealthDocumentHistorySnapshot,
  HealthDocumentHistoryChange,
  HealthDocumentCategory,
} from '@ultaura/types';

export interface DocumentMetadataInput {
  title: string;
  category?: HealthDocumentCategory | null;
  documentDate?: string | null;
  notes?: string | null;
}

export async function getDocuments(
  lineId: string,
  knownAccountId?: string,
): Promise<HealthDocument[]> {
  const adminClient = getSupabaseServerActionClient({ admin: true });

  let accountId = knownAccountId;
  if (!accountId) {
    const { data: line, error: lineError } = await adminClient
      .from('ultaura_lines')
      .select('id, account_id')
      .eq('id', lineId)
      .single();

    if (lineError || !line) {
      throw new Error('Line not found');
    }
    accountId = line.account_id;
  }

  const { data: rows, error } = await adminClient
    .from('ultaura_health_documents')
    .select(
      'id, line_id, account_id, mime_type, file_extension, file_size_bytes, status, created_at, updated_at, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid',
    )
    .eq('line_id', lineId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  if (!rows || rows.length === 0) return [];

  const dek = await preloadLineDEK(accountId, lineId);
  const documents: HealthDocument[] = [];

  for (const row of rows) {
    try {
      const plaintext = await decryptHealthPayload(accountId, lineId, {
        ciphertext: row.payload_ciphertext,
        iv: row.payload_iv,
        tag: row.payload_tag,
        alg: row.payload_alg,
        kid: row.payload_kid,
      }, dek);

      const payload = JSON.parse(plaintext) as StoredDocumentPayload;

      documents.push(
        mapHealthDocumentRow(
          {
            id: row.id,
            line_id: row.line_id,
            account_id: row.account_id,
            mime_type: row.mime_type ?? '',
            file_extension: row.file_extension ?? '',
            file_size_bytes: row.file_size_bytes ?? 0,
            status: row.status,
            created_at: row.created_at,
            updated_at: row.updated_at,
          },
          payload,
        ),
      );
    } catch {
      // Skip documents that fail to decrypt
    }
  }

  return documents;
}

export async function getDocument(
  documentId: string,
  lineId: string,
): Promise<HealthDocument | null> {
  const adminClient = getSupabaseServerActionClient({ admin: true });

  const { data: line, error: lineError } = await adminClient
    .from('ultaura_lines')
    .select('id, account_id')
    .eq('id', lineId)
    .single();

  if (lineError || !line) {
    throw new Error('Line not found');
  }

  const accountId = line.account_id;

  const { data: row, error } = await adminClient
    .from('ultaura_health_documents')
    .select(
      'id, line_id, account_id, mime_type, file_extension, file_size_bytes, status, created_at, updated_at, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid',
    )
    .eq('id', documentId)
    .eq('line_id', lineId)
    .single();

  if (error || !row) {
    return null;
  }

  try {
    const plaintext = await decryptHealthPayload(accountId, lineId, {
      ciphertext: row.payload_ciphertext,
      iv: row.payload_iv,
      tag: row.payload_tag,
      alg: row.payload_alg,
      kid: row.payload_kid,
    });

    const payload = JSON.parse(plaintext) as StoredDocumentPayload;

    return mapHealthDocumentRow(
      {
        id: row.id,
        line_id: row.line_id,
        account_id: row.account_id,
        mime_type: row.mime_type ?? '',
        file_extension: row.file_extension ?? '',
        file_size_bytes: row.file_size_bytes ?? 0,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      payload,
    );
  } catch {
    return null;
  }
}

export async function editDocumentMetadata(
  documentId: string,
  lineId: string,
  accountId: string,
  actorUserId: string,
  input: DocumentMetadataInput,
): Promise<HealthDocument> {
  const adminClient = getSupabaseServerActionClient({ admin: true });

  const { data: existingRow, error: fetchError } = await adminClient
    .from('ultaura_health_documents')
    .select(
      'id, line_id, account_id, mime_type, file_extension, file_size_bytes, status, created_at, updated_at, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid',
    )
    .eq('id', documentId)
    .eq('line_id', lineId)
    .eq('status', 'active')
    .single();

  if (fetchError || !existingRow) {
    throw new Error('Document not found');
  }

  const existingPlaintext = await decryptHealthPayload(accountId, lineId, {
    ciphertext: existingRow.payload_ciphertext,
    iv: existingRow.payload_iv,
    tag: existingRow.payload_tag,
    alg: existingRow.payload_alg,
    kid: existingRow.payload_kid,
  });

  const existingPayload = JSON.parse(existingPlaintext) as StoredDocumentPayload;

  const newPayload: StoredDocumentPayload = {
    title: input.title,
    category: input.category ?? null,
    documentDate: input.documentDate ?? null,
    notes: input.notes ?? null,
    originalFilename: existingPayload.originalFilename,
  };

  const changes: HealthDocumentHistoryChange[] = [];

  if (existingPayload.title !== newPayload.title) {
    changes.push({ field: 'title', before: existingPayload.title, after: newPayload.title });
  }
  if ((existingPayload.category ?? null) !== (newPayload.category ?? null)) {
    changes.push({ field: 'category', before: existingPayload.category ?? null, after: newPayload.category ?? null });
  }
  if ((existingPayload.documentDate ?? null) !== (newPayload.documentDate ?? null)) {
    changes.push({ field: 'documentDate', before: existingPayload.documentDate ?? null, after: newPayload.documentDate ?? null });
  }
  if ((existingPayload.notes ?? null) !== (newPayload.notes ?? null)) {
    changes.push({ field: 'notes', before: existingPayload.notes ?? null, after: newPayload.notes ?? null });
  }

  const encrypted = await encryptHealthPayload(accountId, lineId, JSON.stringify(newPayload));

  const { data: updatedRow, error: updateError } = await adminClient
    .from('ultaura_health_documents')
    .update({
      updated_by_user_id: actorUserId,
      updated_at: new Date().toISOString(),
      payload_ciphertext: encrypted.ciphertext,
      payload_iv: encrypted.iv,
      payload_tag: encrypted.tag,
      payload_alg: encrypted.alg,
      payload_kid: encrypted.kid,
    })
    .eq('id', documentId)
    .eq('line_id', lineId)
    .select('id, line_id, account_id, mime_type, file_extension, file_size_bytes, status, created_at, updated_at')
    .single();

  if (updateError || !updatedRow) {
    throw new Error(`Failed to update document: ${updateError?.message}`);
  }

  if (changes.length > 0) {
    await writeHealthHistoryEntry({
      accountId,
      lineId,
      itemKind: 'document',
      itemId: documentId,
      action: 'edited',
      actorType: 'owner',
      actorUserId,
      payload: {
        itemKind: 'document',
        action: 'edited',
        summaryLabel: `Updated ${newPayload.title}`,
        changes,
      },
    });
  }

  return mapHealthDocumentRow(
    {
      id: updatedRow.id,
      line_id: updatedRow.line_id,
      account_id: updatedRow.account_id,
      mime_type: updatedRow.mime_type ?? '',
      file_extension: updatedRow.file_extension ?? '',
      file_size_bytes: updatedRow.file_size_bytes ?? 0,
      status: updatedRow.status,
      created_at: updatedRow.created_at,
      updated_at: updatedRow.updated_at,
    },
    newPayload,
  );
}

export async function deleteDocument(
  documentId: string,
  lineId: string,
  accountId: string,
  actorUserId: string,
): Promise<void> {
  const adminClient = getSupabaseServerActionClient({ admin: true });

  const { data: existingRow, error: fetchError } = await adminClient
    .from('ultaura_health_documents')
    .select(
      'id, status, storage_object_key, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid',
    )
    .eq('id', documentId)
    .eq('line_id', lineId)
    .single();

  if (fetchError || !existingRow) {
    throw new Error('Document not found');
  }

  const plaintext = await decryptHealthPayload(accountId, lineId, {
    ciphertext: existingRow.payload_ciphertext,
    iv: existingRow.payload_iv,
    tag: existingRow.payload_tag,
    alg: existingRow.payload_alg,
    kid: existingRow.payload_kid,
  });

  const payload = JSON.parse(plaintext) as StoredDocumentPayload;

  const snapshot: HealthDocumentHistorySnapshot = {
    title: payload.title,
    category: payload.category ?? null,
    documentDate: payload.documentDate ?? null,
    notes: payload.notes ?? null,
    originalFilename: payload.originalFilename ?? null,
  };

  // Write history before deleting
  await writeHealthHistoryEntry({
    accountId,
    lineId,
    itemKind: 'document',
    itemId: documentId,
    action: 'deleted',
    actorType: 'owner',
    actorUserId,
    payload: { itemKind: 'document', action: 'deleted', snapshot },
  });

  // Delete blob from storage if present
  if (existingRow.storage_object_key) {
    const { error: storageError } = await adminClient.storage
      .from('ultaura-health-documents')
      .remove([existingRow.storage_object_key]);

    if (storageError) {
      // Log but continue — hard-delete the row regardless to avoid orphaned metadata
      console.error(`Failed to remove storage object ${existingRow.storage_object_key}: ${storageError.message}`);
    }
  }

  // Hard-delete the row
  const { error: deleteError } = await adminClient
    .from('ultaura_health_documents')
    .delete()
    .eq('id', documentId)
    .eq('line_id', lineId);

  if (deleteError) {
    throw new Error(`Failed to delete document: ${deleteError.message}`);
  }
}
