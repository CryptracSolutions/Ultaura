import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { activateHealthSuppression } from '../../services/health-privacy-state.js';
import { getSupabaseClient } from '../../utils/supabase.js';

export const markHealthDisclosurePrivateRouter = Router();

markHealthDisclosurePrivateRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId } = req.body as {
      callSessionId?: string;
      lineId?: string;
    };

    if (!callSessionId || !lineId) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ success: false, error: 'Call session not found' });
      return;
    }

    if (lineId !== session.line_id) {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'mark_health_disclosure_private',
        success: false,
        errorCode: 'unauthorized',
      }, { skipDebugLog: true });
      res.status(403).json({ success: false, error: 'Unauthorized' });
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
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'mark_health_disclosure_private',
        success: false,
        errorCode: 'health_context_unavailable',
      }, { skipDebugLog: true });
      res.status(403).json({ success: false, error: 'health_context_unavailable' });
      return;
    }

    // For test/preview calls, skip persistence but return success
    if (session.is_test_call || session.is_preview_mode) {
      await incrementToolInvocations(callSessionId);
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'mark_health_disclosure_private',
        success: true,
        suppressionScope: 'current_call_health_adjacency',
      }, { skipDebugLog: true });
      res.json({
        success: true,
        suppressionScope: 'current_call_health_adjacency',
        affectedCallSessionId: callSessionId,
      });
      return;
    }

    // Activate suppression + retroactive mark
    await activateHealthSuppression(callSessionId, lineId);

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'mark_health_disclosure_private',
      success: true,
      suppressionScope: 'current_call_health_adjacency',
    }, { skipDebugLog: true });

    res.json({
      success: true,
      suppressionScope: 'current_call_health_adjacency',
      affectedCallSessionId: callSessionId,
    });
  } catch (error) {
    logger.error({ error }, 'Error in mark_health_disclosure_private');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
