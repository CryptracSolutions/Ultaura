import 'server-only';

import getSupabaseServerActionClient from '~/core/supabase/action-client';
import { encryptHealthPayload, decryptHealthPayload } from './crypto';
import { writeHealthHistoryEntry } from './history';
import { getOrCreateLineDEK } from '../crypto-dek';
import { deriveDedupeSubkey, deriveEvidenceSubkey, computeDedupeKey, computeEvidenceKey } from './hmac';
import { sanitizeSummaryParaphrase } from './sanitize';
import type {
  HealthSuggestion,
  StoredHealthSuggestionPayload,
  HealthSuggestionType,
  HealthSuggestionMode,
  QueueHealthSuggestionCandidateInput,
  QueueHealthSuggestionCandidateResult,
  ConditionSuggestionProposedFields,
  MedicationSuggestionProposedFields,
  StoredConditionPayload,
  StoredMedicationPayload,
} from '@ultaura/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SuggestionRow {
  id: string;
  line_id: string;
  suggestion_type: string;
  suggestion_mode: string;
  status: string;
  similar_item_id: string | null;
  source_call_started_at: string | null;
  reviewed_at: string | null;
  payload_ciphertext: unknown;
  payload_iv: unknown;
  payload_tag: unknown;
  payload_alg: string;
  payload_kid: string | null;
}

async function decryptSuggestionRow(
  row: SuggestionRow,
  accountId: string,
  lineId: string,
): Promise<StoredHealthSuggestionPayload> {
  const plaintext = await decryptHealthPayload(accountId, lineId, {
    ciphertext: row.payload_ciphertext as string,
    iv: row.payload_iv as string,
    tag: row.payload_tag as string,
    alg: row.payload_alg,
    kid: row.payload_kid,
  });
  return JSON.parse(plaintext) as StoredHealthSuggestionPayload;
}

function mapSuggestionRow(row: SuggestionRow, payload: StoredHealthSuggestionPayload): HealthSuggestion {
  return {
    id: row.id,
    lineId: row.line_id,
    suggestionType: row.suggestion_type as HealthSuggestionType,
    suggestionMode: row.suggestion_mode as HealthSuggestionMode,
    status: row.status as HealthSuggestion['status'],
    normalizedName: payload.normalizedName,
    confidenceLabel: payload.confidenceLabel,
    summaryParaphrase: payload.summaryParaphrase,
    proposedFields: payload.proposedFields,
    similarItemId: row.similar_item_id,
    similarItemWarning: payload.similarItemWarning,
    sourceCallStartedAt: row.source_call_started_at,
    reviewedAt: row.reviewed_at,
  };
}

async function getAccountIdForLine(
  adminClient: ReturnType<typeof getSupabaseServerActionClient>,
  lineId: string,
): Promise<string> {
  const { data: line, error } = await adminClient
    .from('ultaura_lines')
    .select('account_id')
    .eq('id', lineId)
    .single();

  if (error || !line) {
    throw new Error('Line not found');
  }

  return line.account_id;
}

// ---------------------------------------------------------------------------
// getPendingSuggestions
// ---------------------------------------------------------------------------

