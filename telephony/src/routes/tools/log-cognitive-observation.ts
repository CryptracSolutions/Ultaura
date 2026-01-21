import { Router, Request, Response } from 'express';
import {
  LogCognitiveObservationInputSchema,
  type LogCognitiveObservationInput,
} from '@ultaura/schemas/telephony';
import { logger } from '../../server.js';
import {
  getCallSession,
  incrementToolInvocations,
  recordCallEvent,
} from '../../services/call-session.js';
import { getSupabaseClient } from '../../utils/supabase.js';
import { updateCognitiveFlagsFromObservation } from '../../services/cognitive-flags.js';

export const logCognitiveObservationRouter = Router();

logCognitiveObservationRouter.post('/', async (req: Request, res: Response) => {
  try {
    const rawBody = req.body as Partial<LogCognitiveObservationInput>;
    const parsed = LogCognitiveObservationInputSchema.safeParse(rawBody);

    if (!parsed.success) {
      const callSessionId =
        typeof rawBody.callSessionId === 'string' ? rawBody.callSessionId : null;
      if (callSessionId) {
        await recordCallEvent(callSessionId, 'tool_call', {
          tool: 'log_cognitive_observation',
          success: false,
          errorCode: 'validation_error',
        }, { skipDebugLog: true });
      }

      res.status(400).json({ success: false, error: 'Invalid input' });
      return;
    }

    const { callSessionId, lineId, observation_type, severity } = parsed.data;

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
    const { count: existingCount, error: countError } = await supabase
      .from('ultaura_cognitive_observations')
      .select('id', { count: 'exact', head: true })
      .eq('call_session_id', callSessionId);

    if (countError) {
      logger.error({ error: countError, callSessionId }, 'Failed to check observation count');
    }

    const isFirstObservation = (existingCount ?? 0) === 0;

    const windowStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { count: similarCount, error: similarError } = await supabase
      .from('ultaura_cognitive_observations')
      .select('id', { count: 'exact', head: true })
      .eq('line_id', lineId)
      .eq('observation_type', observation_type)
      .gte('created_at', windowStart);

    if (similarError) {
      logger.error({ error: similarError, lineId }, 'Failed to check similar observations');
    }

    const similarObservationCount = (similarCount ?? 0) + 1;
    const isNovel = (similarCount ?? 0) === 0;

    const { error } = await supabase
      .from('ultaura_cognitive_observations')
      .insert({
        call_session_id: callSessionId,
        line_id: lineId,
        observation_type,
        severity,
        context: null,
        response_given: null,
        is_novel: isNovel,
        similar_observation_count: similarObservationCount,
      });

    if (error) {
      logger.error({ error, callSessionId }, 'Failed to log cognitive observation');
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'log_cognitive_observation',
        success: false,
      }, { skipDebugLog: true });
      res.status(500).json({ success: false, error: 'Failed to log observation' });
      return;
    }

    await updateCognitiveFlagsFromObservation({
      lineId,
      accountId: session.account_id,
      callSessionId,
      callSessionCreatedAt: session.created_at,
      severity,
      isFirstObservation,
    });

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'log_cognitive_observation',
      success: true,
      observationType: observation_type,
      severity,
      isNovel,
    }, { skipDebugLog: true });

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error logging cognitive observation');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
