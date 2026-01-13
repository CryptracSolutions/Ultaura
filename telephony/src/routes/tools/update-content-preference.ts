import { Router, Request, Response } from 'express';
import {
  UpdateContentPreferenceInputSchema,
  type UpdateContentPreferenceInput,
} from '@ultaura/schemas/telephony';
import { logger } from '../../server.js';
import {
  getCallSession,
  incrementToolInvocations,
  recordCallEvent,
} from '../../services/call-session.js';
import { getSupabaseClient } from '../../utils/supabase.js';

const PREFERENCE_COLUMNS: Record<string, string> = {
  trivia: 'trivia_preference',
  story: 'story_preference',
  memory_lane: 'memory_lane_preference',
  brain_games: 'brain_games_preference',
};

const SPECIFIC_UPDATE_KEYS = new Set([
  'favorite_trivia_domains',
  'avoided_trivia_domains',
  'trivia_difficulty',
  'favorite_story_genres',
  'avoided_story_themes',
  'preferred_story_length',
  'favorite_eras',
  'favorite_memory_topics',
  'best_segment_time_of_call',
]);

export const updateContentPreferenceRouter = Router();

updateContentPreferenceRouter.post('/', async (req: Request, res: Response) => {
  try {
    const rawBody = req.body as Partial<UpdateContentPreferenceInput>;
    const parsed = UpdateContentPreferenceInputSchema.safeParse(rawBody);

    if (!parsed.success) {
      const callSessionId =
        typeof rawBody.callSessionId === 'string' ? rawBody.callSessionId : null;
      if (callSessionId) {
        await recordCallEvent(callSessionId, 'tool_call', {
          tool: 'update_content_preference',
          success: false,
          errorCode: 'validation_error',
        }, { skipDebugLog: true });
      }

      res.status(400).json({ success: false, error: 'Invalid input' });
      return;
    }

    const {
      callSessionId,
      lineId,
      content_type,
      preference_change,
      specific_update,
    } = parsed.data;

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ success: false, error: 'Call session not found' });
      return;
    }

    if (session.line_id !== lineId) {
      res.status(403).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const preferenceColumn = PREFERENCE_COLUMNS[content_type];
    if (!preferenceColumn) {
      res.status(400).json({ success: false, error: 'Unsupported content type' });
      return;
    }

    const supabase = getSupabaseClient();
    const { data: existing, error: existingError } = await supabase
      .from('ultaura_content_preferences')
      .select('*')
      .eq('line_id', lineId)
      .maybeSingle();

    if (existingError) {
      logger.error({ error: existingError, lineId }, 'Failed to fetch content preferences');
    }

    if (!existing) {
      const { error: insertError } = await supabase
        .from('ultaura_content_preferences')
        .insert({ line_id: lineId });

      if (insertError) {
        logger.error({ error: insertError, lineId }, 'Failed to initialize content preferences');
        res.status(500).json({ success: false, error: 'Failed to update content preferences' });
        return;
      }
    }

    const currentValue = existing?.[preferenceColumn] ?? 3;
    const delta = preference_change === 'increase' ? 1 : -1;
    const nextValue = Math.min(5, Math.max(1, Number(currentValue) + delta));

    const updates: Record<string, unknown> = {
      [preferenceColumn]: nextValue,
      updated_at: new Date().toISOString(),
    };

    if (specific_update && typeof specific_update === 'object') {
      for (const [key, value] of Object.entries(specific_update)) {
        if (SPECIFIC_UPDATE_KEYS.has(key)) {
          updates[key] = value;
        }
      }
    }

    const { error } = await supabase
      .from('ultaura_content_preferences')
      .update(updates)
      .eq('line_id', lineId);

    if (error) {
      logger.error({ error, lineId }, 'Failed to update content preferences');
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'update_content_preference',
        success: false,
      }, { skipDebugLog: true });
      res.status(500).json({ success: false, error: 'Failed to update content preferences' });
      return;
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'update_content_preference',
      success: true,
      contentType: content_type,
      preferenceChange: preference_change,
    }, { skipDebugLog: true });

    res.json({ success: true, value: nextValue });
  } catch (error) {
    logger.error({ error }, 'Error updating content preferences');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
