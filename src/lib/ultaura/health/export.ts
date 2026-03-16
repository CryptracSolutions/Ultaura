import 'server-only';

import { type SupabaseClient } from '@supabase/supabase-js';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import { decryptHealthPayload } from './crypto';
import type {
  HealthExportBundlePayload,
  HealthExportConditionRow,
  HealthExportMedicationRow,
  HealthExportObservationRow,
  HealthExportHistoryRow,
  HealthExportDocumentRow,
  HealthExportManifest,
  HealthConditionStatus,
  HealthMedicationStatus,
  StoredConditionPayload,
  StoredMedicationPayload,
  StoredObservationPayload,
  StoredDocumentPayload,
  HealthHistoryPayload,
} from '@ultaura/types';

/**
 * Checks whether an account has exportable Health Profile data or document files.
 *
 * This is a Phase 1 stub. Full Health content composition happens in Phase 7.
 * Uses DB-side security-definer functions as the authoritative classification
 * source so app-only classification cannot be bypassed.
 */
export async function getHealthExportInclusion(accountId: string): Promise<{
  includesHealthProfile: boolean;
  includesDocumentFiles: boolean;
}> {
  const adminClient = getSupabaseServerActionClient({ admin: true });

  const [healthResult, docResult] = await Promise.all([
    adminClient.rpc('has_exportable_health_profile_data', {
      target_account_id: accountId,
    }),
    adminClient.rpc('has_exportable_health_document_files', {
      target_account_id: accountId,
    }),
  ]);

  const includesHealthProfile = healthResult.error
    ? false
    : Boolean(healthResult.data);

  const includesDocumentFiles = docResult.error
    ? false
    : Boolean(docResult.data);

  return { includesHealthProfile, includesDocumentFiles };
}

/**
 * Composes the full health export bundle for a given account and export request.
 * Decrypts all health rows across all lines and returns a structured bundle payload.
 * Individual decrypt failures are silently skipped — the export proceeds with
 * successfully decrypted rows.
 */
