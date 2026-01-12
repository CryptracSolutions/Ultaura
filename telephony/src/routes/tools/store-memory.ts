import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { storeMemory } from '../../services/memory.js';
import { addStoredKey } from '../../services/ephemeral-buffer.js';
import { enforceMemoryConsent } from './memory-guard.js';

export const storeMemoryRouter = Router();

storeMemoryRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      callSessionId,
      lineId,
      memoryType,
      key,
      value,
      confidence = 1.0,
      suggestReminder = false,
      expectedEndDate,
      routineLevel,
    } = req.body as {
      callSessionId?: string;
      lineId?: string;
      memoryType?: string;
      key?: string;
      value?: unknown;
      confidence?: number;
      suggestReminder?: boolean;
      expectedEndDate?: string;
      routineLevel?: 'general' | 'time_specific' | 'day_specific';
    };

    if (!callSessionId || !lineId || !memoryType || !key || !value) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ success: false, error: 'Call session not found' });
      return;
    }

    const accountId = session.account_id;
    const recordFailure = async (errorCode?: string) => {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'store_memory',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    const consent = await enforceMemoryConsent({
      accountId,
      lineId,
      callSessionId,
      toolName: 'store_memory',
    });
    if (!consent.ok) {
      res.json({ success: false, error: consent.error });
      return;
    }

    const result = await storeMemory(accountId, lineId, memoryType as any, key, value, {
      confidence,
      source: 'conversation',
      privacyScope: 'line_only',
      expectedEndDate,
      routineLevel,
    });

    if (!result) {
      await recordFailure();
      res.status(500).json({ success: false, error: 'Failed to store memory' });
      return;
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'store_memory',
      success: true,
      key,
      action: result.action,
      reason: result.reason,
      version: result.version,
    }, { skipDebugLog: true });

    addStoredKey(callSessionId, key);

    const response: {
      success: boolean;
      memoryId: string;
      action: 'created' | 'updated' | 'skipped' | 'excluded';
      reason?: 'duplicate_value' | 'key_updated' | 'topic_excluded' | 'embedding_pending';
      version: number;
      suggestReminder?: boolean;
      message?: string;
      excludedCategory?: string | null;
      embeddingGenerated?: boolean;
      pinned?: boolean;
    } = {
      success: true,
      memoryId: result.memoryId,
      action: result.action,
      version: result.version,
    };

    if (result.reason) {
      response.reason = result.reason;
    }

    if (result.excludedCategory) {
      response.excludedCategory = result.excludedCategory;
    }

    if (result.embeddingGenerated !== undefined) {
      response.embeddingGenerated = result.embeddingGenerated;
    }

    if (result.pinned !== undefined) {
      response.pinned = result.pinned;
    }

    if (memoryType === 'follow_up' && suggestReminder && result.action !== 'skipped') {
      response.suggestReminder = true;
      response.message = 'Would you like me to set a reminder about this?';
    }

    res.json(response);
  } catch (error) {
    logger.error({ error }, 'Error storing memory');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
