import type { ExclusionCategory } from '@ultaura/types';
import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { listTopicExclusions, EXCLUSION_DISPLAY_NAMES } from '../../services/topic-exclusions.js';

export const listExclusionsRouter = Router();

listExclusionsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId } = req.body as {
      callSessionId?: string;
      lineId?: string;
    };

    if (!callSessionId || !lineId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    const recordFailure = async (errorCode?: string) => {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'list_topic_exclusions',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    if (lineId !== session.line_id) {
      await recordFailure('unauthorized');
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const exclusions = await listTopicExclusions(lineId);
    const formatted = exclusions.map((e) => ({
      category: e.category as ExclusionCategory,
      displayName: EXCLUSION_DISPLAY_NAMES[e.category as ExclusionCategory] ?? e.category,
      excluded: e.excluded,
      excludedAt: e.excluded_at ?? null,
    }));

    const excludedCount = formatted.filter((e) => e.excluded).length;

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'list_topic_exclusions',
      success: true,
      excludedCount,
    }, { skipDebugLog: true });

    res.json({
      success: true,
      exclusions: formatted,
    });
  } catch (error) {
    logger.error({ error }, 'Error listing topic exclusions');
    res.status(500).json({ error: 'Failed to list topic exclusions' });
  }
});
