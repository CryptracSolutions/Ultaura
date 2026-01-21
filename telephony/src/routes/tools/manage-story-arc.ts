import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { getSupabaseClient } from '../../utils/supabase.js';
import { minimizeDerivedObjectDeep, minimizeDerivedOptionalText, minimizeDerivedText } from '../../utils/derived-artifact-minimizer.js';

export const manageStoryArcRouter = Router();

manageStoryArcRouter.post('/', async (req: Request, res: Response) => {
  const {
    callSessionId,
    lineId,
    action,
    storyArcId,
    storyType,
    title,
    description,
    totalChapters,
    chapterCompleted,
    storyState,
  } = req.body as {
    callSessionId?: string;
    lineId?: string;
    action?: 'create' | 'update' | 'complete' | 'abandon';
    storyArcId?: string;
    storyType?: string;
    title?: string;
    description?: string;
    totalChapters?: number;
    chapterCompleted?: number;
    storyState?: Record<string, unknown>;
  };

  if (!callSessionId || !lineId || !action) {
    res.status(400).json({ success: false, error: 'Missing required fields' });
    return;
  }

  const session = await getCallSession(callSessionId);
  if (!session || session.line_id !== lineId) {
    res.status(403).json({ success: false, error: 'Unauthorized' });
    return;
  }

  if (session.is_reminder_call || session.is_test_call) {
    res.status(400).json({ success: false, error: 'Story arcs are disabled for this call type' });
    return;
  }

  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  let resultId: string | null = null;

  if (action === 'create') {
    if (!storyType || !title) {
      res.status(400).json({ success: false, error: 'Missing storyType or title' });
      return;
    }

    const minimizedTitle = minimizeDerivedText(title, 'label');
    const minimizedDescription = minimizeDerivedOptionalText(description, 'sentence');
    const minimizedStoryState = minimizeDerivedObjectDeep(storyState || {}, {
      defaultMode: 'label',
    });

    const { data, error } = await supabase
      .from('ultaura_story_arcs')
      .insert({
        account_id: session.account_id,
        line_id: lineId,
        story_type: storyType,
        title: minimizedTitle,
        description: minimizedDescription,
        total_chapters: typeof totalChapters === 'number' ? totalChapters : 5,
        story_state: minimizedStoryState,
        updated_at: now,
      })
      .select('id')
      .single();

    if (error) {
      logger.error({ error, lineId }, 'Failed to create story arc');
      res.status(500).json({ success: false, error: 'Failed to create story arc' });
      return;
    }

    resultId = data.id;
  } else if (action === 'update') {
    if (!storyArcId) {
      res.status(400).json({ success: false, error: 'Missing storyArcId' });
      return;
    }

    const updates: Record<string, unknown> = {
      updated_at: now,
    };

    if (typeof chapterCompleted === 'number') {
      updates.current_chapter = chapterCompleted;
      updates.last_chapter_at = now;
    }
    if (storyState) {
      updates.story_state = minimizeDerivedObjectDeep(storyState, {
        defaultMode: 'label',
      });
    }
    if (typeof totalChapters === 'number') {
      updates.total_chapters = totalChapters;
    }

    const { data, error } = await supabase
      .from('ultaura_story_arcs')
      .update(updates)
      .eq('id', storyArcId)
      .eq('line_id', lineId)
      .select('id')
      .single();

    if (error || !data) {
      logger.error({ error, lineId, storyArcId }, 'Failed to update story arc');
      res.status(500).json({ success: false, error: 'Failed to update story arc' });
      return;
    }

    resultId = data.id;
  } else if (action === 'complete' || action === 'abandon') {
    if (!storyArcId) {
      res.status(400).json({ success: false, error: 'Missing storyArcId' });
      return;
    }

    const status = action === 'complete' ? 'completed' : 'abandoned';
    const { data, error } = await supabase
      .from('ultaura_story_arcs')
      .update({ status, updated_at: now })
      .eq('id', storyArcId)
      .eq('line_id', lineId)
      .select('id')
      .single();

    if (error || !data) {
      logger.error({ error, lineId, storyArcId }, 'Failed to update story arc status');
      res.status(500).json({ success: false, error: 'Failed to update story arc' });
      return;
    }

    resultId = data.id;
  } else {
    res.status(400).json({ success: false, error: 'Invalid action' });
    return;
  }

  await incrementToolInvocations(callSessionId);
  await recordCallEvent(callSessionId, 'tool_call', {
    tool: 'manage_story_arc',
    success: true,
    action,
    storyArcId: resultId,
    storyType,
  }, { skipDebugLog: true });

  res.json({ success: true, storyArcId: resultId });
});