export async function composeHealthExportBundle(
  accountId: string,
  requestId: string,
  requestedFormat: 'json' | 'csv' = 'json',
): Promise<HealthExportBundlePayload> {
  const adminClient = getSupabaseServerActionClient({ admin: true }) as SupabaseClient;

  // 1. Get all lines for this account
  const { data: lines } = await adminClient
    .from('ultaura_lines')
    .select('id')
    .eq('account_id', accountId);

  const lineIds = (lines ?? []).map((l: { id: string }) => l.id);

  // 2. Conditions
  const conditions: HealthExportConditionRow[] = [];

  for (const lineId of lineIds) {
    const { data: rows } = await adminClient
      .from('ultaura_health_conditions')
      .select(
        'id, line_id, status, created_at, updated_at, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid',
      )
      .eq('line_id', lineId)
      .is('deleted_at', null);

    for (const row of rows ?? []) {
      try {
        const decrypted = await decryptHealthPayload(accountId, lineId, {
          ciphertext: row.payload_ciphertext,
          iv: row.payload_iv,
          tag: row.payload_tag,
          alg: row.payload_alg,
          kid: row.payload_kid,
        });
        const payload = JSON.parse(decrypted) as StoredConditionPayload;

        conditions.push({
          conditionId: row.id,
          lineId,
          status: row.status as HealthConditionStatus,
          name: payload.name,
          standardizedId: payload.standardizedId ?? null,
          diagnosedOnsetDate: payload.diagnosedOnsetDate ?? null,
          stageSeverity: payload.stageSeverity ?? null,
          treatingClinician: payload.treatingClinician ?? null,
          notes: payload.notes ?? null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      } catch {
        // Skip individual decrypt failures
      }
    }
  }

  // 3. Medications
  const medications: HealthExportMedicationRow[] = [];

  for (const lineId of lineIds) {
    const { data: rows } = await adminClient
      .from('ultaura_health_medications')
      .select(
        'id, line_id, status, linked_condition_id, created_at, updated_at, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid',
      )
      .eq('line_id', lineId)
      .is('deleted_at', null);

    for (const row of rows ?? []) {
      try {
        const decrypted = await decryptHealthPayload(accountId, lineId, {
          ciphertext: row.payload_ciphertext,
          iv: row.payload_iv,
          tag: row.payload_tag,
          alg: row.payload_alg,
          kid: row.payload_kid,
        });
        const payload = JSON.parse(decrypted) as StoredMedicationPayload;

        medications.push({
          medicationId: row.id,
          lineId,
          status: row.status as HealthMedicationStatus,
          name: payload.name,
          standardizedId: payload.standardizedId ?? null,
          dosage: payload.dosage ?? null,
          frequency: payload.frequency ?? null,
          timesOfDay: payload.timesOfDay ?? [],
          prescribedBy: payload.prescribedBy ?? null,
          startDate: payload.startDate ?? null,
          endDate: payload.endDate ?? null,
          linkedConditionId: row.linked_condition_id ?? null,
          linkedReason: payload.linkedReason ?? null,
          notes: payload.notes ?? null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      } catch {
        // Skip individual decrypt failures
      }
    }
  }

  // 4. Observations
  const observations: HealthExportObservationRow[] = [];

  for (const lineId of lineIds) {
    const { data: rows } = await adminClient
      .from('ultaura_health_observations')
      .select(
        'id, line_id, created_at, updated_at, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid',
      )
      .eq('line_id', lineId)
      .is('deleted_at', null);

    for (const row of rows ?? []) {
      try {
        const decrypted = await decryptHealthPayload(accountId, lineId, {
          ciphertext: row.payload_ciphertext,
          iv: row.payload_iv,
          tag: row.payload_tag,
          alg: row.payload_alg,
          kid: row.payload_kid,
        });
        const payload = JSON.parse(decrypted) as StoredObservationPayload;

        observations.push({
          observationId: row.id,
          lineId,
          text: payload.text,
          category: payload.category ?? null,
          observedDate: payload.observedDate ?? null,
          concernLevel: payload.concernLevel ?? null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      } catch {
        // Skip individual decrypt failures
      }
    }
  }

  // 5. History
  const history: HealthExportHistoryRow[] = [];

  for (const lineId of lineIds) {
    const { data: rows } = await adminClient
      .from('ultaura_health_item_history')
      .select(
        'id, line_id, item_kind, item_id, action, actor_type, actor_user_id, created_at, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid',
      )
      .eq('line_id', lineId)
      .order('created_at', { ascending: true });

    for (const row of rows ?? []) {
      try {
        const decrypted = await decryptHealthPayload(accountId, lineId, {
          ciphertext: row.payload_ciphertext,
          iv: row.payload_iv,
          tag: row.payload_tag,
          alg: row.payload_alg,
          kid: row.payload_kid,
        });
        const payload = JSON.parse(decrypted) as HealthHistoryPayload;

        history.push({
          createdAt: row.created_at,
          lineId,
          itemKind: row.item_kind as HealthExportHistoryRow['itemKind'],
          itemId: row.item_id ?? null,
          action: row.action as HealthExportHistoryRow['action'],
          actorType: row.actor_type as HealthExportHistoryRow['actorType'],
          actorUserId: row.actor_user_id ?? null,
          payload,
        });
      } catch {
        // Skip individual decrypt failures
      }
    }
  }

  // 6. Documents — metadata rows + file descriptor entries
  const documents: HealthExportDocumentRow[] = [];
  const documentFiles: HealthExportBundlePayload['documentFiles'] = [];

  for (const lineId of lineIds) {
    const { data: rows } = await adminClient
      .from('ultaura_health_documents')
      .select(
        'id, line_id, mime_type, created_at, updated_at, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid',
      )
      .eq('line_id', lineId)
      .eq('status', 'active');

    for (const row of rows ?? []) {
      try {
        const decrypted = await decryptHealthPayload(accountId, lineId, {
          ciphertext: row.payload_ciphertext,
          iv: row.payload_iv,
          tag: row.payload_tag,
          alg: row.payload_alg,
          kid: row.payload_kid,
        });
        const payload = JSON.parse(decrypted) as StoredDocumentPayload;

        // Sanitize filename for export — keep only safe characters, cap length
        const safeName = (payload.originalFilename ?? 'document')
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .slice(0, 100);
        const exportedFilename = `${row.id}__${safeName}`;

        documents.push({
          documentId: row.id,
          lineId,
          title: payload.title,
          category: payload.category ?? null,
          documentDate: payload.documentDate ?? null,
          notes: payload.notes ?? null,
          originalFilename: payload.originalFilename,
          exportedFilename,
          mimeType: row.mime_type ?? 'application/octet-stream',
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });

        documentFiles.push({
          documentId: row.id,
          exportedFilename,
          internalBytePath: `/api/privacy/exports/${requestId}/health-document-bytes/${row.id}`,
          originalFilename: payload.originalFilename,
          mimeType: row.mime_type ?? 'application/octet-stream',
        });
      } catch {
        // Skip individual decrypt failures
      }
    }
  }

  // 7. Build manifest
  const manifest: HealthExportManifest = {
    schemaVersion: 'health-profile-export-v1',
    requestId,
    requestedFormat,
    exportedAt: new Date().toISOString(),
    conditions,
    medications,
    observations,
    history,
    documents,
  };

  return {
    schemaVersion: 'health-export-bundle-v1',
    requestId,
    manifest,
    documentFiles,
  };
}
