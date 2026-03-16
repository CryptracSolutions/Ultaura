import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import {
  getCallSession,
  incrementToolInvocations,
  recordCallEvent,
} from '../../services/call-session.js';
import { submitHealthSuggestionCandidate } from '../../services/health-suggestions-telephony.js';
import { getSupabaseClient } from '../../utils/supabase.js';

export const queueHealthSuggestionRouter = Router();

queueHealthSuggestionRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      callSessionId,
      lineId,
      suggestion_type,
      suggestion_mode,
      normalized_name,
      confidence_label,
      summary_paraphrase,
      proposed_fields,
    } = req.body as Record<string, unknown>;

    if (
      !callSessionId ||
      !lineId ||
      typeof callSessionId !== 'string' ||
      typeof lineId !== 'string'
    ) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ success: false, error: 'Call session not found' });
      return;
    }

    if (lineId !== session.line_id) {
      await recordCallEvent(
        callSessionId,
        'tool_call',
        { tool: 'queue_health_suggestion', success: false, errorCode: 'unauthorized' },
        { skipDebugLog: true },
      );
      res.status(403).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // Check test/preview — no persistence
    if (session.is_test_call || session.is_preview_mode) {
      await incrementToolInvocations(callSessionId);
      await recordCallEvent(
        callSessionId,
        'tool_call',
        {
          tool: 'queue_health_suggestion',
          success: true,
          action: 'noop_blocked',
          suggestionType: suggestion_type,
        },
        { skipDebugLog: true },
      );
      res.json({ schemaVersion: 'health-suggestions-v1', success: true, action: 'noop_blocked' });
      return;
    }

    // Check if Health has been disabled for this session
    const supabase = getSupabaseClient();
    const { data: consentCheck } = await supabase
      .from('ultaura_health_line_consent')
      .select('health_consent')
      .eq('line_id', lineId)
      .maybeSingle();

    if (consentCheck?.health_consent === 'denied' || consentCheck?.health_consent === 'revoked') {
      await recordCallEvent(
        callSessionId,
        'tool_call',
        { tool: 'queue_health_suggestion', success: false, errorCode: 'health_context_unavailable' },
        { skipDebugLog: true },
      );
      res.status(403).json({ success: false, error: 'health_context_unavailable' });
      return;
    }

    // Check suppression state
    const { data: sessionRow } = await supabase
      .from('ultaura_call_sessions')
      .select('health_private_disclosure_suppressed_at')
      .eq('id', callSessionId)
      .maybeSingle();

    if (sessionRow?.health_private_disclosure_suppressed_at) {
      await incrementToolInvocations(callSessionId);
      await recordCallEvent(
        callSessionId,
        'tool_call',
        {
          tool: 'queue_health_suggestion',
          success: true,
          action: 'noop_blocked',
          suggestionType: suggestion_type,
        },
        { skipDebugLog: true },
      );
      res.json({ schemaVersion: 'health-suggestions-v1', success: true, action: 'noop_blocked' });
      return;
    }

    // Forward to app API
    const result = await submitHealthSuggestionCandidate({
      lineId,
      callSessionId,
      suggestionType: suggestion_type as 'condition' | 'medication',
      suggestionMode: suggestion_mode as 'new' | 'update',
      normalizedName: normalized_name as string,
      confidenceLabel: confidence_label as 'high' | 'medium',
      summaryParaphrase: summary_paraphrase as string,
      proposedFields: (proposed_fields as Record<string, unknown>) || {},
    });

    if (!result) {
      res.status(500).json({ success: false, error: 'Failed to queue suggestion' });
      return;
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(
      callSessionId,
      'tool_call',
      {
        tool: 'queue_health_suggestion',
        success: true,
        action: result.action,
        suggestionType: suggestion_type,
        suggestionMode: suggestion_mode,
        confidenceLabel: confidence_label,
      },
      { skipDebugLog: true },
    );

    res.json(result);
  } catch (error) {
    logger.error({ error }, 'Error in queue_health_suggestion');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
