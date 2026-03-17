import 'server-only';

import getSupabaseServerActionClient from '~/core/supabase/action-client';
import { encryptHealthPayload, decryptHealthPayload, preloadLineDEK } from './crypto';
import { writeHealthHistoryEntry } from './history';
import { conditionFormSchema } from '@ultaura/schemas';
import type {
  HealthCondition,
  HealthConditionStatus,
  StoredConditionPayload,
  HealthConditionHistorySnapshot,
  HealthConditionHistoryChange,
  ApproximateDateValue,
} from '@ultaura/types';
import type { ConditionFormInput } from '@ultaura/schemas';

interface GetConditionsFilter {
  status?: 'active' | 'resolved';
  includeMonitoring?: boolean;
}

const CONDITION_DECRYPT_CONCURRENCY = 8;

export async function getConditions(
  lineId: string,
  filter?: GetConditionsFilter,
  /** Pass accountId from the access check to skip a redundant line lookup. */
  knownAccountId?: string,
): Promise<HealthCondition[]> {
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

  let query = adminClient
    .from('ultaura_health_conditions')
    .select(
      'id, line_id, status, created_at, updated_at, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid',
    )
    .eq('line_id', lineId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  // Active view = 'active' + 'monitoring'; Resolved view = 'resolved' only
  if (filter?.status === 'resolved') {
    query = query.eq('status', 'resolved');
  } else if (filter?.status === 'active') {
    if (filter.includeMonitoring === false) {
      query = query.eq('status', 'active');
    } else {
      query = query.in('status', ['active', 'monitoring']);
    }
  }
  // No filter = return all

  const { data: rows, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch conditions: ${error.message}`);
  }

  if (!rows || rows.length === 0) return [];

  // Pre-load DEK once for all rows instead of fetching per-row
  const dek = await preloadLineDEK(accountId, lineId);
  const decodedConditions: Array<HealthCondition | null> = new Array(rows.length).fill(null);

  const decodeRow = async (row: (typeof rows)[number]): Promise<HealthCondition | null> => {
    try {
      const plaintext = await decryptHealthPayload(accountId, lineId, {
        ciphertext: row.payload_ciphertext,
        iv: row.payload_iv,
        tag: row.payload_tag,
        alg: row.payload_alg,
        kid: row.payload_kid,
      }, dek);

      const payload = JSON.parse(plaintext) as StoredConditionPayload;

      return {
        id: row.id,
        lineId: row.line_id,
        status: row.status as HealthConditionStatus,
        name: payload.name,
        standardizedId: payload.standardizedId,
        diagnosedOnsetDate: payload.diagnosedOnsetDate,
        stageSeverity: payload.stageSeverity,
        treatingClinician: payload.treatingClinician,
        notes: payload.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch {
      // Skip conditions that fail to decrypt
      return null;
    }
  };

  let nextIndex = 0;
  const takeNextIndex = () => {
    if (nextIndex >= rows.length) return null;
    const current = nextIndex;
    nextIndex += 1;
    return current;
  };

  const workerCount = Math.min(CONDITION_DECRYPT_CONCURRENCY, rows.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = takeNextIndex();
        if (index === null) return;

        decodedConditions[index] = await decodeRow(rows[index]!);
      }
    }),
  );

  return decodedConditions.filter((condition): condition is HealthCondition => condition !== null);
}

export async function checkDuplicateCondition(
  lineId: string,
  name: string,
): Promise<HealthCondition[]> {
  const all = await getConditions(lineId);
  const nameLower = name.trim().toLowerCase();
  return all.filter((c) => c.name.trim().toLowerCase() === nameLower);
}

export async function createCondition(
  accountId: string,
  lineId: string,
  actorUserId: string,
  input: ConditionFormInput,
): Promise<HealthCondition> {
  const parsed = conditionFormSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid condition input: ${parsed.error.message}`);
  }

  const data = parsed.data;

  const payload: StoredConditionPayload = {
    name: data.name,
    standardizedId: data.standardizedId ?? null,
    diagnosedOnsetDate: data.diagnosedOnsetDate
      ? { precision: data.diagnosedOnsetDate.precision, value: data.diagnosedOnsetDate.value as ApproximateDateValue }
      : null,
    stageSeverity: data.stageSeverity ?? null,
    treatingClinician: data.treatingClinician ?? null,
    notes: data.notes ?? null,
  };

  const encrypted = await encryptHealthPayload(accountId, lineId, JSON.stringify(payload));
  const adminClient = getSupabaseServerActionClient({ admin: true });

  const { data: row, error } = await adminClient
    .from('ultaura_health_conditions')
    .insert({
      account_id: accountId,
      line_id: lineId,
      status: data.status,
      source: 'owner_manual',
      created_by_user_id: actorUserId,
      updated_by_user_id: actorUserId,
      payload_ciphertext: encrypted.ciphertext,
      payload_iv: encrypted.iv,
      payload_tag: encrypted.tag,
      payload_alg: encrypted.alg,
      payload_kid: encrypted.kid,
    })
    .select('id, line_id, status, created_at, updated_at')
    .single();

  if (error || !row) {
    throw new Error(`Failed to create condition: ${error?.message}`);
  }

  const snapshot: HealthConditionHistorySnapshot = {
    name: payload.name,
    status: data.status,
    diagnosedOnsetDate: payload.diagnosedOnsetDate,
    stageSeverity: payload.stageSeverity,
    treatingClinician: payload.treatingClinician,
    notes: payload.notes,
  };

  await writeHealthHistoryEntry({
    accountId,
    lineId,
    itemKind: 'condition',
    itemId: row.id,
    action: 'created',
    actorType: 'owner',
    actorUserId,
    payload: { itemKind: 'condition', action: 'created', snapshot },
  });

  return {
    id: row.id,
    lineId: row.line_id,
    status: row.status as HealthConditionStatus,
    name: payload.name,
    standardizedId: payload.standardizedId,
    diagnosedOnsetDate: payload.diagnosedOnsetDate,
    stageSeverity: payload.stageSeverity,
    treatingClinician: payload.treatingClinician,
    notes: payload.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function editCondition(
  conditionId: string,
  lineId: string,
  accountId: string,
  actorUserId: string,
  input: ConditionFormInput,
): Promise<HealthCondition> {
  const parsed = conditionFormSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid condition input: ${parsed.error.message}`);
  }

  const data = parsed.data;
  const adminClient = getSupabaseServerActionClient({ admin: true });

  // Load existing condition to compute field-level changes
  const { data: existingRow, error: fetchError } = await adminClient
    .from('ultaura_health_conditions')
    .select(
      'id, line_id, status, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid',
    )
    .eq('id', conditionId)
    .eq('line_id', lineId)
    .is('deleted_at', null)
    .single();

  if (fetchError || !existingRow) {
    throw new Error('Condition not found');
  }

  const existingPlaintext = await decryptHealthPayload(accountId, lineId, {
    ciphertext: existingRow.payload_ciphertext,
    iv: existingRow.payload_iv,
    tag: existingRow.payload_tag,
    alg: existingRow.payload_alg,
    kid: existingRow.payload_kid,
  });

  const existingPayload = JSON.parse(existingPlaintext) as StoredConditionPayload;
  const existingStatus = existingRow.status as HealthConditionStatus;

  const newPayload: StoredConditionPayload = {
    name: data.name,
    standardizedId: data.standardizedId ?? null,
    diagnosedOnsetDate: data.diagnosedOnsetDate
      ? { precision: data.diagnosedOnsetDate.precision, value: data.diagnosedOnsetDate.value as ApproximateDateValue }
      : null,
    stageSeverity: data.stageSeverity ?? null,
    treatingClinician: data.treatingClinician ?? null,
    notes: data.notes ?? null,
  };

  // Compute field-level changes
  const changes: HealthConditionHistoryChange[] = [];

  if (existingPayload.name !== newPayload.name) {
    changes.push({ field: 'name', before: existingPayload.name, after: newPayload.name });
  }
  if (existingStatus !== data.status) {
    changes.push({ field: 'status', before: existingStatus, after: data.status });
  }
  if (JSON.stringify(existingPayload.diagnosedOnsetDate) !== JSON.stringify(newPayload.diagnosedOnsetDate)) {
    changes.push({ field: 'diagnosedOnsetDate', before: existingPayload.diagnosedOnsetDate, after: newPayload.diagnosedOnsetDate });
  }
  if ((existingPayload.stageSeverity ?? null) !== (newPayload.stageSeverity ?? null)) {
    changes.push({ field: 'stageSeverity', before: existingPayload.stageSeverity, after: newPayload.stageSeverity });
  }
  if ((existingPayload.treatingClinician ?? null) !== (newPayload.treatingClinician ?? null)) {
    changes.push({ field: 'treatingClinician', before: existingPayload.treatingClinician, after: newPayload.treatingClinician });
  }
  if ((existingPayload.notes ?? null) !== (newPayload.notes ?? null)) {
    changes.push({ field: 'notes', before: existingPayload.notes, after: newPayload.notes });
  }

  const encrypted = await encryptHealthPayload(accountId, lineId, JSON.stringify(newPayload));

  const { data: updatedRow, error: updateError } = await adminClient
    .from('ultaura_health_conditions')
    .update({
      status: data.status,
      updated_by_user_id: actorUserId,
      updated_at: new Date().toISOString(),
      payload_ciphertext: encrypted.ciphertext,
      payload_iv: encrypted.iv,
      payload_tag: encrypted.tag,
      payload_alg: encrypted.alg,
      payload_kid: encrypted.kid,
    })
    .eq('id', conditionId)
    .eq('line_id', lineId)
    .select('id, line_id, status, created_at, updated_at')
    .single();

  if (updateError || !updatedRow) {
    throw new Error(`Failed to update condition: ${updateError?.message}`);
  }

  if (changes.length > 0) {
    await writeHealthHistoryEntry({
      accountId,
      lineId,
      itemKind: 'condition',
      itemId: conditionId,
      action: 'edited',
      actorType: 'owner',
      actorUserId,
      payload: {
        itemKind: 'condition',
        action: 'edited',
        summaryLabel: `Updated ${newPayload.name}`,
        changes,
      },
    });
  }

  // Stale-dismiss competing pending suggestions with matching type+name
  await staleDismissSuggestions(adminClient, accountId, lineId, 'condition', newPayload.name);

  return {
    id: updatedRow.id,
    lineId: updatedRow.line_id,
    status: updatedRow.status as HealthConditionStatus,
    name: newPayload.name,
    standardizedId: newPayload.standardizedId,
    diagnosedOnsetDate: newPayload.diagnosedOnsetDate,
    stageSeverity: newPayload.stageSeverity,
    treatingClinician: newPayload.treatingClinician,
    notes: newPayload.notes,
    createdAt: updatedRow.created_at,
    updatedAt: updatedRow.updated_at,
  };
}

export async function changeConditionStatus(
  conditionId: string,
  lineId: string,
  accountId: string,
  actorUserId: string,
  newStatus: HealthConditionStatus,
): Promise<void> {
  const adminClient = getSupabaseServerActionClient({ admin: true });

  const { data: existingRow, error: fetchError } = await adminClient
    .from('ultaura_health_conditions')
    .select('id, status, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid')
    .eq('id', conditionId)
    .eq('line_id', lineId)
    .is('deleted_at', null)
    .single();

  if (fetchError || !existingRow) {
    throw new Error('Condition not found');
  }

  const existingStatus = existingRow.status as HealthConditionStatus;

  if (existingStatus === newStatus) return;

  const { error } = await adminClient
    .from('ultaura_health_conditions')
    .update({
      status: newStatus,
      updated_by_user_id: actorUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conditionId)
    .eq('line_id', lineId);

  if (error) {
    throw new Error(`Failed to update condition status: ${error.message}`);
  }

  // Decrypt payload to get name for history
  const plaintext = await decryptHealthPayload(accountId, lineId, {
    ciphertext: existingRow.payload_ciphertext,
    iv: existingRow.payload_iv,
    tag: existingRow.payload_tag,
    alg: existingRow.payload_alg,
    kid: existingRow.payload_kid,
  });
  const payload = JSON.parse(plaintext) as StoredConditionPayload;

  const changes: HealthConditionHistoryChange[] = [
    { field: 'status', before: existingStatus, after: newStatus },
  ];

  await writeHealthHistoryEntry({
    accountId,
    lineId,
    itemKind: 'condition',
    itemId: conditionId,
    action: 'edited',
    actorType: 'owner',
    actorUserId,
    payload: {
      itemKind: 'condition',
      action: 'edited',
      summaryLabel: `Status changed to ${newStatus}`,
      changes,
    },
  });

  // Stale-dismiss suggestions when status changes to resolved
  if (newStatus === 'resolved') {
    await staleDismissSuggestions(adminClient, accountId, lineId, 'condition', payload.name);
  }
}

export async function deleteCondition(
  conditionId: string,
  lineId: string,
  accountId: string,
  actorUserId: string,
): Promise<void> {
  const adminClient = getSupabaseServerActionClient({ admin: true });

  const { data: existingRow, error: fetchError } = await adminClient
    .from('ultaura_health_conditions')
    .select(
      'id, status, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid',
    )
    .eq('id', conditionId)
    .eq('line_id', lineId)
    .is('deleted_at', null)
    .single();

  if (fetchError || !existingRow) {
    throw new Error('Condition not found');
  }

  const plaintext = await decryptHealthPayload(accountId, lineId, {
    ciphertext: existingRow.payload_ciphertext,
    iv: existingRow.payload_iv,
    tag: existingRow.payload_tag,
    alg: existingRow.payload_alg,
    kid: existingRow.payload_kid,
  });

  const payload = JSON.parse(plaintext) as StoredConditionPayload;

  const snapshot: HealthConditionHistorySnapshot = {
    name: payload.name,
    status: existingRow.status as HealthConditionStatus,
    diagnosedOnsetDate: payload.diagnosedOnsetDate,
    stageSeverity: payload.stageSeverity,
    treatingClinician: payload.treatingClinician,
    notes: payload.notes,
  };

  // Write history before soft-deleting
  await writeHealthHistoryEntry({
    accountId,
    lineId,
    itemKind: 'condition',
    itemId: conditionId,
    action: 'deleted',
    actorType: 'owner',
    actorUserId,
    payload: { itemKind: 'condition', action: 'deleted', snapshot },
  });

  const { error } = await adminClient
    .from('ultaura_health_conditions')
    .update({
      deleted_at: new Date().toISOString(),
      updated_by_user_id: actorUserId,
    })
    .eq('id', conditionId)
    .eq('line_id', lineId);

  if (error) {
    throw new Error(`Failed to delete condition: ${error.message}`);
  }
}

// Internal helper — stale-dismiss pending suggestions with matching type+name.
// normalized_name lives only in the encrypted payload, so we decrypt each pending
// suggestion to match by name. There are typically very few pending suggestions.
async function staleDismissSuggestions(
  adminClient: ReturnType<typeof getSupabaseServerActionClient>,
  accountId: string,
  lineId: string,
  suggestionType: 'condition' | 'medication',
  name: string,
): Promise<void> {
  const nameLower = name.trim().toLowerCase();

  const { data: suggestions } = await adminClient
    .from('ultaura_health_suggestions')
    .select(
      'id, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid',
    )
    .eq('line_id', lineId)
    .eq('suggestion_type', suggestionType)
    .eq('status', 'pending')
    .is('suppressed_at', null);

  if (!suggestions || suggestions.length === 0) return;

  const dek = await preloadLineDEK(accountId, lineId);
  const toStale: string[] = [];

  for (const suggestion of suggestions) {
    try {
      const plaintext = await decryptHealthPayload(accountId, lineId, {
        ciphertext: suggestion.payload_ciphertext,
        iv: suggestion.payload_iv,
        tag: suggestion.payload_tag,
        alg: suggestion.payload_alg,
        kid: suggestion.payload_kid,
      }, dek);
      const payload = JSON.parse(plaintext) as { normalizedName: string };
      if (payload.normalizedName?.trim().toLowerCase() === nameLower) {
        toStale.push(suggestion.id);
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
}
