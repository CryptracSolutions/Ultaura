import 'server-only';

import getSupabaseServerActionClient from '~/core/supabase/action-client';
import { encryptHealthPayload, decryptHealthPayload, preloadLineDEK } from './crypto';
import type { HealthHistoryPayload } from '@ultaura/types';

type ItemKind = 'condition' | 'medication' | 'document' | 'observation' | 'suggestion';
type ItemAction =
  | 'created'
  | 'edited'
  | 'deleted'
  | 'suggestion_approved'
  | 'suggestion_dismissed'
  | 'system_stale_dismissed';
type ActorType = 'owner' | 'system' | 'telephony';

interface WriteHealthHistoryEntryParams {
  accountId: string;
  lineId: string;
  itemKind: ItemKind;
  itemId: string | null;
  action: ItemAction;
  actorType: ActorType;
  actorUserId: string | null;
  payload: HealthHistoryPayload;
}

export async function writeHealthHistoryEntry(
  params: WriteHealthHistoryEntryParams,
): Promise<void> {
  const { accountId, lineId, itemKind, itemId, action, actorType, actorUserId, payload } = params;

  const adminClient = getSupabaseServerActionClient({ admin: true });
  const plaintext = JSON.stringify(payload);
  const encrypted = await encryptHealthPayload(accountId, lineId, plaintext);

  const { error } = await adminClient.from('ultaura_health_item_history').insert({
    account_id: accountId,
    line_id: lineId,
    item_kind: itemKind,
    item_id: itemId,
    action,
    actor_type: actorType,
    actor_user_id: actorUserId,
    payload_ciphertext: encrypted.ciphertext,
    payload_iv: encrypted.iv,
    payload_tag: encrypted.tag,
    payload_alg: encrypted.alg,
    payload_kid: encrypted.kid,
  });

  if (error) {
    throw new Error(`Failed to write health history entry: ${error.message}`);
  }
}

export interface HealthHistoryEntry {
  id: string;
  lineId: string;
  itemKind: ItemKind;
  itemId: string | null;
  action: ItemAction;
  actorType: ActorType;
  actorUserId: string | null;
  createdAt: string;
  payload: HealthHistoryPayload;
}

export async function getHealthItemHistory(
  lineId: string,
  itemKind?: ItemKind,
  itemId?: string,
  limit = 50,
  knownAccountId?: string,
): Promise<HealthHistoryEntry[]> {
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
    .from('ultaura_health_item_history')
    .select(
      'id, line_id, item_kind, item_id, action, actor_type, actor_user_id, created_at, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid',
    )
    .eq('line_id', lineId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (itemKind) {
    query = query.eq('item_kind', itemKind);
  }
  if (itemId) {
    query = query.eq('item_id', itemId);
  }

  const { data: rows, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch health history: ${error.message}`);
  }

  if (!rows || rows.length === 0) return [];

  const dek = await preloadLineDEK(accountId, lineId);
  const entries: HealthHistoryEntry[] = [];

  for (const row of rows) {
    try {
      const plaintext = await decryptHealthPayload(accountId, lineId, {
        ciphertext: row.payload_ciphertext,
        iv: row.payload_iv,
        tag: row.payload_tag,
        alg: row.payload_alg,
        kid: row.payload_kid,
      }, dek);

      const payload = JSON.parse(plaintext) as HealthHistoryPayload;

      entries.push({
        id: row.id,
        lineId: row.line_id,
        itemKind: row.item_kind as ItemKind,
        itemId: row.item_id,
        action: row.action as ItemAction,
        actorType: row.actor_type as ActorType,
        actorUserId: row.actor_user_id,
        createdAt: row.created_at,
        payload,
      });
    } catch {
      // Skip entries that fail to decrypt — log in production
    }
  }

  return entries;
}
