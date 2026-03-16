import 'server-only';

import getSupabaseServerActionClient from '~/core/supabase/action-client';
import { encryptHealthPayload, decryptHealthPayload } from './crypto';
import { writeHealthHistoryEntry } from './history';
import { mapHealthObservationRow } from './types';
import { observationFormSchema } from '@ultaura/schemas';
import type { ObservationFormInput } from '@ultaura/schemas';
import type {
  HealthObservation,
  StoredObservationPayload,
  HealthObservationHistorySnapshot,
  HealthObservationHistoryChange,
} from '@ultaura/types';
import { TELEPHONY } from '../constants';

export async function getObservations(lineId: string): Promise<HealthObservation[]> {
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

  const { data: rows, error } = await adminClient
    .from('ultaura_health_observations')
    .select(
      'id, line_id, account_id, created_at, updated_at, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid',
    )
    .eq('line_id', lineId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch observations: ${error.message}`);
  }

  if (!rows || rows.length === 0) return [];

  const observations: HealthObservation[] = [];

  for (const row of rows) {
    try {
      const plaintext = await decryptHealthPayload(accountId, lineId, {
        ciphertext: row.payload_ciphertext,
        iv: row.payload_iv,
        tag: row.payload_tag,
        alg: row.payload_alg,
        kid: row.payload_kid,
      });

      const payload = JSON.parse(plaintext) as StoredObservationPayload;
      observations.push(mapHealthObservationRow(row, payload));
    } catch {
      // Skip observations that fail to decrypt
    }
  }

  return observations;
}

export async function createObservation(
  accountId: string,
  lineId: string,
  actorUserId: string,
  input: ObservationFormInput,
): Promise<HealthObservation> {
  const parsed = observationFormSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid observation input: ${parsed.error.message}`);
  }

  const data = parsed.data;
  const adminClient = getSupabaseServerActionClient({ admin: true });

  // Resolve observedDate: use provided value or default to today in line timezone
  let observedDate = data.observedDate ?? null;
  if (!observedDate) {
    const { data: line } = await adminClient
      .from('ultaura_lines')
      .select('timezone')
      .eq('id', lineId)
      .single();

    const tz = (line?.timezone as string | null) || TELEPHONY.DEFAULT_TIMEZONE;
    observedDate = new Date().toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
  }

  const payload: StoredObservationPayload = {
    text: data.text,
    category: data.category ?? null,
    observedDate,
    concernLevel: data.concernLevel ?? null,
  };

  const encrypted = await encryptHealthPayload(accountId, lineId, JSON.stringify(payload));

  const { data: row, error } = await adminClient
    .from('ultaura_health_observations')
    .insert({
      account_id: accountId,
      line_id: lineId,
      created_by_user_id: actorUserId,
      updated_by_user_id: actorUserId,
      payload_ciphertext: encrypted.ciphertext,
      payload_iv: encrypted.iv,
      payload_tag: encrypted.tag,
      payload_alg: encrypted.alg,
      payload_kid: encrypted.kid,
    })
    .select('id, line_id, account_id, created_at, updated_at')
    .single();

  if (error || !row) {
    throw new Error(`Failed to create observation: ${error?.message}`);
  }

  const snapshot: HealthObservationHistorySnapshot = {
    text: payload.text,
    category: payload.category,
    concernLevel: payload.concernLevel,
    observedDate: payload.observedDate,
  };

  await writeHealthHistoryEntry({
    accountId,
    lineId,
    itemKind: 'observation',
    itemId: row.id,
    action: 'created',
    actorType: 'owner',
    actorUserId,
    payload: { itemKind: 'observation', action: 'created', snapshot },
  });

  return mapHealthObservationRow(row, payload);
}

