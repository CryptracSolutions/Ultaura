import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getMemoriesForLine, forgetMemory } from '../../services/memory.js';

export const forgetMemoryRouter = Router();

forgetMemoryRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { lineId, accountId, whatToForget } = req.body;

    if (!lineId || !accountId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Get recent memories to find what to forget
    const memories = await getMemoriesForLine(accountId, lineId, { limit: 50 });

    // Find memory that matches (simple matching for MVP)
    const searchTerms = (whatToForget as string).toLowerCase().split(' ');
    const toForget = memories.find(m => {
      const keyValue = `${m.key} ${String(m.value)}`.toLowerCase();
      return searchTerms.some(term => keyValue.includes(term));
    });

    if (toForget) {
      await forgetMemory(accountId, lineId, toForget.id);
      logger.info({ lineId, memoryId: toForget.id, key: toForget.key }, 'Memory forgotten');
      res.json({
        success: true,
        message: `I've forgotten that. I won't bring it up again.`,
      });
    } else {
      res.json({
        success: true,
        message: `I'll make sure not to reference that.`,
      });
    }
  } catch (error) {
    logger.error({ error }, 'Error forgetting memory');
    res.status(500).json({ error: 'Failed to forget memory' });
  }
});
