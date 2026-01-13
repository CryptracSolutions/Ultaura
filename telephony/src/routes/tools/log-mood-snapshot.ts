import { Router, Request, Response } from 'express';
import {
  LogMoodSnapshotInputSchema,
  type LogMoodSnapshotInput,
} from '@ultaura/schemas/telephony';
import { logger } from '../../server.js';
import {
  getCallSession,
  incrementToolInvocations,
  recordCallEvent,
} from '../../services/call-session.js';
import { getSupabaseClient } from '../../utils/supabase.js';

export const logMoodSnapshotRouter = Router();

logMoodSnapshotRouter.post('/', async (req: Request, res: Response) => {
  try {
    const rawBody = req.body as Partial<LogMoodSnapshotInput>;
    const parsed = LogMoodSnapshotInputSchema.safeParse(rawBody);

    if (!parsed.success) {
      const callSessionId =
        typeof rawBody.callSessionId === 'string' ? rawBody.callSessionId : null;
      if (callSessionId) {
        await recordCallEvent(callSessionId, 'tool_call', {
          tool: 'log_mood_snapshot',
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
      mood_start,
      mood_mid,
      mood_end,
      mood_trajectory,
      techniques_used,
      energy_level,
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

    const supabase = getSupabaseClient();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('ultaura_mood_snapshots')
      .upsert({
        call_session_id: callSessionId,
        line_id: lineId,
        account_id: session.account_id,
        mood_start,
        mood_mid: mood_mid ?? null,
        mood_end,
        mood_trajectory,
        techniques_used: techniques_used ?? [],
        technique_effectiveness: {},
        energy_level,
        mood_end_at: now,
      }, { onConflict: 'call_session_id' });

    if (error) {
      logger.error({ error, callSessionId }, 'Failed to log mood snapshot');
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'log_mood_snapshot',
        success: false,
      }, { skipDebugLog: true });
      res.status(500).json({ success: false, error: 'Failed to log mood snapshot' });
      return;
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'log_mood_snapshot',
      success: true,
      moodStart: mood_start,
      moodEnd: mood_end,
      trajectory: mood_trajectory,
      energyLevel: energy_level,
    }, { skipDebugLog: true });

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error logging mood snapshot');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
