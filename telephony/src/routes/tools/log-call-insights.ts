import { Router, Request, Response } from 'express';
import {
  LogCallInsightsInputSchema,
  type LogCallInsightsInput,
} from '@ultaura/schemas/telephony';
import { logger } from '../../server.js';
import {
  getCallSession,
  incrementToolInvocations,
  recordCallEvent,
} from '../../services/call-session.js';
import { getSupabaseClient } from '../../utils/supabase.js';
import { storeCallInsights, DuplicateInsightError } from '../../services/insights.js';

export const logCallInsightsRouter = Router();

function getCallDurationSeconds(session: {
  seconds_connected: number | null;
  connected_at: string | null;
}): number {
  if (typeof session.seconds_connected === 'number') {
    return session.seconds_connected;
  }

  if (!session.connected_at) {
    return 0;
  }

  const connectedAtMs = new Date(session.connected_at).getTime();
  if (Number.isNaN(connectedAtMs)) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - connectedAtMs) / 1000));
}

logCallInsightsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const rawBody = req.body as Partial<LogCallInsightsInput>;
    const parsed = LogCallInsightsInputSchema.safeParse(rawBody);

    if (!parsed.success) {
      const callSessionId =
        typeof rawBody.callSessionId === 'string' ? rawBody.callSessionId : null;
      if (callSessionId) {
        await recordCallEvent(callSessionId, 'tool_call', {
          tool: 'log_call_insights',
          success: false,
          errorCode: 'validation_error',
        }, { skipDebugLog: true });
      }

      const missingRequired = parsed.error.issues.some((issue) =>
        issue.code === 'invalid_type' && issue.received === 'undefined'
      );
      if (missingRequired) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      res.status(400).json({ error: 'Invalid insight data' });
      return;
    }

    const { callSessionId, lineId, ...insightData } = parsed.data;

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    const recordFailure = async (errorCode?: 'validation_error') => {
      const payload: Record<string, unknown> = {
        tool: 'log_call_insights',
        success: false,
      };
      if (errorCode) {
        payload.errorCode = errorCode;
      }
      await recordCallEvent(callSessionId, 'tool_call', payload, { skipDebugLog: true });
    };

    const recordSkip = async (
      reason: 'call_too_short' | 'test_call' | 'already_recorded' | 'insights_disabled'
    ) => {
      await recordCallEvent(
        callSessionId,
        'tool_call',
        {
          tool: 'log_call_insights',
          success: true,
          skipped: true,
          reason,
        },
        { skipDebugLog: true }
      );
    };

    if (lineId !== session.line_id) {
      await recordFailure();
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const supabase = getSupabaseClient();
    const { data: privacy, error: privacyError } = await supabase
      .from('ultaura_insight_privacy')
      .select('insights_enabled')
      .eq('line_id', lineId)
      .maybeSingle();

    if (privacyError) {
      logger.error({ error: privacyError, lineId }, 'Failed to check insight privacy');
      await recordFailure();
      res.status(500).json({ error: 'Failed to check privacy settings' });
      return;
    }

    if (privacy && privacy.insights_enabled === false) {
      await recordSkip('insights_disabled');
      res.json({ success: true, skipped: true, reason: 'insights_disabled' });
      return;
    }

    const durationSeconds = getCallDurationSeconds(session);
    if (durationSeconds < 180) {
      await recordSkip('call_too_short');
      res.json({ success: true, skipped: true, reason: 'call_too_short' });
      return;
    }

    if (session.is_test_call) {
      await recordSkip('test_call');
      res.json({ success: true, skipped: true, reason: 'test_call' });
      return;
    }

    const { data: existing, error: existingError } = await supabase
      .from('ultaura_call_insights')
      .select('id')
      .eq('call_session_id', callSessionId)
      .maybeSingle();

    if (existingError) {
      logger.error({ error: existingError, callSessionId }, 'Failed to check existing call insights');
      await recordFailure();
      res.status(500).json({ error: 'Failed to check existing insights' });
      return;
    }

    if (existing) {
      await recordSkip('already_recorded');
      res.json({ success: true, skipped: true, reason: 'already_recorded' });
      return;
    }

    let result;
    try {
      result = await storeCallInsights(
        session.account_id,
        lineId,
        callSessionId,
        insightData,
        {
          extractionMethod: 'tool_call',
          durationSeconds,
        }
      );
    } catch (error) {
      if (error instanceof DuplicateInsightError || (error as { code?: string })?.code === 'already_recorded') {
        await recordSkip('already_recorded');
        res.json({ success: true, skipped: true, reason: 'already_recorded' });
        return;
      }
      throw error;
    }

    await incrementToolInvocations(callSessionId);

    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'log_call_insights',
      success: true,
      has_concerns: result.hasConcerns,
      confidence_overall: insightData.confidence_overall,
    }, { skipDebugLog: true });

    res.json({ success: true, insightId: result.id });
  } catch (error) {
    logger.error({ error }, 'Error recording call insights');
    res.status(500).json({ error: 'Failed to record call insights' });
  }
});
