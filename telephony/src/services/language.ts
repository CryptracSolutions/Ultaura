import { normalizeLanguageCode } from '@ultaura/prompts';
import { logger } from '../server.js';
import { getSupabaseClient } from '../utils/supabase.js';

export interface StartingLanguageResult {
  language: string;
  isAutoDetect: boolean;
}

export async function getStartingLanguageForLine(lineId: string): Promise<StartingLanguageResult> {
  try {
    const supabase = getSupabaseClient();

    const { data: line, error: lineError } = await supabase
      .from('ultaura_lines')
      .select('preferred_language_iso')
      .eq('id', lineId)
      .single();

    if (lineError) {
      logger.error({ error: lineError, lineId }, 'Failed to get line language preference');
      return { language: 'en', isAutoDetect: true };
    }

    if (line?.preferred_language_iso) {
      return {
        language: normalizeLanguageCode(line.preferred_language_iso),
        isAutoDetect: false,
      };
    }

    return { language: 'en', isAutoDetect: true };
  } catch (error) {
    logger.error({ error, lineId }, 'Exception getting starting language for line');
    return { language: 'en', isAutoDetect: true };
  }
}

export async function persistLanguageToLine(
  lineId: string,
  languageCode: string
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const normalizedCode = normalizeLanguageCode(languageCode);

    const { error } = await supabase
      .from('ultaura_lines')
      .update({
        preferred_language_bcp47: languageCode,
        preferred_language_iso: normalizedCode,
      })
      .eq('id', lineId);

    if (error) {
      logger.error({ error, lineId, languageCode }, 'Failed to persist language to line');
      return false;
    }

    logger.info({ lineId, languageCode: normalizedCode }, 'Language persisted to line');
    return true;
  } catch (error) {
    logger.error({ error, lineId, languageCode }, 'Exception persisting language to line');
    return false;
  }
}

export async function getLastDetectedLanguageForLine(lineId: string): Promise<string> {
  const result = await getStartingLanguageForLine(lineId);
  return result.language;
}
