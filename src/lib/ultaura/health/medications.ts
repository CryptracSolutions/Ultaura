import 'server-only';

import getSupabaseServerActionClient from '~/core/supabase/action-client';
import { encryptHealthPayload, decryptHealthPayload, preloadLineDEK } from './crypto';
import { mapHealthMedicationRow } from './types';
import { writeHealthHistoryEntry } from './history';
import { cancelHealthReminders } from './reminders';
import { type ByteaInput } from '../bytea';
import type {
  HealthMedication,
  HealthMedicationStatus,
  StoredMedicationPayload,
  HealthMedicationHistoryChange,
  ApproximateDate,
} from '@ultaura/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeTimesOfDay(times: string[]): string[] {
  const validTime = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const filtered = times.filter((t) => validTime.test(t));
  const unique = Array.from(new Set(filtered));
  unique.sort();
  return unique;
}

function isSimilarName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// Build a snapshot from payload + linked condition id for history
function buildMedicationSnapshot(
  payload: StoredMedicationPayload,
  linkedConditionId: string | null,
  status: HealthMedicationStatus,
) {
  return {
    name: payload.name,
    status,
    dosage: payload.dosage,
    frequency: payload.frequency,
    timesOfDay: payload.timesOfDay,
    startDate: payload.startDate,
    endDate: payload.endDate,
    prescribedBy: payload.prescribedBy,
    linkedConditionId,
    linkedReason: payload.linkedReason,
    notes: payload.notes,
  };
}

async function decryptMedicationRow(
  row: {
    payload_ciphertext: ByteaInput;
    payload_iv: ByteaInput;
    payload_tag: ByteaInput;
    payload_alg: string;
    payload_kid: string | null;
  },
  accountId: string,
  lineId: string,
  dek?: Buffer,
): Promise<StoredMedicationPayload> {
  const plaintext = await decryptHealthPayload(accountId, lineId, {
    ciphertext: row.payload_ciphertext,
    iv: row.payload_iv,
    tag: row.payload_tag,
    alg: row.payload_alg,
    kid: row.payload_kid,
  }, dek);
  return JSON.parse(plaintext) as StoredMedicationPayload;
}

// ---------------------------------------------------------------------------
// checkDuplicateMedication
// ---------------------------------------------------------------------------

export async function checkDuplicateMedication(
  lineId: string,
  name: string,
): Promise<{ isDuplicate: boolean; existingId: string | null }> {
  const adminClient = getSupabaseServerActionClient({ admin: true });

  const { data: line } = await adminClient
    .from('ultaura_lines')
    .select('id, account_id')
    .eq('id', lineId)
    .single();

  if (!line) return { isDuplicate: false, existingId: null };

  const { data: rows } = await adminClient
    .from('ultaura_health_medications')
    .select('id, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid')
    .eq('line_id', lineId)
    .is('deleted_at', null);

  if (!rows || rows.length === 0) return { isDuplicate: false, existingId: null };

  const dek = await preloadLineDEK(line.account_id, lineId);

  for (const row of rows) {
    try {
      const payload = await decryptMedicationRow(row, line.account_id, lineId, dek);
      if (isSimilarName(payload.name, name)) {
        return { isDuplicate: true, existingId: row.id };
      }
    } catch {
      // skip undecryptable rows
    }
  }

  return { isDuplicate: false, existingId: null };
}

// ---------------------------------------------------------------------------
// getMedications
// ---------------------------------------------------------------------------

