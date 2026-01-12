import { getSupabaseClient } from '../utils/supabase.js';
import { logger } from '../server.js';

export interface CallPreview {
  id: string;
  topicType: string;
  topicKey: string;
  topicDisplay: string;
  segmentType?: string | null;
  segmentContext?: Record<string, unknown> | null;
}

const PREVIEW_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function getPendingCallPreview(lineId: string): Promise<CallPreview | null> {
  const supabase = getSupabaseClient();
  const cutoff = new Date(Date.now() - PREVIEW_TTL_MS).toISOString();

  const { data, error } = await supabase
    .from('ultaura_call_previews')
    .select('*')
    .eq('line_id', lineId)
    .eq('status', 'pending')
    .gt('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      logger.warn({ error, lineId }, 'Failed to fetch pending call preview');
    }
    return null;
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('ultaura_call_previews')
    .update({ status: 'used', used_at: now })
    .eq('id', data.id);

  if (updateError) {
    logger.warn({ error: updateError, lineId, previewId: data.id }, 'Failed to mark call preview used');
  }

  return {
    id: data.id,
    topicType: data.topic_type,
    topicKey: data.topic_key,
    topicDisplay: data.topic_display,
    segmentType: data.segment_type,
    segmentContext: data.segment_context,
  };
}