export async function getPendingSuggestions(
  lineId: string,
  filter?: { type?: 'condition' | 'medication' },
): Promise<HealthSuggestion[]> {
  const adminClient = getSupabaseServerActionClient({ admin: true });
  const accountId = await getAccountIdForLine(adminClient, lineId);

  let query = adminClient
    .from('ultaura_health_suggestions')
    .select(
      'id, line_id, suggestion_type, suggestion_mode, status, similar_item_id, source_call_started_at, reviewed_at, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid',
    )
    .eq('line_id', lineId)
    .eq('status', 'pending')
    .is('suppressed_at', null)
    .order('created_at', { ascending: false });

  if (filter?.type) {
    query = query.eq('suggestion_type', filter.type);
  }

  const { data: rows, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch suggestions: ${error.message}`);
  }

  if (!rows || rows.length === 0) return [];

  const suggestions: HealthSuggestion[] = [];

  for (const row of rows) {
    try {
      const payload = await decryptSuggestionRow(row as SuggestionRow, accountId, lineId);
      suggestions.push(mapSuggestionRow(row as SuggestionRow, payload));
    } catch {
      // Skip rows that fail to decrypt
    }
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// getPendingSuggestionCount
// ---------------------------------------------------------------------------

export async function getPendingSuggestionCount(
  lineId: string,
): Promise<{ total: number; conditions: number; medications: number }> {
  const adminClient = getSupabaseServerActionClient({ admin: true });

  const { data: rows, error } = await adminClient
    .from('ultaura_health_suggestions')
    .select('suggestion_type')
    .eq('line_id', lineId)
    .eq('status', 'pending')
    .is('suppressed_at', null);

  if (error || !rows) {
    return { total: 0, conditions: 0, medications: 0 };
  }

  const conditions = rows.filter((r) => r.suggestion_type === 'condition').length;
  const medications = rows.filter((r) => r.suggestion_type === 'medication').length;

  return { total: rows.length, conditions, medications };
}

// ---------------------------------------------------------------------------
// queueSuggestionCandidate
// ---------------------------------------------------------------------------

export async function queueSuggestionCandidate(
  input: QueueHealthSuggestionCandidateInput,
): Promise<QueueHealthSuggestionCandidateResult> {
  const { lineId, callSessionId, suggestionType, suggestionMode, normalizedName, confidenceLabel, proposedFields } =
    input;

  // 1. Sanitize summaryParaphrase — reject if sanitization fails
  const sanitized = sanitizeSummaryParaphrase(input.summaryParaphrase);
  if (!sanitized) {
    return { schemaVersion: 'health-suggestions-v1', success: true, action: 'noop_blocked' };
  }

  const adminClient = getSupabaseServerActionClient({ admin: true });

  // 2. Resolve accountId
  const accountId = await getAccountIdForLine(adminClient, lineId);

  // 3. Get line DEK for HMAC key derivation
  const lineDEK = await getOrCreateLineDEK(adminClient, accountId, lineId);

  // 4. Derive HMAC subkeys
  const dedupeSubkey = deriveDedupeSubkey(lineDEK);
  const evidenceSubkey = deriveEvidenceSubkey(lineDEK);

  // 5. For update mode: resolve update target
  let similarItemId: string | null = null;
  let similarItemWarning = false;

  if (suggestionMode === 'update') {
    const resolved = await resolveUpdateTarget(adminClient, accountId, lineId, suggestionType, normalizedName);
    if (resolved === 'no_update_target') {
      return { schemaVersion: 'health-suggestions-v1', success: true, action: 'noop_blocked' };
    }
    similarItemId = resolved;
    similarItemWarning = true;
  }

  // 6. Compute dedupe_key
  const dedupeKey = computeDedupeKey(dedupeSubkey, suggestionType, suggestionMode, normalizedName, similarItemId);

  // 7. Compute material_evidence_key
  const evidenceKey = computeEvidenceKey(
    evidenceSubkey,
    suggestionType,
    normalizedName,
    proposedFields as Record<string, unknown>,
  );

  // 8. Check uniqueness: pending non-suppressed row with same dedupe_key
  const { data: duplicate } = await adminClient
    .from('ultaura_health_suggestions')
    .select('id')
    .eq('line_id', lineId)
    .eq('dedupe_key', dedupeKey)
    .eq('status', 'pending')
    .is('suppressed_at', null)
    .maybeSingle();

  if (duplicate) {
    return { schemaVersion: 'health-suggestions-v1', success: true, action: 'noop_duplicate' };
  }

  // 9. For dismissed suggestions: check if material_evidence_key differs
  const { data: dismissed } = await adminClient
    .from('ultaura_health_suggestions')
    .select('material_evidence_key')
    .eq('line_id', lineId)
    .eq('dedupe_key', dedupeKey)
    .eq('status', 'dismissed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (dismissed && dismissed.material_evidence_key === evidenceKey) {
    return { schemaVersion: 'health-suggestions-v1', success: true, action: 'noop_blocked' };
  }

  // 10. Build payload, encrypt, and insert
  const payload: StoredHealthSuggestionPayload = {
    normalizedName,
    confidenceLabel,
    summaryParaphrase: sanitized,
    proposedFields,
    similarItemWarning,
  };

  const encrypted = await encryptHealthPayload(accountId, lineId, JSON.stringify(payload));

  const { error: insertError } = await adminClient.from('ultaura_health_suggestions').insert({
    account_id: accountId,
    line_id: lineId,
    suggestion_type: suggestionType,
    suggestion_mode: suggestionMode,
    status: 'pending',
    dedupe_key: dedupeKey,
    material_evidence_key: evidenceKey,
    similar_item_id: similarItemId,
    source_call_session_id: callSessionId,
    payload_ciphertext: encrypted.ciphertext,
    payload_iv: encrypted.iv,
    payload_tag: encrypted.tag,
    payload_alg: encrypted.alg,
    payload_kid: encrypted.kid,
  });

  if (insertError) {
    // Handle race condition: unique partial index violation means duplicate inserted concurrently
    if ((insertError as { code?: string }).code === '23505') {
      return { schemaVersion: 'health-suggestions-v1', success: true, action: 'noop_duplicate' };
    }
    throw new Error(`Failed to queue suggestion: ${insertError.message}`);
  }

  return { schemaVersion: 'health-suggestions-v1', success: true, action: 'queued' };
}

// ---------------------------------------------------------------------------
// Update-target resolution (spec Section 8.5)
// ---------------------------------------------------------------------------

async function resolveUpdateTarget(
  adminClient: ReturnType<typeof getSupabaseServerActionClient>,
  accountId: string,
  lineId: string,
  suggestionType: HealthSuggestionType,
  normalizedName: string,
): Promise<string | 'no_update_target'> {
  const table =
    suggestionType === 'condition' ? 'ultaura_health_conditions' : 'ultaura_health_medications';

  const activeStatuses =
    suggestionType === 'condition'
      ? (['active', 'monitoring'] as const)
      : (['current', 'as_needed'] as const);

  const { data: rows, error } = await adminClient
    .from(table)
    .select('id, updated_at, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid')
    .eq('line_id', lineId)
    .in('status', activeStatuses)
    .is('deleted_at', null);

  if (error || !rows || rows.length === 0) {
    return 'no_update_target';
  }

  const nameLower = normalizedName.trim().toLowerCase();

  type RankedCandidate = {
    id: string;
    updatedAt: string;
    rank: number; // lower = better: 0=exact, 1=case-insensitive, 2=no-match
  };

  const candidates: RankedCandidate[] = [];

  for (const row of rows) {
    try {
      const plaintext = await decryptHealthPayload(accountId, lineId, {
        ciphertext: row.payload_ciphertext,
        iv: row.payload_iv,
        tag: row.payload_tag,
        alg: row.payload_alg,
        kid: row.payload_kid,
      });
      const payload = JSON.parse(plaintext) as StoredConditionPayload | StoredMedicationPayload;
      const rowName = payload.name.trim();
      const rowNameLower = rowName.toLowerCase();

      let rank: number;
      if (rowName === normalizedName) {
        rank = 0; // exact match
      } else if (rowNameLower === nameLower) {
        rank = 1; // case-insensitive match
      } else {
        rank = 2; // no meaningful match — skip
      }

      if (rank < 2) {
        candidates.push({ id: row.id, updatedAt: row.updated_at as string, rank });
      }
    } catch {
      // Skip undecryptable rows
    }
  }

  if (candidates.length === 0) {
    return 'no_update_target';
  }

  // Sort: rank ASC, then updated_at DESC, then id ASC
  candidates.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });

  return candidates[0].id;
}

// ---------------------------------------------------------------------------
// approveSuggestionAsNew
// ---------------------------------------------------------------------------

export async function approveSuggestionAsNew(
  suggestionId: string,
  lineId: string,
  accountId: string,
  actorUserId: string,
): Promise<{ success: true; resultingItemId: string } | { success: false; code: string; message: string }> {
  const adminClient = getSupabaseServerActionClient({ admin: true });

  const { data: row, error: fetchError } = await adminClient
    .from('ultaura_health_suggestions')
    .select(
      'id, line_id, suggestion_type, suggestion_mode, status, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid',
    )
    .eq('id', suggestionId)
    .eq('line_id', lineId)
    .single();

  if (fetchError || !row) {
    return { success: false, code: 'not_found', message: 'Suggestion not found' };
  }

  if (row.status !== 'pending') {
    return { success: false, code: 'not_pending', message: 'Suggestion is no longer pending' };
  }

  let payload: StoredHealthSuggestionPayload;
  try {
    payload = await decryptSuggestionRow(row as SuggestionRow, accountId, lineId);
  } catch {
    return { success: false, code: 'decrypt_failed', message: 'Failed to read suggestion' };
  }

  // Create the item from the suggestion's proposed fields
  const now = new Date().toISOString();
  let resultingItemId: string;

  if (row.suggestion_type === 'condition') {
    const proposed = payload.proposedFields as ConditionSuggestionProposedFields;
    const itemPayload: StoredConditionPayload = {
      name: payload.normalizedName,
      standardizedId: proposed.standardizedId ?? null,
      diagnosedOnsetDate: proposed.diagnosedOnsetDate ?? null,
      stageSeverity: null,
      treatingClinician: null,
      notes: null,
    };

    const encrypted = await encryptHealthPayload(accountId, lineId, JSON.stringify(itemPayload));

    const { data: newItem, error: insertError } = await adminClient
      .from('ultaura_health_conditions')
      .insert({
        account_id: accountId,
        line_id: lineId,
        status: proposed.status ?? 'active',
        source: 'suggestion_approved',
        created_by_user_id: actorUserId,
        updated_by_user_id: actorUserId,
        payload_ciphertext: encrypted.ciphertext,
        payload_iv: encrypted.iv,
        payload_tag: encrypted.tag,
        payload_alg: encrypted.alg,
        payload_kid: encrypted.kid,
      })
      .select('id')
      .single();

    if (insertError || !newItem) {
      return { success: false, code: 'insert_failed', message: insertError?.message ?? 'Failed to create condition' };
    }

    resultingItemId = newItem.id;
  } else {
    // medication
    const proposed = payload.proposedFields as MedicationSuggestionProposedFields;
    const itemPayload: StoredMedicationPayload = {
      name: payload.normalizedName,
      standardizedId: proposed.standardizedId ?? null,
      dosage: proposed.dosage ?? null,
      frequency: proposed.frequency ?? null,
      timesOfDay: proposed.timesOfDay ?? [],
      prescribedBy: null,
      startDate: proposed.startDate ?? null,
      endDate: proposed.endDate ?? null,
      linkedReason: null,
      notes: null,
    };

    const encrypted = await encryptHealthPayload(accountId, lineId, JSON.stringify(itemPayload));

    const { data: newItem, error: insertError } = await adminClient
      .from('ultaura_health_medications')
      .insert({
        account_id: accountId,
        line_id: lineId,
        status: proposed.status ?? 'current',
        source: 'suggestion_approved',
        created_by_user_id: actorUserId,
        updated_by_user_id: actorUserId,
        payload_ciphertext: encrypted.ciphertext,
        payload_iv: encrypted.iv,
        payload_tag: encrypted.tag,
        payload_alg: encrypted.alg,
        payload_kid: encrypted.kid,
      })
      .select('id')
      .single();

    if (insertError || !newItem) {
      return { success: false, code: 'insert_failed', message: insertError?.message ?? 'Failed to create medication' };
    }

    resultingItemId = newItem.id;
  }

  // Update suggestion row
  await adminClient
    .from('ultaura_health_suggestions')
    .update({
      status: 'approved',
      resulting_item_id: resultingItemId,
      reviewed_by_user_id: actorUserId,
      reviewed_at: now,
    })
    .eq('id', suggestionId);

  // Write history
  await writeHealthHistoryEntry({
    accountId,
    lineId,
    itemKind: 'suggestion',
    itemId: suggestionId,
    action: 'suggestion_approved',
    actorType: 'owner',
    actorUserId,
    payload: {
      itemKind: 'suggestion',
      action: 'suggestion_approved',
      suggestionType: row.suggestion_type as HealthSuggestionType,
      normalizedName: payload.normalizedName,
      resultingItemId,
    },
  });

  return { success: true, resultingItemId };
}

// ---------------------------------------------------------------------------
// approveSuggestionAsUpdate
// ---------------------------------------------------------------------------

export async function approveSuggestionAsUpdate(
  suggestionId: string,
  lineId: string,
  accountId: string,
  actorUserId: string,
  targetItemId: string,
): Promise<{ success: true } | { success: false; code: string; message: string }> {
  const adminClient = getSupabaseServerActionClient({ admin: true });

  // Load suggestion
  const { data: suggRow, error: suggError } = await adminClient
    .from('ultaura_health_suggestions')
    .select(
      'id, line_id, suggestion_type, status, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid',
    )
    .eq('id', suggestionId)
    .eq('line_id', lineId)
    .single();

  if (suggError || !suggRow) {
    return { success: false, code: 'not_found', message: 'Suggestion not found' };
  }

  if (suggRow.status !== 'pending') {
    return { success: false, code: 'not_pending', message: 'Suggestion is no longer pending' };
  }

  let suggPayload: StoredHealthSuggestionPayload;
  try {
    suggPayload = await decryptSuggestionRow(suggRow as SuggestionRow, accountId, lineId);
  } catch {
    return { success: false, code: 'decrypt_failed', message: 'Failed to read suggestion' };
  }

  const now = new Date().toISOString();
  const suggestionType = suggRow.suggestion_type as HealthSuggestionType;

  if (suggestionType === 'condition') {
    const { data: target, error: targetError } = await adminClient
      .from('ultaura_health_conditions')
      .select('id, line_id, status, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid')
      .eq('id', targetItemId)
      .eq('line_id', lineId)
      .is('deleted_at', null)
      .single();

    if (targetError || !target) {
      return { success: false, code: 'target_not_found', message: 'Target condition not found' };
    }

    const existingPlaintext = await decryptHealthPayload(accountId, lineId, {
      ciphertext: target.payload_ciphertext,
      iv: target.payload_iv,
      tag: target.payload_tag,
      alg: target.payload_alg,
      kid: target.payload_kid,
    });
    const existingPayload = JSON.parse(existingPlaintext) as StoredConditionPayload;
    const proposed = suggPayload.proposedFields as ConditionSuggestionProposedFields;

    const updatedPayload: StoredConditionPayload = {
      ...existingPayload,
      ...(proposed.standardizedId !== undefined && { standardizedId: proposed.standardizedId }),
      ...(proposed.diagnosedOnsetDate !== undefined && { diagnosedOnsetDate: proposed.diagnosedOnsetDate }),
    };
    const newStatus = (proposed.status ?? target.status) as 'active' | 'monitoring' | 'resolved';

    const encrypted = await encryptHealthPayload(accountId, lineId, JSON.stringify(updatedPayload));

    await adminClient
      .from('ultaura_health_conditions')
      .update({
        status: newStatus,
        updated_by_user_id: actorUserId,
        updated_at: now,
        payload_ciphertext: encrypted.ciphertext,
        payload_iv: encrypted.iv,
        payload_tag: encrypted.tag,
        payload_alg: encrypted.alg,
        payload_kid: encrypted.kid,
      })
      .eq('id', targetItemId);

    await writeHealthHistoryEntry({
      accountId,
      lineId,
      itemKind: 'condition',
      itemId: targetItemId,
      action: 'edited',
      actorType: 'owner',
      actorUserId,
      payload: {
        itemKind: 'condition',
        action: 'edited',
        summaryLabel: `Updated from AI suggestion: ${suggPayload.normalizedName}`,
        changes: [],
      },
    });
  } else {
    const { data: target, error: targetError } = await adminClient
      .from('ultaura_health_medications')
      .select('id, line_id, status, linked_condition_id, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid')
      .eq('id', targetItemId)
      .eq('line_id', lineId)
      .is('deleted_at', null)
      .single();

    if (targetError || !target) {
      return { success: false, code: 'target_not_found', message: 'Target medication not found' };
    }

    const existingPlaintext = await decryptHealthPayload(accountId, lineId, {
      ciphertext: target.payload_ciphertext,
      iv: target.payload_iv,
      tag: target.payload_tag,
      alg: target.payload_alg,
      kid: target.payload_kid,
    });
    const existingPayload = JSON.parse(existingPlaintext) as StoredMedicationPayload;
    const proposed = suggPayload.proposedFields as MedicationSuggestionProposedFields;

    const updatedPayload: StoredMedicationPayload = {
      ...existingPayload,
      ...(proposed.standardizedId !== undefined && { standardizedId: proposed.standardizedId }),
      ...(proposed.dosage !== undefined && { dosage: proposed.dosage }),
      ...(proposed.frequency !== undefined && { frequency: proposed.frequency }),
      ...(proposed.timesOfDay !== undefined && { timesOfDay: proposed.timesOfDay }),
      ...(proposed.startDate !== undefined && { startDate: proposed.startDate }),
      ...(proposed.endDate !== undefined && { endDate: proposed.endDate }),
    };
    const newStatus = (proposed.status ?? target.status) as 'current' | 'as_needed' | 'discontinued';

    const encrypted = await encryptHealthPayload(accountId, lineId, JSON.stringify(updatedPayload));

    await adminClient
      .from('ultaura_health_medications')
      .update({
        status: newStatus,
        updated_by_user_id: actorUserId,
        payload_ciphertext: encrypted.ciphertext,
        payload_iv: encrypted.iv,
        payload_tag: encrypted.tag,
        payload_alg: encrypted.alg,
        payload_kid: encrypted.kid,
      })
      .eq('id', targetItemId);

    await writeHealthHistoryEntry({
      accountId,
      lineId,
      itemKind: 'medication',
      itemId: targetItemId,
      action: 'edited',
      actorType: 'owner',
      actorUserId,
      payload: {
        itemKind: 'medication',
        action: 'edited',
        summaryLabel: `Updated from AI suggestion: ${suggPayload.normalizedName}`,
        changes: [],
      },
    });
  }

  // Update suggestion row
  await adminClient
    .from('ultaura_health_suggestions')
    .update({
      status: 'approved',
      resulting_item_id: targetItemId,
      reviewed_by_user_id: actorUserId,
      reviewed_at: now,
    })
    .eq('id', suggestionId);

  // Write suggestion history
  await writeHealthHistoryEntry({
    accountId,
    lineId,
    itemKind: 'suggestion',
    itemId: suggestionId,
    action: 'suggestion_approved',
    actorType: 'owner',
    actorUserId,
    payload: {
      itemKind: 'suggestion',
      action: 'suggestion_approved',
      suggestionType,
      normalizedName: suggPayload.normalizedName,
      resultingItemId: targetItemId,
    },
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// dismissSuggestion
// ---------------------------------------------------------------------------

export async function dismissSuggestion(
  suggestionId: string,
  lineId: string,
  accountId: string,
  actorUserId: string,
): Promise<{ success: true } | { success: false; code: string; message: string }> {
  const adminClient = getSupabaseServerActionClient({ admin: true });

  const { data: row, error: fetchError } = await adminClient
    .from('ultaura_health_suggestions')
    .select('id, suggestion_type, status, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid')
    .eq('id', suggestionId)
    .eq('line_id', lineId)
    .single();

  if (fetchError || !row) {
    return { success: false, code: 'not_found', message: 'Suggestion not found' };
  }

  if (row.status !== 'pending') {
    return { success: false, code: 'not_pending', message: 'Suggestion is no longer pending' };
  }

  let payload: StoredHealthSuggestionPayload;
  try {
    payload = await decryptSuggestionRow(row as SuggestionRow, accountId, lineId);
  } catch {
    return { success: false, code: 'decrypt_failed', message: 'Failed to read suggestion' };
  }

  const now = new Date().toISOString();

  await adminClient
    .from('ultaura_health_suggestions')
    .update({
      status: 'dismissed',
      dismiss_reason: 'owner_dismissed',
      reviewed_by_user_id: actorUserId,
      reviewed_at: now,
    })
    .eq('id', suggestionId);

  await writeHealthHistoryEntry({
    accountId,
    lineId,
    itemKind: 'suggestion',
    itemId: suggestionId,
    action: 'suggestion_dismissed',
    actorType: 'owner',
    actorUserId,
    payload: {
      itemKind: 'suggestion',
      action: 'suggestion_dismissed',
      suggestionType: row.suggestion_type as HealthSuggestionType,
      normalizedName: payload.normalizedName,
      resultingItemId: null,
    },
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// queueSuggestionFromTelephony
// Telephony-facing entry point. Identical to queueSuggestionCandidate but
// surfaces 'no_update_target' as a distinct action rather than collapsing it
// into 'noop_blocked'.
// ---------------------------------------------------------------------------

export async function queueSuggestionFromTelephony(params: {
  accountId: string;
  lineId: string;
  callSessionId: string;
  suggestionType: 'condition' | 'medication';
  suggestionMode: 'new' | 'update';
  normalizedName: string;
  confidenceLabel: 'high' | 'medium';
  summaryParaphrase: string;
  proposedFields: Record<string, unknown>;
}): Promise<{ action: 'queued' | 'noop_duplicate' | 'noop_blocked' | 'no_update_target' }> {
  const { lineId, callSessionId, suggestionType, suggestionMode, normalizedName, confidenceLabel, proposedFields } =
    params;

  const sanitized = sanitizeSummaryParaphrase(params.summaryParaphrase);
  if (!sanitized) {
    return { action: 'noop_blocked' };
  }

  const adminClient = getSupabaseServerActionClient({ admin: true });
  const lineDEK = await getOrCreateLineDEK(adminClient, params.accountId, lineId);
  const dedupeSubkey = deriveDedupeSubkey(lineDEK);
  const evidenceSubkey = deriveEvidenceSubkey(lineDEK);

  let similarItemId: string | null = null;
  let similarItemWarning = false;

  if (suggestionMode === 'update') {
    const resolved = await resolveUpdateTarget(
      adminClient,
      params.accountId,
      lineId,
      suggestionType,
      normalizedName,
    );
    if (resolved === 'no_update_target') {
      return { action: 'no_update_target' };
    }
    similarItemId = resolved;
    similarItemWarning = true;
  }

  const dedupeKey = computeDedupeKey(dedupeSubkey, suggestionType, suggestionMode, normalizedName, similarItemId);
  const evidenceKey = computeEvidenceKey(evidenceSubkey, suggestionType, normalizedName, proposedFields);

  const { data: duplicate } = await adminClient
    .from('ultaura_health_suggestions')
    .select('id')
    .eq('line_id', lineId)
    .eq('dedupe_key', dedupeKey)
    .eq('status', 'pending')
    .is('suppressed_at', null)
    .maybeSingle();

  if (duplicate) {
    return { action: 'noop_duplicate' };
  }

  const { data: dismissed } = await adminClient
    .from('ultaura_health_suggestions')
    .select('material_evidence_key')
    .eq('line_id', lineId)
    .eq('dedupe_key', dedupeKey)
    .eq('status', 'dismissed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (dismissed && dismissed.material_evidence_key === evidenceKey) {
    return { action: 'noop_blocked' };
  }

  const payload: StoredHealthSuggestionPayload = {
    normalizedName,
    confidenceLabel,
    summaryParaphrase: sanitized,
    proposedFields: proposedFields as ConditionSuggestionProposedFields | MedicationSuggestionProposedFields,
    similarItemWarning,
  };

  const encrypted = await encryptHealthPayload(params.accountId, lineId, JSON.stringify(payload));

  const { error: insertError } = await adminClient.from('ultaura_health_suggestions').insert({
    account_id: params.accountId,
    line_id: lineId,
    suggestion_type: suggestionType,
    suggestion_mode: suggestionMode,
    status: 'pending',
    dedupe_key: dedupeKey,
    material_evidence_key: evidenceKey,
    similar_item_id: similarItemId,
    source_call_session_id: callSessionId,
    payload_ciphertext: encrypted.ciphertext,
    payload_iv: encrypted.iv,
    payload_tag: encrypted.tag,
    payload_alg: encrypted.alg,
    payload_kid: encrypted.kid,
  });

  if (insertError) {
    if ((insertError as { code?: string }).code === '23505') {
      return { action: 'noop_duplicate' };
    }
    throw new Error(`Failed to queue suggestion: ${insertError.message}`);
  }

  return { action: 'queued' };
}

// ---------------------------------------------------------------------------
// staleDismissCompetingSuggestions
// Called by conditions.ts / medications.ts when an item is manually edited.
// ---------------------------------------------------------------------------

export async function staleDismissCompetingSuggestions(
  lineId: string,
  accountId: string,
  itemKind: 'condition' | 'medication',
  itemName: string,
): Promise<void> {
  const adminClient = getSupabaseServerActionClient({ admin: true });
  const nameLower = itemName.trim().toLowerCase();

  const { data: suggestions } = await adminClient
    .from('ultaura_health_suggestions')
    .select('id, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid')
    .eq('line_id', lineId)
    .eq('suggestion_type', itemKind)
    .eq('status', 'pending')
    .is('suppressed_at', null);

  if (!suggestions || suggestions.length === 0) return;

  const toStale: string[] = [];

  for (const s of suggestions) {
    try {
      const plaintext = await decryptHealthPayload(accountId, lineId, {
        ciphertext: s.payload_ciphertext,
        iv: s.payload_iv,
        tag: s.payload_tag,
        alg: s.payload_alg,
        kid: s.payload_kid,
      });
      const payload = JSON.parse(plaintext) as { normalizedName?: string };
      if (payload.normalizedName?.trim().toLowerCase() === nameLower) {
        toStale.push(s.id);
      }
    } catch {
      // Skip on decrypt failure
    }
  }

  if (toStale.length === 0) return;

  await adminClient
    .from('ultaura_health_suggestions')
    .update({ status: 'dismissed', dismiss_reason: 'system_stale' })
    .in('id', toStale);

  // Write system_stale_dismissed history for each
  for (const id of toStale) {
    await writeHealthHistoryEntry({
      accountId,
      lineId,
      itemKind: 'suggestion',
      itemId: id,
      action: 'system_stale_dismissed',
      actorType: 'system',
      actorUserId: null,
      payload: {
        itemKind: 'suggestion',
        action: 'system_stale_dismissed',
        suggestionType: itemKind,
        normalizedName: itemName,
        resultingItemId: null,
      },
    });
  }
}
