import 'server-only';

import getSupabaseServerActionClient from '~/core/supabase/action-client';
import getLogger from '~/core/logger';
import type { TelephonyPendingHealthNotice } from '@ultaura/types';

const logger = getLogger();

export async function getPendingNoticesForLine(
  lineId: string,
): Promise<TelephonyPendingHealthNotice[]> {
  const client = getSupabaseServerActionClient({ admin: true });

  const { data, error } = await client
    .from('ultaura_health_call_notices')
    .select('id, notice_type, payload_ciphertext, payload_iv, payload_tag, status')
    .eq('line_id', lineId)
    .eq('status', 'pending')
    .is('suppressed_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    logger.error({ error, lineId }, 'Failed to get pending health notices');
    return [];
  }

  if (!data || data.length === 0) return [];

  // For v1, full notice decryption is deferred to future phases.
  // No notices will have been created yet, so return empty.
  return [];
}

export async function markNoticeDelivered(
  noticeId: string,
  lineId: string,
  callSessionId: string,
): Promise<boolean> {
  const client = getSupabaseServerActionClient({ admin: true });

  const { error } = await client
    .from('ultaura_health_call_notices')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      delivered_call_session_id: callSessionId,
    })
    .eq('id', noticeId)
    .eq('line_id', lineId);

  if (error) {
    logger.error({ error, noticeId, lineId }, 'Failed to mark notice delivered');
    return false;
  }

  return true;
}
