import { Router, Request, Response } from 'express';
import {
  MarkTopicPrivateInputSchema,
  type MarkTopicPrivateInput,
} from '@ultaura/schemas/telephony';
import { logger } from '../../server.js';
import { getSupabaseClient } from '../../utils/supabase.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { addPrivateTopic } from '../../services/insight-state.js';

export const markTopicPrivateRouter = Router();

markTopicPrivateRouter.post('/', async (req: Request, res: Response) => {
  try {
    const rawBody = req.body as Partial<MarkTopicPrivateInput>;
    const parsed = MarkTopicPrivateInputSchema.safeParse(rawBody);

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

    const { callSessionId, lineId, topic_code } = parsed.data;
    const session = await getCallSession(callSessionId);

    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    const recordFailure = async (errorCode?: string) => {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'mark_topic_private',
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
    const { data: privacy, error: privacyError } = await supabase
      .from('ultaura_insight_privacy')
      .select('id, private_topic_codes')
      .eq('line_id', lineId)
      .maybeSingle();

    if (privacyError) {
      logger.error({ error: privacyError, lineId }, 'Failed to fetch insight privacy');
      await recordFailure('privacy_fetch_failed');
      res.status(500).json({ error: 'Failed to update privacy' });
      return;
    }

    const existingCodes = Array.isArray(privacy?.private_topic_codes)
      ? privacy.private_topic_codes
      : [];
    const nextCodes = Array.from(new Set([...existingCodes, topic_code]));

    const { error: updateError } = await supabase
      .from('ultaura_insight_privacy')
      .upsert({
        line_id: lineId,
        private_topic_codes: nextCodes,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'line_id' });

    if (updateError) {
      logger.error({ error: updateError, lineId }, 'Failed to update private topic codes');
      await recordFailure('privacy_update_failed');
      res.status(500).json({ error: 'Failed to update privacy' });
      return;
    }

    addPrivateTopic(callSessionId, topic_code);

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'mark_topic_private',
      success: true,
    }, { skipDebugLog: true });

    res.json({
      success: true,
      message: "I'll keep that private.",
    });
  } catch (error) {
    logger.error({ error }, 'Error processing mark_topic_private');
    res.status(500).json({ error: 'Failed to mark topic private' });
  }
});