export async function getMedications(
  lineId: string,
  filter?: { status?: HealthMedicationStatus },
  knownAccountId?: string,
): Promise<HealthMedication[]> {
  let accountId = knownAccountId;
  if (!accountId) {
    const userClient = getSupabaseServerActionClient();
    const { data: line } = await userClient
      .from('ultaura_lines')
      .select('id, account_id')
      .eq('id', lineId)
      .single();

    if (!line) return [];
    accountId = line.account_id;
  }

  const adminClient = getSupabaseServerActionClient({ admin: true });

  let query = adminClient
    .from('ultaura_health_medications')
    .select(
      'id, line_id, account_id, status, linked_condition_id, created_at, updated_at, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid',
    )
    .eq('line_id', lineId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (filter?.status) {
    query = query.eq('status', filter.status);
  }

  const { data: rows, error } = await query;

  if (error || !rows || rows.length === 0) return [];

  const dek = await preloadLineDEK(accountId, lineId);
  const medications: HealthMedication[] = [];

  for (const row of rows) {
    try {
      const payload = await decryptMedicationRow(row, accountId, lineId, dek);
      medications.push(mapHealthMedicationRow(row, payload));
    } catch {
      // skip undecryptable rows
    }
  }

  return medications;
}

// ---------------------------------------------------------------------------
// createMedication
// ---------------------------------------------------------------------------

export interface CreateMedicationInput {
  name: string;
  standardizedId: { system: string; code: string } | null;
  status: HealthMedicationStatus;
  dosage: string | null;
  frequency: string | null;
  timesOfDay: string[];
  prescribedBy: string | null;
  startDate: ApproximateDate | null;
  endDate: ApproximateDate | null;
  linkedConditionId: string | null;
  linkedReason: string | null;
  notes: string | null;
}

export async function createMedication(
  accountId: string,
  lineId: string,
  actorUserId: string,
  input: CreateMedicationInput,
): Promise<{ success: true; medication: HealthMedication } | { success: false; code: string; message: string }> {
  if (!actorUserId) {
    return { success: false, code: 'actor_required', message: 'Actor user ID is required' };
  }

  const name = input.name.trim();
  if (!name) {
    return { success: false, code: 'invalid_input', message: 'Medication name is required' };
  }

  const timesOfDay = normalizeTimesOfDay(input.timesOfDay);
  if (timesOfDay.length > 8) {
    return { success: false, code: 'invalid_input', message: 'Maximum 8 times of day allowed' };
  }

  if (input.linkedReason && input.linkedReason.length > 200) {
    return { success: false, code: 'invalid_input', message: 'Linked reason must be 200 characters or fewer' };
  }

  if (input.dosage && input.dosage.length > 120) {
    return { success: false, code: 'invalid_input', message: 'Dosage must be 120 characters or fewer' };
  }

  if (input.frequency && input.frequency.length > 120) {
    return { success: false, code: 'invalid_input', message: 'Frequency must be 120 characters or fewer' };
  }

  if (input.prescribedBy && input.prescribedBy.length > 160) {
    return { success: false, code: 'invalid_input', message: 'Prescribed by must be 160 characters or fewer' };
  }

  if (input.notes && input.notes.length > 2000) {
    return { success: false, code: 'invalid_input', message: 'Notes must be 2000 characters or fewer' };
  }

  const adminClient = getSupabaseServerActionClient({ admin: true });

  // Validate linked condition belongs to same line
  if (input.linkedConditionId) {
    const { data: condition } = await adminClient
      .from('ultaura_health_conditions')
      .select('id, line_id')
      .eq('id', input.linkedConditionId)
      .is('deleted_at', null)
      .single();

    if (!condition || condition.line_id !== lineId) {
      return { success: false, code: 'invalid_linked_condition', message: 'Linked condition not found on this line' };
    }
  }

  const payload: StoredMedicationPayload = {
    name,
    standardizedId: input.standardizedId,
    dosage: input.dosage ?? null,
    frequency: input.frequency ?? null,
    timesOfDay,
    prescribedBy: input.prescribedBy ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    linkedReason: input.linkedReason ?? null,
    notes: input.notes ?? null,
  };

  const encrypted = await encryptHealthPayload(accountId, lineId, JSON.stringify(payload));

  const { data: row, error } = await adminClient
    .from('ultaura_health_medications')
    .insert({
      account_id: accountId,
      line_id: lineId,
      linked_condition_id: input.linkedConditionId ?? null,
      status: input.status,
      source: 'owner_manual',
      created_by_user_id: actorUserId,
      updated_by_user_id: actorUserId,
      payload_ciphertext: encrypted.ciphertext,
      payload_iv: encrypted.iv,
      payload_tag: encrypted.tag,
      payload_alg: encrypted.alg,
      payload_kid: encrypted.kid,
    })
    .select('id, line_id, account_id, status, linked_condition_id, created_at, updated_at')
    .single();

  if (error || !row) {
    return { success: false, code: 'insert_failed', message: error?.message ?? 'Failed to create medication' };
  }

  await writeHealthHistoryEntry({
    accountId,
    lineId,
    itemKind: 'medication',
    itemId: row.id,
    action: 'created',
    actorType: 'owner',
    actorUserId,
    payload: {
      itemKind: 'medication',
      action: 'created',
      snapshot: buildMedicationSnapshot(payload, input.linkedConditionId ?? null, input.status),
    },
  });

  const medication = mapHealthMedicationRow(row, payload);
  return { success: true, medication };
}

// ---------------------------------------------------------------------------
// editMedication
// ---------------------------------------------------------------------------

export interface EditMedicationInput {
  name?: string;
  standardizedId?: { system: string; code: string } | null;
  status?: HealthMedicationStatus;
  dosage?: string | null;
  frequency?: string | null;
  timesOfDay?: string[];
  prescribedBy?: string | null;
  startDate?: ApproximateDate | null;
  endDate?: ApproximateDate | null;
  linkedConditionId?: string | null;
  linkedReason?: string | null;
  notes?: string | null;
}

export async function editMedication(
  medicationId: string,
  lineId: string,
  accountId: string,
  actorUserId: string,
  input: EditMedicationInput,
): Promise<{ success: true; medication: HealthMedication } | { success: false; code: string; message: string }> {
  if (!actorUserId) {
    return { success: false, code: 'actor_required', message: 'Actor user ID is required' };
  }

  const adminClient = getSupabaseServerActionClient({ admin: true });

  const { data: existing, error: fetchError } = await adminClient
    .from('ultaura_health_medications')
    .select(
      'id, line_id, account_id, status, linked_condition_id, created_at, updated_at, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid',
    )
    .eq('id', medicationId)
    .eq('line_id', lineId)
    .is('deleted_at', null)
    .single();

  if (fetchError || !existing) {
    return { success: false, code: 'not_found', message: 'Medication not found' };
  }

  let existingPayload: StoredMedicationPayload;
  try {
    existingPayload = await decryptMedicationRow(existing, accountId, lineId);
  } catch {
    return { success: false, code: 'decrypt_failed', message: 'Failed to read existing medication' };
  }

  // Validate new linked condition if provided
  const newLinkedConditionId =
    'linkedConditionId' in input ? input.linkedConditionId : existing.linked_condition_id;

  if (newLinkedConditionId) {
    const { data: condition } = await adminClient
      .from('ultaura_health_conditions')
      .select('id, line_id')
      .eq('id', newLinkedConditionId)
      .is('deleted_at', null)
      .single();

    if (!condition || condition.line_id !== lineId) {
      return { success: false, code: 'invalid_linked_condition', message: 'Linked condition not found on this line' };
    }
  }

  const newName = input.name !== undefined ? input.name.trim() : existingPayload.name;
  if (!newName) {
    return { success: false, code: 'invalid_input', message: 'Medication name is required' };
  }

  const newTimesOfDay =
    input.timesOfDay !== undefined
      ? normalizeTimesOfDay(input.timesOfDay)
      : existingPayload.timesOfDay;

  if (newTimesOfDay.length > 8) {
    return { success: false, code: 'invalid_input', message: 'Maximum 8 times of day allowed' };
  }

  const newLinkedReason =
    input.linkedReason !== undefined ? input.linkedReason : existingPayload.linkedReason;
  if (newLinkedReason && newLinkedReason.length > 200) {
    return { success: false, code: 'invalid_input', message: 'Linked reason must be 200 characters or fewer' };
  }

  const newDosage = input.dosage !== undefined ? input.dosage : existingPayload.dosage;
  if (newDosage && newDosage.length > 120) {
    return { success: false, code: 'invalid_input', message: 'Dosage must be 120 characters or fewer' };
  }

  const newFrequency = input.frequency !== undefined ? input.frequency : existingPayload.frequency;
  if (newFrequency && newFrequency.length > 120) {
    return { success: false, code: 'invalid_input', message: 'Frequency must be 120 characters or fewer' };
  }

  const newPrescribedBy =
    input.prescribedBy !== undefined ? input.prescribedBy : existingPayload.prescribedBy;
  if (newPrescribedBy && newPrescribedBy.length > 160) {
    return { success: false, code: 'invalid_input', message: 'Prescribed by must be 160 characters or fewer' };
  }

  const newNotes = input.notes !== undefined ? input.notes : existingPayload.notes;
  if (newNotes && newNotes.length > 2000) {
    return { success: false, code: 'invalid_input', message: 'Notes must be 2000 characters or fewer' };
  }

  const newStatus: HealthMedicationStatus =
    input.status !== undefined ? input.status : (existing.status as HealthMedicationStatus);

  const newStartDate = input.startDate !== undefined ? input.startDate : existingPayload.startDate;
  const newEndDate = input.endDate !== undefined ? input.endDate : existingPayload.endDate;
  const newStandardizedId =
    input.standardizedId !== undefined ? input.standardizedId : existingPayload.standardizedId;

  const updatedPayload: StoredMedicationPayload = {
    name: newName,
    standardizedId: newStandardizedId,
    dosage: newDosage,
    frequency: newFrequency,
    timesOfDay: newTimesOfDay,
    prescribedBy: newPrescribedBy,
    startDate: newStartDate,
    endDate: newEndDate,
    linkedReason: newLinkedReason,
    notes: newNotes,
  };

  // Compute field-level changes
  const changes: HealthMedicationHistoryChange[] = [];

  if (existingPayload.name !== updatedPayload.name) {
    changes.push({ field: 'name', before: existingPayload.name, after: updatedPayload.name });
  }
  if (existing.status !== newStatus) {
    changes.push({ field: 'status', before: existing.status as HealthMedicationStatus, after: newStatus });
  }
  if (existingPayload.dosage !== updatedPayload.dosage) {
    changes.push({ field: 'dosage', before: existingPayload.dosage, after: updatedPayload.dosage });
  }
  if (existingPayload.frequency !== updatedPayload.frequency) {
    changes.push({ field: 'frequency', before: existingPayload.frequency, after: updatedPayload.frequency });
  }
  if (JSON.stringify(existingPayload.timesOfDay) !== JSON.stringify(updatedPayload.timesOfDay)) {
    changes.push({ field: 'timesOfDay', before: existingPayload.timesOfDay, after: updatedPayload.timesOfDay });
  }
  if (JSON.stringify(existingPayload.startDate) !== JSON.stringify(updatedPayload.startDate)) {
    changes.push({ field: 'startDate', before: existingPayload.startDate, after: updatedPayload.startDate });
  }
  if (JSON.stringify(existingPayload.endDate) !== JSON.stringify(updatedPayload.endDate)) {
    changes.push({ field: 'endDate', before: existingPayload.endDate, after: updatedPayload.endDate });
  }
  if (existingPayload.prescribedBy !== updatedPayload.prescribedBy) {
    changes.push({ field: 'prescribedBy', before: existingPayload.prescribedBy, after: updatedPayload.prescribedBy });
  }
  if (existing.linked_condition_id !== newLinkedConditionId) {
    changes.push({ field: 'linkedConditionId', before: existing.linked_condition_id ?? null, after: newLinkedConditionId ?? null });
  }
  if (existingPayload.linkedReason !== updatedPayload.linkedReason) {
    changes.push({ field: 'linkedReason', before: existingPayload.linkedReason, after: updatedPayload.linkedReason });
  }
  if (existingPayload.notes !== updatedPayload.notes) {
    changes.push({ field: 'notes', before: existingPayload.notes, after: updatedPayload.notes });
  }

  const encrypted = await encryptHealthPayload(accountId, lineId, JSON.stringify(updatedPayload));

  const { data: updatedRow, error: updateError } = await adminClient
    .from('ultaura_health_medications')
    .update({
      linked_condition_id: newLinkedConditionId ?? null,
      status: newStatus,
      updated_by_user_id: actorUserId,
      payload_ciphertext: encrypted.ciphertext,
      payload_iv: encrypted.iv,
      payload_tag: encrypted.tag,
      payload_alg: encrypted.alg,
      payload_kid: encrypted.kid,
    })
    .eq('id', medicationId)
    .eq('line_id', lineId)
    .select('id, line_id, account_id, status, linked_condition_id, created_at, updated_at')
    .single();

  if (updateError || !updatedRow) {
    return { success: false, code: 'update_failed', message: updateError?.message ?? 'Failed to update medication' };
  }

  // Stale-dismiss pending suggestions matching this medication name
  await staleDismissMedicationSuggestions(adminClient, lineId, accountId, newName);

  if (changes.length > 0) {
    await writeHealthHistoryEntry({
      accountId,
      lineId,
      itemKind: 'medication',
      itemId: medicationId,
      action: 'edited',
      actorType: 'owner',
      actorUserId,
      payload: {
        itemKind: 'medication',
        action: 'edited',
        summaryLabel: `Edited ${newName}`,
        changes,
      },
    });
  }

  const medication = mapHealthMedicationRow(updatedRow, updatedPayload);
  return { success: true, medication };
}

// ---------------------------------------------------------------------------
// changeMedicationStatus
// ---------------------------------------------------------------------------

export async function changeMedicationStatus(
  medicationId: string,
  lineId: string,
  accountId: string,
  actorUserId: string,
  newStatus: HealthMedicationStatus,
): Promise<{ success: true } | { success: false; code: string; message: string }> {
  if (!actorUserId) {
    return { success: false, code: 'actor_required', message: 'Actor user ID is required' };
  }

  const adminClient = getSupabaseServerActionClient({ admin: true });

  const { data: existing, error: fetchError } = await adminClient
    .from('ultaura_health_medications')
    .select('id, status, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid, linked_condition_id')
    .eq('id', medicationId)
    .eq('line_id', lineId)
    .is('deleted_at', null)
    .single();

  if (fetchError || !existing) {
    return { success: false, code: 'not_found', message: 'Medication not found' };
  }

  let existingPayload: StoredMedicationPayload;
  try {
    existingPayload = await decryptMedicationRow(existing, accountId, lineId);
  } catch {
    return { success: false, code: 'decrypt_failed', message: 'Failed to read existing medication' };
  }

  const { error } = await adminClient
    .from('ultaura_health_medications')
    .update({ status: newStatus, updated_by_user_id: actorUserId })
    .eq('id', medicationId)
    .eq('line_id', lineId);

  if (error) {
    return { success: false, code: 'update_failed', message: error.message };
  }

  await writeHealthHistoryEntry({
    accountId,
    lineId,
    itemKind: 'medication',
    itemId: medicationId,
    action: 'edited',
    actorType: 'owner',
    actorUserId,
    payload: {
      itemKind: 'medication',
      action: 'edited',
      summaryLabel: `Status changed to ${newStatus}`,
      changes: [
        {
          field: 'status',
          before: existing.status as HealthMedicationStatus,
          after: newStatus,
        },
      ],
    },
  });

  if (newStatus === 'discontinued') {
    await cancelHealthReminders(medicationId, lineId, accountId, 'discontinued');
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// deleteMedication
// ---------------------------------------------------------------------------

export async function deleteMedication(
  medicationId: string,
  lineId: string,
  accountId: string,
  actorUserId: string,
): Promise<{ success: true } | { success: false; code: string; message: string }> {
  if (!actorUserId) {
    return { success: false, code: 'actor_required', message: 'Actor user ID is required' };
  }

  const adminClient = getSupabaseServerActionClient({ admin: true });

  const { data: existing, error: fetchError } = await adminClient
    .from('ultaura_health_medications')
    .select('id, status, linked_condition_id, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid')
    .eq('id', medicationId)
    .eq('line_id', lineId)
    .is('deleted_at', null)
    .single();

  if (fetchError || !existing) {
    return { success: false, code: 'not_found', message: 'Medication not found' };
  }

  let existingPayload: StoredMedicationPayload;
  try {
    existingPayload = await decryptMedicationRow(existing, accountId, lineId);
  } catch {
    return { success: false, code: 'decrypt_failed', message: 'Failed to read existing medication' };
  }

  const { error } = await adminClient
    .from('ultaura_health_medications')
    .update({ deleted_at: new Date().toISOString(), updated_by_user_id: actorUserId })
    .eq('id', medicationId)
    .eq('line_id', lineId);

  if (error) {
    return { success: false, code: 'delete_failed', message: error.message };
  }

  await writeHealthHistoryEntry({
    accountId,
    lineId,
    itemKind: 'medication',
    itemId: medicationId,
    action: 'deleted',
    actorType: 'owner',
    actorUserId,
    payload: {
      itemKind: 'medication',
      action: 'deleted',
      snapshot: buildMedicationSnapshot(
        existingPayload,
        existing.linked_condition_id ?? null,
        existing.status as HealthMedicationStatus,
      ),
    },
  });

  await cancelHealthReminders(medicationId, lineId, accountId, 'deleted');

  return { success: true };
}

// ---------------------------------------------------------------------------
// Stale-dismiss suggestion helper
// ---------------------------------------------------------------------------

async function staleDismissMedicationSuggestions(
  adminClient: ReturnType<typeof getSupabaseServerActionClient>,
  lineId: string,
  accountId: string,
  medicationName: string,
): Promise<void> {
  // Fetch pending medication suggestions for the line
  const { data: suggestions } = await adminClient
    .from('ultaura_health_suggestions')
    .select('id, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid')
    .eq('line_id', lineId)
    .eq('suggestion_type', 'medication')
    .eq('status', 'pending');

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
      if (payload.normalizedName && isSimilarName(payload.normalizedName, medicationName)) {
        toStale.push(s.id);
      }
    } catch {
      // skip
    }
  }

  if (toStale.length === 0) return;

  await adminClient
    .from('ultaura_health_suggestions')
    .update({ status: 'dismissed', dismiss_reason: 'system_stale' })
    .in('id', toStale);
}
