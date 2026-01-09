import { Router, Request, Response } from 'express';
import {
  SetPauseModeInputSchema,
  type SetPauseModeInput,
} from '@ultaura/schemas/telephony';
import { logger } from '../../server.js';
import { getSupabaseClient } from '../../utils/supabase.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';

export const setPauseModeRouter = Router();

setPauseModeRouter.post('/', async (req: Request, res: Response) => {
  try {
    const rawBody = req.body as Partial<SetPauseModeInput>;
    const parsed = SetPauseModeInputSchema.safeParse(rawBody);

    if (!parsed.success) {
      const missingRequired = parsed.error.issues.some((issue) =>
        issue.code === 'invalid_type' && issue.received === 'undefined'
      );
      if (missingRequired) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
      return;
    }

    const { callSessionId, lineId, enabled, reason } = parsed.data;
    const session = await getCallSession(callSessionId);

    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    const recordFailure = async (errorCode?: string) => {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'set_pause_mode',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    if (lineId !== session.line_id) {
      await recordFailure('unauthorized');
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('ultaura_insight_privacy')
      .upsert({
        line_id: lineId,
        is_paused: enabled,
        paused_at: enabled ? now : null,
        paused_reason: enabled ? (reason?.slice(0, 200) || null) : null,
        updated_at: now,
      }, { onConflict: 'line_id' });

    if (updateError) {
      logger.error({ error: updateError, lineId }, 'Failed to update pause mode');
      await recordFailure('pause_update_failed');
      res.status(500).json({ error: 'Failed to update pause mode' });
      return;
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'set_pause_mode',
      success: true,
    }, { skipDebugLog: true });

    res.json({
      success: true,
      message: enabled
        ? 'Pause mode enabled. Alerts will be suppressed while you are away.'
        : 'Pause mode disabled. Alerts are active again.',
    });
  } catch (error) {
    logger.error({ error }, 'Error processing pause mode');
    res.status(500).json({ error: 'Failed to update pause mode' });
  }
});
