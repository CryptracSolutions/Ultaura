import 'server-only';

import getLogger from '~/core/logger';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import type { HealthConsentHistoryPayload, HealthConsentStatus } from '@ultaura/types';
import { encryptHealthPayload, decryptHealthPayload } from './crypto';

const logger = getLogger();

type WriteConsentHistoryParams = {
  accountId: string;
  lineId: string;
  eventType: 'owner_request' | 'spoken_prompt' | 'spoken_decision' | 'self_service_decision';
  resultingStatus?: HealthConsentStatus;
  actorUserId?: string | null;
  callSessionId?: string | null;
  payload: HealthConsentHistoryPayload;
};

export async function writeHealthConsentHistoryEntry(
  params: WriteConsentHistoryParams
): Promise<void> {
  const adminClient = getSupabaseServerActionClient({ admin: true });

  try {
    const encrypted = await encryptHealthPayload(
      params.accountId,
      params.lineId,
      JSON.stringify(params.payload)
    );

    const { error } = await adminClient.from('ultaura_health_consent_history')
      .insert({
        account_id: params.accountId,
        line_id: params.lineId,
        event_type: params.eventType,
        resulting_status: params.resultingStatus ?? null,
        actor_user_id: params.actorUserId ?? null,
        call_session_id: params.callSessionId ?? null,
        payload_ciphertext: encrypted.ciphertext,
        payload_iv: encrypted.iv,
        payload_tag: encrypted.tag,
        payload_alg: encrypted.alg,
        payload_kid: encrypted.kid,
      });

    if (error) {
      logger.error({ error, lineId: params.lineId }, 'Failed to write health consent history entry');
    }
  } catch (err) {
    logger.error({ err, lineId: params.lineId }, 'Failed to encrypt and write health consent history entry');
  }
}

type ConsentHistoryEntry = {
  id: string;
  eventType: string;
  resultingStatus: HealthConsentStatus | null;
  actorUserId: string | null;
  callSessionId: string | null;
  createdAt: string;
  payload: HealthConsentHistoryPayload | null;
  decryptFailed: boolean;
};

export async function getHealthConsentHistory(
  lineId: string,
  limit = 20
): Promise<ConsentHistoryEntry[]> {
  const userClient = getSupabaseServerActionClient();

  const { data: rows, error } = await userClient.from('ultaura_health_consent_history')
    .select('*')
    .eq('line_id', lineId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error, lineId }, 'Failed to load health consent history');
    return [];
  }

  if (!rows?.length) {
    return [];
  }

  const accountId = rows[0].account_id;

  return Promise.all(
    rows.map(async (row: any) => {
      try {
        const payloadJson = await decryptHealthPayload(
          accountId,
          lineId,
          {
            ciphertext: row.payload_ciphertext,
            iv: row.payload_iv,
            tag: row.payload_tag,
            alg: row.payload_alg,
            kid: row.payload_kid,
          }
        );

        return {
          id: row.id,
          eventType: row.event_type,
          resultingStatus: row.resulting_status as HealthConsentStatus | null,
          actorUserId: row.actor_user_id,
          callSessionId: row.call_session_id,
          createdAt: row.created_at,
          payload: JSON.parse(payloadJson) as HealthConsentHistoryPayload,
          decryptFailed: false,
        };
      } catch {
        return {
          id: row.id,
          eventType: row.event_type,
          resultingStatus: row.resulting_status as HealthConsentStatus | null,
          actorUserId: row.actor_user_id,
          callSessionId: row.call_session_id,
          createdAt: row.created_at,
          payload: null,
          decryptFailed: true,
        };
      }
    })
  );
}
