import { Router, Request, Response } from 'express';
import {
  MarkMilestoneCelebratedInputSchema,
  type MarkMilestoneCelebratedInput,
} from '@ultaura/schemas/telephony';
import { logger } from '../../server.js';
import {
  getCallSession,
  incrementToolInvocations,
  recordCallEvent,
} from '../../services/call-session.js';
import { getSupabaseClient } from '../../utils/supabase.js';

export const markMilestoneCelebratedRouter = Router();

markMilestoneCelebratedRouter.post('/', async (req: Request, res: Response) => {
  try {
    const rawBody = req.body as Partial<MarkMilestoneCelebratedInput>;
    const parsed = MarkMilestoneCelebratedInputSchema.safeParse(rawBody);

    if (!parsed.success) {
      const callSessionId =
        typeof rawBody.callSessionId === 'string' ? rawBody.callSessionId : null;
      if (callSessionId) {
        await recordCallEvent(callSessionId, 'tool_call', {
          tool: 'mark_milestone_celebrated',
          success: false,
          errorCode: 'validation_error',
        }, { skipDebugLog: true });
      }

      res.status(400).json({ success: false, error: 'Invalid input' });
      return;
    }

    const { callSessionId, lineId, milestone_id, milestone_title } = parsed.data;

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
    let milestoneId = milestone_id ?? null;

    if (!milestoneId && milestone_title) {
      const { data, error } = await supabase
        .from('ultaura_milestones')
        .select('id')
        .eq('line_id', lineId)
        .ilike('title', milestone_title.trim())
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        logger.error({ error, lineId }, 'Failed to look up milestone by title');
      }

      milestoneId = data?.id ?? null;
    }

    if (!milestoneId) {
      res.status(404).json({ success: false, error: 'Milestone not found' });
      return;
    }

    const now = new Date().toISOString();
    const { data: existing, error: existingError } = await supabase
      .from('ultaura_milestones')
      .select('times_celebrated')
      .eq('id', milestoneId)
      .eq('line_id', lineId)
      .maybeSingle();

    if (existingError || !existing) {
      logger.error({ error: existingError, lineId }, 'Failed to load milestone');
      res.status(404).json({ success: false, error: 'Milestone not found' });
      return;
    }

    const { error: updateError } = await supabase
      .from('ultaura_milestones')
      .update({
        last_celebrated_at: now,
        times_celebrated: (existing.times_celebrated ?? 0) + 1,
        updated_at: now,
      })
      .eq('id', milestoneId)
      .eq('line_id', lineId);

    if (updateError) {
      logger.error({ error: updateError, lineId }, 'Failed to mark milestone celebrated');
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'mark_milestone_celebrated',
        success: false,
      }, { skipDebugLog: true });
      res.status(500).json({ success: false, error: 'Failed to update milestone' });
      return;
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'mark_milestone_celebrated',
      success: true,
      milestoneId,
    }, { skipDebugLog: true });

    res.json({ success: true, milestoneId });
  } catch (error) {
    logger.error({ error }, 'Error marking milestone celebrated');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
