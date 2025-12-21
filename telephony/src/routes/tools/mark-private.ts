import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getMemoriesForLine, markMemoryPrivate } from '../../services/memory.js';

export const markPrivateRouter = Router();

markPrivateRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { lineId, accountId, whatToKeepPrivate } = req.body;

    if (!lineId || !accountId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

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
    }

    res.json({
      success: true,
      message: `Of course, I'll keep that just between us. Your family won't see it.`,
    });
  } catch (error) {
    logger.error({ error }, 'Error marking memory private');
    res.status(500).json({ error: 'Failed to mark as private' });
  }
});
