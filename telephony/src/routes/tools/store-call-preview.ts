import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { getSupabaseClient } from '../../utils/supabase.js';
import { minimizeDerivedObjectDeep, minimizeDerivedOptionalText, minimizeDerivedText } from '../../utils/derived-artifact-minimizer.js';

export const storeCallPreviewRouter = Router();

storeCallPreviewRouter.post('/', async (req: Request, res: Response) => {
  const {
    callSessionId,
    lineId,
    topicType,
    topicKey,
    topicDisplay,
    segmentType,
    segmentContext,
  } = req.body as {
    callSessionId?: string;
    lineId?: string;
    topicType?: string;
    topicKey?: string;
    topicDisplay?: string;
    segmentType?: string;
    segmentContext?: Record<string, unknown>;
  };

  if (!callSessionId || !lineId || !topicType || !topicKey || !topicDisplay) {
    res.status(400).json({ success: false, error: 'Missing required fields' });
    return;
  }

  const minimizedTopicDisplay = minimizeDerivedText(topicDisplay, 'label');
  const minimizedSegmentType = minimizeDerivedOptionalText(segmentType, 'label');
  const minimizedSegmentContext = segmentContext
    ? minimizeDerivedObjectDeep(segmentContext, { defaultMode: 'label' })
    : null;

  const session = await getCallSession(callSessionId);
  if (!session || session.line_id !== lineId) {
    res.status(403).json({ success: false, error: 'Unauthorized' });
    return;
  }

  if (session.is_reminder_call || session.is_test_call) {
    res.status(400).json({ success: false, error: 'Call previews are disabled for this call type' });
    return;
  }

  const supabase = getSupabaseClient();

  await supabase
    .from('ultaura_call_previews')
    .update({ status: 'expired' })
    .eq('line_id', lineId)
    .eq('status', 'pending');

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('ultaura_call_previews')
    .insert({
      line_id: lineId,
      account_id: session.account_id,
      topic_type: topicType,
      topic_key: topicKey,
      topic_display: minimizedTopicDisplay,
      segment_type: minimizedSegmentType,
      segment_context: minimizedSegmentContext,
      offered_at: now,
      selected_at: now,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    logger.error({ error, lineId }, 'Failed to store call preview');
    res.status(500).json({ success: false, error: 'Failed to store preview' });
    return;
  }

  await incrementToolInvocations(callSessionId);
  await recordCallEvent(callSessionId, 'tool_call', {
    tool: 'store_call_preview',
    success: true,
    topicType,
    previewId: data.id,
  }, { skipDebugLog: true });

  res.json({ success: true, previewId: data.id });
});
