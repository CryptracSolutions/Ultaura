import { Router, Request, Response } from 'express';
import {
  AdjustAccessibilityInputSchema,
  type AdjustAccessibilityInput,
} from '@ultaura/schemas/telephony';
import { logger } from '../../server.js';
import {
  getCallSession,
  incrementToolInvocations,
  recordCallEvent,
} from '../../services/call-session.js';
import { getSupabaseClient } from '../../utils/supabase.js';

const HEARING_MODES = new Set(['normal', 'enhanced_clarity', 'slow_pace']);
const COGNITIVE_MODES = new Set(['normal', 'supportive', 'high_support']);

export const adjustAccessibilityRouter = Router();

adjustAccessibilityRouter.post('/', async (req: Request, res: Response) => {
  try {
    const rawBody = req.body as Partial<AdjustAccessibilityInput>;
    const parsed = AdjustAccessibilityInputSchema.safeParse(rawBody);

    if (!parsed.success) {
      const callSessionId =
        typeof rawBody.callSessionId === 'string' ? rawBody.callSessionId : null;
      if (callSessionId) {
        await recordCallEvent(callSessionId, 'tool_call', {
          tool: 'adjust_accessibility',
          success: false,
          errorCode: 'validation_error',
        }, { skipDebugLog: true });
      }

      res.status(400).json({ success: false, error: 'Invalid input' });
      return;
    }

    const { callSessionId, lineId, setting, value, source } = parsed.data;

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ success: false, error: 'Call session not found' });
      return;
    }

    if (session.line_id !== lineId) {
      res.status(403).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (setting === 'speech_rate') {
      const parsedRate = Number(value);
      if (!Number.isFinite(parsedRate)) {
        res.status(400).json({ success: false, error: 'Invalid speech rate' });
        return;
      }
      const clamped = Math.min(1.3, Math.max(0.7, parsedRate));
      updates.speech_rate = clamped;
    } else if (setting === 'hearing_mode') {
      if (!HEARING_MODES.has(value)) {
        res.status(400).json({ success: false, error: 'Invalid hearing mode' });
        return;
      }
      updates.hearing_mode = value;
      if (source) {
        updates.hearing_mode_source = source;
      }
    } else if (setting === 'cognitive_mode') {
      if (!COGNITIVE_MODES.has(value)) {
        res.status(400).json({ success: false, error: 'Invalid cognitive mode' });
        return;
      }
      updates.cognitive_mode = value;
      if (source) {
        updates.cognitive_mode_source = source;
      }
    } else {
      res.status(400).json({ success: false, error: 'Unsupported setting' });
      return;
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('ultaura_accessibility_settings')
      .upsert({
        line_id: lineId,
        ...updates,
      }, { onConflict: 'line_id' });

    if (error) {
      logger.error({ error, lineId }, 'Failed to adjust accessibility settings');
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'adjust_accessibility',
        success: false,
      }, { skipDebugLog: true });
      res.status(500).json({ success: false, error: 'Failed to adjust accessibility' });
      return;
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'adjust_accessibility',
      success: true,
      setting,
      value,
      source,
    }, { skipDebugLog: true });

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error adjusting accessibility settings');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
