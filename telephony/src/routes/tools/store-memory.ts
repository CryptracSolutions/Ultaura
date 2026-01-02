import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { storeMemory } from '../../services/memory.js';
import { addStoredKey } from '../../services/ephemeral-buffer.js';

export const storeMemoryRouter = Router();

storeMemoryRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      callSessionId,
      lineId,
      accountId,
      memoryType,
      key,
      value,
      confidence = 1.0,
      suggestReminder = false,
    } = req.body as {
      callSessionId?: string;
      lineId?: string;
      accountId?: string;
      memoryType?: string;
      key?: string;
      value?: string;
      confidence?: number;
      suggestReminder?: boolean;
    };

    if (!callSessionId || !lineId || !accountId || !memoryType || !key || !value) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ success: false, error: 'Call session not found' });
      return;
    }

    const memoryId = await storeMemory(accountId, lineId, memoryType as any, key, value, {
      confidence,
      source: 'conversation',
      privacyScope: 'line_only',
    });

    if (!memoryId) {
      res.status(500).json({ success: false, error: 'Failed to store memory' });
      return;
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'store_memory',
      memoryId,
      key,
      type: memoryType,
    });

    addStoredKey(callSessionId, key);

    const response: {
      success: boolean;
      memoryId: string;
      suggestReminder?: boolean;
      message?: string;
    } = {
      success: true,
      memoryId,
    };

    if (memoryType === 'follow_up' && suggestReminder) {
      response.suggestReminder = true;
      response.message = 'Would you like me to set a reminder about this?';
    }

    res.json(response);
  } catch (error) {
    logger.error({ error }, 'Error storing memory');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
