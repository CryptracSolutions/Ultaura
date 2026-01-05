import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { getMemoriesForLine, markMemoryPrivate } from '../../services/memory.js';

export const markPrivateRouter = Router();

markPrivateRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId, whatToKeepPrivate } = req.body;

    if (!callSessionId || !lineId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    if (lineId !== session.line_id) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const accountId = session.account_id;

    // Get recent memories
    const memories = await getMemoriesForLine(accountId, lineId, { limit: 50 });

    // Find matching memory
    const searchTerms = (whatToKeepPrivate as string).toLowerCase().split(' ');
    const toMark = memories.find(m => {
      const keyValue = `${m.key} ${String(m.value)}`.toLowerCase();
      return searchTerms.some(term => keyValue.includes(term));
    });

    if (toMark) {
      await markMemoryPrivate(accountId, lineId, toMark.id);
      logger.info({ lineId, memoryId: toMark.id }, 'Memory marked as private');
    } else {
      logger.info({ lineId }, 'No matching memory found to mark private');
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'mark_private',
      lineId,
      memoryId: toMark?.id,
      result: toMark ? 'marked' : 'not_found',
    });

    res.json({
      success: true,
      message: `Of course, I'll keep that just between us. Your family won't see it.`,
    });
  } catch (error) {
    logger.error({ error }, 'Error marking memory private');
    res.status(500).json({ error: 'Failed to mark as private' });
  }
});
