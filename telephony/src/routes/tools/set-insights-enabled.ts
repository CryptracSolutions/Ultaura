import { Router, Request, Response } from 'express';
import {
  SetInsightsEnabledInputSchema,
  type SetInsightsEnabledInput,
} from '@ultaura/schemas/telephony';
import { logger } from '../../server.js';
import { getSupabaseClient } from '../../utils/supabase.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { logConsentAuditEvent, updateLineVoiceConsent } from '../../services/privacy.js';

export const setInsightsEnabledRouter = Router();

setInsightsEnabledRouter.post('/', async (req: Request, res: Response) => {
  try {
    const rawBody = req.body as Partial<SetInsightsEnabledInput>;
    const parsed = SetInsightsEnabledInputSchema.safeParse(rawBody);

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

    const { callSessionId, lineId, enabled } = parsed.data;
    const session = await getCallSession(callSessionId);

    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    const recordFailure = async (errorCode?: string) => {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'set_insights_enabled',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    if (lineId !== session.line_id) {
      await recordFailure('unauthorized');
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const skipPersist = session.is_test_call || session.is_preview_mode;
    if (!skipPersist) {
      const supabase = getSupabaseClient();
      const now = new Date().toISOString();
      const { data: existing } = await supabase
        .from('ultaura_insight_privacy')
        .select('insights_enabled')
        .eq('line_id', lineId)
        .maybeSingle();

      const previousEnabled = existing?.insights_enabled ?? true;

      const { error: updateError } = await supabase
        .from('ultaura_insight_privacy')
        .upsert({
          line_id: lineId,
          insights_enabled: enabled,
          updated_at: now,
        }, { onConflict: 'line_id' });

      if (updateError) {
        logger.error({ error: updateError, lineId }, 'Failed to update insights enabled');
        await recordFailure('insights_update_failed');
        res.status(500).json({ error: 'Failed to update insights setting' });
        return;
      }

      const clearedReprompt = await updateLineVoiceConsent(
        lineId,
        session.account_id,
        callSessionId,
        { insightsRepromptRequestedAt: null }
      );

      if (!clearedReprompt) {
        logger.warn({ lineId }, 'Failed to clear insights reprompt request');
      }

      await logConsentAuditEvent({
        accountId: session.account_id,
        lineId,
        callSessionId,
        action: 'insights_enabled_changed',
        oldValue: { insights_enabled: previousEnabled },
        newValue: { insights_enabled: enabled },
      });
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'set_insights_enabled',
      success: true,
      enabled,
    }, { skipDebugLog: true });

    res.json({
      success: true,
      message: enabled
        ? 'Insights are enabled again.'
        : 'Insights are disabled until you turn them back on.',
    });
  } catch (error) {
    logger.error({ error }, 'Error updating insights enabled');
    res.status(500).json({ error: 'Failed to update insights setting' });
  }
});
