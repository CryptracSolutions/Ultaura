import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { getMemoriesForLine, forgetMemory } from '../../services/memory.js';

export const forgetMemoryRouter = Router();

forgetMemoryRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId, whatToForget } = req.body;

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
        tool: 'forget_memory',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    if (lineId !== session.line_id) {
      await recordFailure();
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const accountId = session.account_id;

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
    } else {
      logger.info({ lineId }, 'No matching memory found to forget');
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'forget_memory',
      success: true,
      result: toForget ? 'forgotten' : 'not_found',
    }, { skipDebugLog: true });

    res.json({
      success: true,
      message: toForget
        ? `I've forgotten that. I won't bring it up again.`
        : `I'll make sure not to reference that.`,
    });
  } catch (error) {
    logger.error({ error }, 'Error forgetting memory');
    res.status(500).json({ error: 'Failed to forget memory' });
  }
});
