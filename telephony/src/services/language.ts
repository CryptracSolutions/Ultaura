import { normalizeLanguageCode } from '@ultaura/prompts';
import { logger } from '../server.js';
import { getSupabaseClient } from '../utils/supabase.js';

export async function getLastDetectedLanguageForLine(lineId: string): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('ultaura_call_sessions')
      .select('language_detected')
      .eq('line_id', lineId)
      .eq('status', 'completed')
      .not('language_detected', 'is', null)
      .order('ended_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      logger.error({ error, lineId }, 'Failed to get last detected language');
      return 'en';
    }

    if (!data?.language_detected) {
      return 'en';
    }

    return normalizeLanguageCode(data.language_detected);
  } catch (error) {
    logger.error({ error, lineId }, 'Exception getting last detected language');
    return 'en';
  }
}
