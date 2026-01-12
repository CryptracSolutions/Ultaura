import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { getMemoriesForLine, storeMemory, updateMemory, searchMemoriesSemantic, markMemoriesAccessed } from '../../services/memory.js';
import type { MemoryType } from '@ultaura/types';
import { addStoredKey } from '../../services/ephemeral-buffer.js';
import { enforceMemoryConsent } from './memory-guard.js';

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
      confirmed,
      clarification,
    } = req.body as {
      callSessionId?: string;
      lineId?: string;
      existingKey?: string;
      newValue?: unknown;
      memoryType?: MemoryType;
      confidence?: number;
      confirmed?: boolean;
      clarification?: string;
    };

    if (!callSessionId || !lineId || !existingKey || newValue == null) {
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
        tool: 'update_memory',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    const consent = await enforceMemoryConsent({
      accountId,
      lineId,
      callSessionId,
      toolName: 'update_memory',
    });
    if (!consent.ok) {
      res.json({ success: false, error: consent.error });
      return;
    }

    const memories = await getMemoriesForLine(accountId, lineId, { limit: 100 });
    const searchKey = (clarification?.trim() || existingKey.trim());
    let existingMemory = memories.find(
      m => m.key.toLowerCase() === searchKey.toLowerCase()
    );
    let matchType: 'exact' | 'semantic' | 'multiple' | 'not_found' = existingMemory ? 'exact' : 'not_found';

    if (!existingMemory) {
      const semanticMatches = await searchMemoriesSemantic(accountId, lineId, searchKey, {
        limit: 3,
        similarityThreshold: 0.8,
      });

      if (semanticMatches.length > 0 && !confirmed) {
        const bestGuess = semanticMatches[0];
        const alternatives = semanticMatches.slice(1, 4).map(match => ({
          id: match.memory.id,
          key: match.memory.key,
          preview: String(match.memory.value ?? '').slice(0, 50),
          similarity: match.similarity,
        }));

        await incrementToolInvocations(callSessionId);
        await recordCallEvent(callSessionId, 'tool_call', {
          tool: 'update_memory',
          success: true,
          matchType: semanticMatches.length > 1 ? 'multiple' : 'semantic',
          result: 'needs_confirmation',
        }, { skipDebugLog: true });

        res.json({
          success: true,
          matchType: semanticMatches.length > 1 ? 'multiple' : 'semantic',
          needsConfirmation: true,
          bestGuess: {
            id: bestGuess.memory.id,
            key: bestGuess.memory.key,
            preview: String(bestGuess.memory.value ?? '').slice(0, 50),
            similarity: bestGuess.similarity,
          },
          alternatives: semanticMatches.length > 1 ? alternatives : undefined,
          confirmationPrompt: `I think you mean "${bestGuess.memory.key}" - is that right?`,
          wrongGuessPrompt: 'Can you tell me a bit more about which one you meant?',
        });
        return;
      }

      if (semanticMatches.length > 0) {
        existingMemory = semanticMatches[0].memory;
        matchType = semanticMatches.length > 1 ? 'multiple' : 'semantic';
        await markMemoriesAccessed([existingMemory.id]);
      }
    }

    if (!existingMemory) {
      logger.info({ key: existingKey }, 'No existing memory found, creating new');
      const result = await storeMemory(accountId, lineId, (memoryType ?? 'fact') as MemoryType, existingKey, newValue, {
        confidence,
        source: 'conversation',
        privacyScope: 'line_only',
      });

      if (!result) {
        await recordFailure();
        res.status(500).json({ success: false, error: 'Failed to store memory' });
        return;
      }

      await incrementToolInvocations(callSessionId);
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'update_memory',
        success: true,
        key: existingKey,
        action: result.action,
        reason: result.reason,
        version: result.version,
        matchType: 'not_found',
      }, { skipDebugLog: true });

      addStoredKey(callSessionId, existingKey);

      res.json({
        success: true,
        memoryId: result.memoryId,
        action: result.action,
        reason: result.reason,
        version: result.version,
      });
      return;
    }

    const updated = await updateMemory(
      accountId,
      lineId,
      existingMemory.id,
      newValue,
      existingMemory
    );

    if (!updated) {
      await recordFailure();
      res.status(500).json({ success: false, error: 'Failed to update memory' });
      return;
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'update_memory',
      success: true,
      key: existingKey,
      action: updated.action,
      reason: updated.reason,
      version: updated.version,
      matchType: matchType === 'not_found' ? 'exact' : matchType,
    }, { skipDebugLog: true });

    addStoredKey(callSessionId, existingKey);

    logger.info({ key: existingKey, callSessionId, action: updated.action }, 'Memory update processed');

    res.json({
      success: true,
      memoryId: updated.memoryId,
      action: updated.action,
      reason: updated.reason,
      version: updated.version,
      matchType: matchType === 'not_found' ? 'exact' : matchType,
    });
  } catch (error) {
    logger.error({ error }, 'Error updating memory');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
