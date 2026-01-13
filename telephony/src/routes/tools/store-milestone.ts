import { Router, Request, Response } from 'express';
import {
  StoreMilestoneInputSchema,
  type StoreMilestoneInput,
} from '@ultaura/schemas/telephony';
import { logger } from '../../server.js';
import {
  getCallSession,
  incrementToolInvocations,
  recordCallEvent,
} from '../../services/call-session.js';
import { getSupabaseClient } from '../../utils/supabase.js';

export const storeMilestoneRouter = Router();

storeMilestoneRouter.post('/', async (req: Request, res: Response) => {
  try {
    const rawBody = req.body as Partial<StoreMilestoneInput>;
    const parsed = StoreMilestoneInputSchema.safeParse(rawBody);

    if (!parsed.success) {
      const callSessionId =
        typeof rawBody.callSessionId === 'string' ? rawBody.callSessionId : null;
      if (callSessionId) {
        await recordCallEvent(callSessionId, 'tool_call', {
          tool: 'store_milestone',
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
      milestone_type,
      title,
      date_month,
      date_day,
      date_year,
      related_person_name,
      is_recurring,
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
    const { data, error } = await supabase
      .from('ultaura_milestones')
      .insert({
        account_id: session.account_id,
        line_id: lineId,
        milestone_type,
        title,
        date_month,
        date_day,
        date_year: date_year ?? null,
        is_recurring: is_recurring ?? true,
        related_person_name: related_person_name ?? null,
        updated_at: now,
        source: 'conversation',
      })
      .select('id')
      .single();

    if (error || !data) {
      logger.error({ error, lineId }, 'Failed to store milestone');
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'store_milestone',
        success: false,
      }, { skipDebugLog: true });
      res.status(500).json({ success: false, error: 'Failed to store milestone' });
      return;
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'store_milestone',
      success: true,
      milestoneType: milestone_type,
      isRecurring: is_recurring ?? true,
      milestoneId: data.id,
    }, { skipDebugLog: true });

    res.json({ success: true, milestoneId: data.id });
  } catch (error) {
    logger.error({ error }, 'Error storing milestone');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
