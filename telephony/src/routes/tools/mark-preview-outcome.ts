import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { getSupabaseClient } from '../../utils/supabase.js';

export const markPreviewOutcomeRouter = Router();

markPreviewOutcomeRouter.post('/', async (req: Request, res: Response) => {
  const {
    callSessionId,
    lineId,
    outcome,
    previewId,
  } = req.body as {
    callSessionId?: string;
    lineId?: string;
    outcome?: 'engaged' | 'declined' | 'redirected';
    previewId?: string;
  };

  if (!callSessionId || !lineId || !outcome) {
    res.status(400).json({ success: false, error: 'Missing required fields' });
    return;
  }

  if (!['engaged', 'declined', 'redirected'].includes(outcome)) {
    res.status(400).json({ success: false, error: 'Invalid outcome' });
    return;
  }

  const session = await getCallSession(callSessionId);
  if (!session || session.line_id !== lineId) {
    res.status(403).json({ success: false, error: 'Unauthorized' });
    return;
  }

  if (session.is_reminder_call || session.is_test_call) {
    res.status(400).json({ success: false, error: 'Previews are disabled for this call type' });
    return;
  }

  const supabase = getSupabaseClient();
  let targetId = previewId || null;

  if (!targetId) {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: latest } = await supabase
      .from('ultaura_call_previews')
      .select('id')
      .eq('line_id', lineId)
      .eq('status', 'used')
      .gt('created_at', cutoff)
      .gte('used_at', session.created_at)
      .order('used_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    targetId = latest?.id ?? null;
  }

  if (!targetId) {
    res.status(404).json({ success: false, error: 'Call preview not found' });
    return;
  }

  const followedThrough = outcome === 'engaged';
  const nextStatus = outcome === 'declined' ? 'declined' : 'used';
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('ultaura_call_previews')
    .update({
      status: nextStatus,
      used_at: now,
      followed_through: followedThrough,
      follow_through_response: outcome,
    })
    .eq('id', targetId)
    .eq('line_id', lineId);

  if (error) {
    logger.error({ error, lineId, previewId: targetId }, 'Failed to mark call preview outcome');
    res.status(500).json({ success: false, error: 'Failed to update call preview' });
    return;
  }

  await incrementToolInvocations(callSessionId);
  await recordCallEvent(callSessionId, 'tool_call', {
    tool: 'mark_preview_outcome',
    success: true,
    outcome,
    previewId: targetId,
  }, { skipDebugLog: true });

  res.json({ success: true, previewId: targetId });
});
