import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { getMemoriesForLine, storeMemory, updateMemory } from '../../services/memory.js';
import { addStoredKey } from '../../services/ephemeral-buffer.js';

export const updateMemoryRouter = Router();

updateMemoryRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      callSessionId,
      lineId,
      existingKey,
      newValue,
      memoryType = 'fact',
      confidence = 1.0,
    } = req.body as {
      callSessionId?: string;
      lineId?: string;
      existingKey?: string;
      newValue?: string;
      memoryType?: string;
      confidence?: number;
    };

    if (!callSessionId || !lineId || !existingKey || !newValue) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ success: false, error: 'Call session not found' });
      return;
    }

    const accountId = session.account_id;

    const memories = await getMemoriesForLine(accountId, lineId, { limit: 100 });
    const existingMemory = memories.find(
      m => m.key.toLowerCase() === existingKey.toLowerCase()
    );

    if (!existingMemory) {
      logger.info({ key: existingKey }, 'No existing memory found, creating new');
      const memoryId = await storeMemory(accountId, lineId, memoryType as any, existingKey, newValue, {
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
        tool: 'update_memory',
        key: existingKey,
        action: 'created',
        newValue,
      });

      addStoredKey(callSessionId, existingKey);

      res.json({
        success: true,
        memoryId,
        action: 'created',
      });
      return;
    }

    const updatedId = await updateMemory(accountId, lineId, existingMemory.id, newValue);

    if (!updatedId) {
      res.status(500).json({ success: false, error: 'Failed to update memory' });
      return;
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'update_memory',
      key: existingKey,
      previousValue: existingMemory.value,
      newValue,
    });

    addStoredKey(callSessionId, existingKey);

    logger.info({ key: existingKey, callSessionId }, 'Memory updated');

    res.json({
      success: true,
      memoryId: updatedId,
      action: 'updated',
    });
  } catch (error) {
    logger.error({ error }, 'Error updating memory');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
