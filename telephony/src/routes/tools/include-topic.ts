import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { includeTopic, EXCLUSION_DISPLAY_NAMES, type ExclusionCategory } from '../../services/topic-exclusions.js';

export const includeTopicRouter = Router();

const VALID_CATEGORIES: ExclusionCategory[] = [
  'health_medical',
  'family_relationships',
  'finances',
  'location_address',
];

includeTopicRouter.post('/', async (req: Request, res: Response) => {
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
        tool: 'include_memory_topic',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    if (lineId !== session.line_id) {
      await recordFailure('unauthorized');
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const result = await includeTopic({
      lineId,
      category,
      callSessionId,
    });

    const restoredCount = result.restoredMemoryIds.length;
    const displayName = EXCLUSION_DISPLAY_NAMES[category] ?? category;

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'include_memory_topic',
      success: true,
      category,
      restoredMemories: restoredCount,
    }, { skipDebugLog: true });

    res.json({
      success: true,
      message: `Okay, I can remember ${displayName.toLowerCase()} again.`,
      category,
      restoredMemories: restoredCount,
    });
  } catch (error) {
    logger.error({ error }, 'Error including memory topic');
    res.status(500).json({ error: 'Failed to include topic' });
  }
});
