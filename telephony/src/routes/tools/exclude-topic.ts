import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { excludeTopic, EXCLUSION_DISPLAY_NAMES, type ExclusionCategory } from '../../services/topic-exclusions.js';

export const excludeTopicRouter = Router();

const VALID_CATEGORIES: ExclusionCategory[] = [
  'health_medical',
  'family_relationships',
  'finances',
  'location_address',
];

excludeTopicRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId, category } = req.body as {
      callSessionId?: string;
      lineId?: string;
      category?: ExclusionCategory;
    };

    if (!callSessionId || !lineId || !category) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (!VALID_CATEGORIES.includes(category)) {
      res.status(400).json({ error: 'Invalid category' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    const recordFailure = async (errorCode?: string) => {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'exclude_memory_topic',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    if (lineId !== session.line_id) {
      await recordFailure('unauthorized');
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const result = await excludeTopic({
      accountId: session.account_id,
      lineId,
      category,
      callSessionId,
    });

    const affectedCount = result.affectedMemoryIds.length;
    const displayName = EXCLUSION_DISPLAY_NAMES[category] ?? category;

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'exclude_memory_topic',
      success: true,
      category,
      affectedMemories: affectedCount,
    }, { skipDebugLog: true });

    res.json({
      success: true,
      message: `Okay, I won't remember anything about ${displayName.toLowerCase()}.`,
      category,
      affectedMemories: affectedCount,
    });
  } catch (error) {
    logger.error({ error }, 'Error excluding memory topic');
    res.status(500).json({ error: 'Failed to exclude topic' });
  }
});
