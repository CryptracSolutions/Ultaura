import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { getSupabaseClient } from '../../utils/supabase.js';
import { minimizeDerivedObjectDeep, minimizeDerivedOptionalText } from '../../utils/derived-artifact-minimizer.js';

export const logSegmentEngagementRouter = Router();

const ALLOWED_SEGMENT_TYPES = new Set(['trivia', 'story', 'learning', 'memory_lane']);
const ALLOWED_SENIOR_RESPONSES = new Set(['enjoyed', 'neutral', 'declined', 'interrupted']);

logSegmentEngagementRouter.post('/', async (req: Request, res: Response) => {
  const {
    callSessionId,
    lineId,
    segmentType,
    segmentDomain,
    segmentContext,
    engagementSignals,
    durationSeconds,
    completed,
    seniorResponse,
    storyArcId,
    chapterCompleted,
  } = req.body as {
    callSessionId?: string;
    lineId?: string;
    segmentType?: string;
    segmentDomain?: string;
    segmentContext?: Record<string, unknown>;
    engagementSignals?: Record<string, unknown>;
    durationSeconds?: number;
    completed?: boolean;
    seniorResponse?: string;
    storyArcId?: string;
    chapterCompleted?: number;
  };

  if (!callSessionId || !lineId || !segmentType) {
    res.status(400).json({ success: false, error: 'Missing required fields' });
    return;
  }

  if (!ALLOWED_SEGMENT_TYPES.has(segmentType)) {
    res.status(400).json({ success: false, error: 'Invalid segmentType' });
    return;
  }

  const session = await getCallSession(callSessionId);
  if (!session || session.line_id !== lineId) {
    res.status(403).json({ success: false, error: 'Unauthorized' });
    return;
  }

  if (session.is_reminder_call || session.is_test_call) {
    res.status(400).json({ success: false, error: 'Segments are disabled for this call type' });
    return;
  }

  const supabase = getSupabaseClient();
  const mergedContext =
    segmentContext && typeof segmentContext === 'object'
      ? { ...segmentContext }
      : {};

  if (storyArcId) {
    mergedContext.story_arc_id = storyArcId;
  }
  if (typeof chapterCompleted === 'number') {
    mergedContext.chapter_completed = chapterCompleted;
  }

  const segmentContextValue = Object.keys(mergedContext).length > 0
    ? mergedContext
    : null;

  const normalizedSeniorResponse =
    typeof seniorResponse === 'string' && ALLOWED_SENIOR_RESPONSES.has(seniorResponse)
      ? seniorResponse
      : null;

  const safeSegmentContext =
    segmentContextValue ? minimizeDerivedObjectDeep(segmentContextValue, { defaultMode: 'label' }) : null;
  const safeEngagementSignals =
    engagementSignals && typeof engagementSignals === 'object'
      ? minimizeDerivedObjectDeep(engagementSignals, { defaultMode: 'label' })
      : null;
  const safeSegmentDomain = minimizeDerivedOptionalText(segmentDomain, 'label');

  const { data, error } = await supabase
    .from('ultaura_segment_engagement')
    .insert({
      line_id: lineId,
      account_id: session.account_id,
      call_session_id: callSessionId,
      segment_type: segmentType,
      segment_domain: safeSegmentDomain,
      segment_context: safeSegmentContext,
      engagement_signals: safeEngagementSignals,
      duration_seconds: typeof durationSeconds === 'number' ? durationSeconds : null,
      completed: typeof completed === 'boolean' ? completed : false,
      senior_response: normalizedSeniorResponse,
    })
    .select('id')
    .single();

  if (error) {
    logger.error({ error, lineId }, 'Failed to log segment engagement');
    res.status(500).json({ success: false, error: 'Failed to log segment engagement' });
    return;
  }

  if (storyArcId && typeof chapterCompleted === 'number') {
    const { error: arcError } = await supabase
      .from('ultaura_story_arcs')
      .update({
        current_chapter: chapterCompleted,
        last_chapter_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', storyArcId)
      .eq('line_id', lineId);

    if (arcError) {
      logger.warn({ error: arcError, storyArcId, lineId }, 'Failed to update story arc progress');
    }
  }

  await incrementToolInvocations(callSessionId);
  await recordCallEvent(callSessionId, 'tool_call', {
    tool: 'log_segment_engagement',
    success: true,
    segmentType,
    storyArcId,
    chapterCompleted,
  }, { skipDebugLog: true });

  res.json({ success: true, engagementId: data.id });
});