export async function editObservation(
  observationId: string,
  lineId: string,
  accountId: string,
  actorUserId: string,
  input: ObservationFormInput,
): Promise<HealthObservation> {
  const parsed = observationFormSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid observation input: ${parsed.error.message}`);
  }

  const data = parsed.data;
  const adminClient = getSupabaseServerActionClient({ admin: true });

  const { data: existingRow, error: fetchError } = await adminClient
    .from('ultaura_health_observations')
    .select(
      'id, line_id, account_id, created_at, updated_at, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid',
    )
    .eq('id', observationId)
    .eq('line_id', lineId)
    .is('deleted_at', null)
    .single();

  if (fetchError || !existingRow) {
    throw new Error('Observation not found');
  }

  const existingPlaintext = await decryptHealthPayload(accountId, lineId, {
    ciphertext: existingRow.payload_ciphertext,
    iv: existingRow.payload_iv,
    tag: existingRow.payload_tag,
    alg: existingRow.payload_alg,
    kid: existingRow.payload_kid,
  });

  const existingPayload = JSON.parse(existingPlaintext) as StoredObservationPayload;

  const newPayload: StoredObservationPayload = {
    text: data.text,
    category: data.category ?? null,
    observedDate: data.observedDate ?? existingPayload.observedDate,
    concernLevel: data.concernLevel ?? null,
  };

  // Compute field-level changes
  const changes: HealthObservationHistoryChange[] = [];

  if (existingPayload.text !== newPayload.text) {
    changes.push({ field: 'text', before: existingPayload.text, after: newPayload.text });
  }
  if ((existingPayload.category ?? null) !== (newPayload.category ?? null)) {
    changes.push({ field: 'category', before: existingPayload.category, after: newPayload.category });
  }
  if ((existingPayload.concernLevel ?? null) !== (newPayload.concernLevel ?? null)) {
    changes.push({ field: 'concernLevel', before: existingPayload.concernLevel, after: newPayload.concernLevel });
  }
  if ((existingPayload.observedDate ?? null) !== (newPayload.observedDate ?? null)) {
    changes.push({ field: 'observedDate', before: existingPayload.observedDate, after: newPayload.observedDate });
  }

  const encrypted = await encryptHealthPayload(accountId, lineId, JSON.stringify(newPayload));

  const { data: updatedRow, error: updateError } = await adminClient
    .from('ultaura_health_observations')
    .update({
      updated_by_user_id: actorUserId,
      updated_at: new Date().toISOString(),
      payload_ciphertext: encrypted.ciphertext,
      payload_iv: encrypted.iv,
      payload_tag: encrypted.tag,
      payload_alg: encrypted.alg,
      payload_kid: encrypted.kid,
    })
    .eq('id', observationId)
    .eq('line_id', lineId)
    .select('id, line_id, account_id, created_at, updated_at')
    .single();

  if (updateError || !updatedRow) {
    throw new Error(`Failed to update observation: ${updateError?.message}`);
  }

  if (changes.length > 0) {
    await writeHealthHistoryEntry({
      accountId,
      lineId,
      itemKind: 'observation',
      itemId: observationId,
      action: 'edited',
      actorType: 'owner',
      actorUserId,
      payload: {
        itemKind: 'observation',
        action: 'edited',
        summaryLabel: `Updated observation`,
        changes,
      },
    });
  }

  return mapHealthObservationRow(updatedRow, newPayload);
}

export async function deleteObservation(
  observationId: string,
  lineId: string,
  accountId: string,
  actorUserId: string,
): Promise<void> {
  const adminClient = getSupabaseServerActionClient({ admin: true });

  const { data: existingRow, error: fetchError } = await adminClient
    .from('ultaura_health_observations')
    .select(
      'id, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid',
    )
    .eq('id', observationId)
    .eq('line_id', lineId)
    .is('deleted_at', null)
    .single();

  if (fetchError || !existingRow) {
    throw new Error('Observation not found');
  }

  const plaintext = await decryptHealthPayload(accountId, lineId, {
    ciphertext: existingRow.payload_ciphertext,
    iv: existingRow.payload_iv,
    tag: existingRow.payload_tag,
    alg: existingRow.payload_alg,
    kid: existingRow.payload_kid,
  });

  const payload = JSON.parse(plaintext) as StoredObservationPayload;

  const snapshot: HealthObservationHistorySnapshot = {
    text: payload.text,
    category: payload.category,
    concernLevel: payload.concernLevel,
    observedDate: payload.observedDate,
  };

  // Write history before soft-deleting
  await writeHealthHistoryEntry({
    accountId,
    lineId,
    itemKind: 'observation',
    itemId: observationId,
    action: 'deleted',
    actorType: 'owner',
    actorUserId,
    payload: { itemKind: 'observation', action: 'deleted', snapshot },
  });

  const { error } = await adminClient
    .from('ultaura_health_observations')
    .update({
      deleted_at: new Date().toISOString(),
      updated_by_user_id: actorUserId,
    })
    .eq('id', observationId)
    .eq('line_id', lineId);

  if (error) {
    throw new Error(`Failed to delete observation: ${error.message}`);
  }
}
