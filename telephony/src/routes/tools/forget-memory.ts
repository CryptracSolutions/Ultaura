import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import {
  findFuzzyMatches,
  forgetMemory,
  hardDeleteMemoryByKey,
  logMemoryDeactivation,
  markMemoriesAccessed,
  searchMemoriesSemantic,
} from '../../services/memory.js';
import { getSupabaseClient } from '../../utils/supabase.js';

export const forgetMemoryRouter = Router();

forgetMemoryRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId, whatToForget, permanent, confirmed, clarification } = req.body as {
      callSessionId?: string;
      lineId?: string;
      whatToForget?: string;
      permanent?: boolean;
      confirmed?: boolean;
      clarification?: string;
    };

    if (!callSessionId || !lineId || !whatToForget) {
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

    const trimmedQuery = (clarification?.trim() || whatToForget.trim());
    const bulkRequested = /\b(all|everything|anything)\b/i.test(trimmedQuery);

    const semanticMatches = await searchMemoriesSemantic(accountId, lineId, trimmedQuery, {
      limit: 5,
      similarityThreshold: Number.parseFloat(process.env.ULTAURA_EMBEDDING_SIMILARITY_THRESHOLD || '0.7'),
    });

    if (semanticMatches.length > 0) {
      await markMemoriesAccessed(semanticMatches.map(match => match.memory.id));
    }

    let matches = semanticMatches;
    let matchType: 'exact' | 'semantic' | 'multiple' | 'not_found' = 'not_found';

    if (matches.length === 0) {
      matches = await findFuzzyMatches(accountId, lineId, trimmedQuery, { limit: 50 });
      if (matches.length === 1) {
        matchType = 'exact';
      } else if (matches.length > 1) {
        matchType = 'multiple';
      }
    } else if (matches.length === 1) {
      matchType = 'semantic';
    } else {
      matchType = 'multiple';
    }

    const previewFor = (memory: { value: unknown }): string => {
      const raw = String(memory.value ?? '');
      return raw.length > 50 ? `${raw.slice(0, 50)}...` : raw;
    };

    if (matches.length === 0) {
      logger.info({ lineId }, 'No matching memory found to forget');
      await incrementToolInvocations(callSessionId);
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'forget_memory',
        success: true,
        result: 'not_found',
        matchType,
      }, { skipDebugLog: true });

      res.json({
        success: true,
        matchType,
        message: `I'll make sure not to reference that.`,
      });
      return;
    }

    if (!confirmed) {
      const alternatives = matches.map(match => ({
        id: match.memory.id,
        key: match.memory.key,
        preview: previewFor(match.memory),
        similarity: match.similarity,
      }));

      const bestGuess = matches[0];
      const confirmationPrompt = bulkRequested
        ? `Are you sure you don't want to speak about "${trimmedQuery}" anymore?`
        : matches.length > 1
          ? `I think you mean "${bestGuess.memory.key}" - is that right?`
          : `I think you mean "${bestGuess.memory.key}" - is that right?`;

      await incrementToolInvocations(callSessionId);
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'forget_memory',
        success: true,
        result: 'needs_confirmation',
        matchType: matches.length > 1 ? 'multiple' : matchType,
      }, { skipDebugLog: true });

      res.json({
        success: true,
        matchType: matches.length > 1 ? 'multiple' : matchType,
        matchedMemory: matches.length >= 1 ? {
          id: bestGuess.memory.id,
          key: bestGuess.memory.key,
          preview: previewFor(bestGuess.memory),
          similarity: bestGuess.similarity,
        } : undefined,
        alternatives: matches.length > 1 ? alternatives : undefined,
        needsConfirmation: true,
        confirmationPrompt,
        wrongGuessPrompt: 'Can you tell me a bit more about which one you meant?',
      });
      return;
    }

    const targets = bulkRequested && matches.length > 1 ? matches.map(match => match.memory) : [matches[0].memory];
    const bulkDeletion = targets.length > 1;

    if (permanent === true) {
      const supabase = getSupabaseClient();
      const keys = Array.from(new Set(targets.map(target => target.key)));
      let deletedTotal = 0;

      for (const key of keys) {
        const { data: toDelete } = await supabase
          .from('ultaura_memories')
          .select('id, key, confidence')
          .eq('account_id', accountId)
          .eq('line_id', lineId)
          .ilike('key', key);

        const deletedCount = await hardDeleteMemoryByKey(accountId, lineId, key);

        if (deletedCount === null) {
          await recordFailure('hard_delete_failed');
          res.status(500).json({ error: 'Failed to delete memory' });
          return;
        }

        deletedTotal += deletedCount;

        if (toDelete) {
          const reason = bulkDeletion || toDelete.length > 1 ? 'user_request_bulk' : 'user_request';
          for (const memory of toDelete) {
            await logMemoryDeactivation({
              memoryId: memory.id,
              memoryKey: memory.key,
              lineId,
              accountId,
              reason,
              confidence: memory.confidence ?? null,
              callSessionId,
              metadata: { permanent: true, bulk: bulkDeletion },
            });
          }
        }
      }

      const oldValue = keys.length === 1
        ? { key: keys[0], keys, count: deletedTotal }
        : { keys, count: deletedTotal };

      const { error: auditError } = await supabase
        .from('ultaura_consent_audit_log')
        .insert({
          account_id: accountId,
          line_id: lineId,
          actor_type: 'line_voice',
          action: 'memory_hard_deleted',
          consent_type: 'data_retention',
          old_value: oldValue,
          call_session_id: callSessionId,
          metadata: { trigger: 'voice_tool' },
        });

      if (auditError) {
        logger.error({ error: auditError, lineId, keys }, 'Failed to log memory hard delete');
      }

      logger.info({ lineId, keys, deletedTotal }, 'Memory hard deleted');
    } else {
      for (const target of targets) {
        await forgetMemory(accountId, lineId, target.id);
        const reason = bulkDeletion
          ? 'user_request_bulk'
          : (target.type === 'temporal' && target.expiryPending ? 'temporal_expiry' : 'user_request');
        await logMemoryDeactivation({
          memoryId: target.id,
          memoryKey: target.key,
          lineId,
          accountId,
          reason,
          confidence: target.confidence ?? null,
          callSessionId,
        });
        logger.info({ lineId, memoryId: target.id, key: target.key }, 'Memory forgotten');
      }
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'forget_memory',
      success: true,
      result: permanent === true ? 'hard_deleted' : 'forgotten',
      matchType,
    }, { skipDebugLog: true });

    res.json({
      success: true,
      matchType,
      message: permanent === true
        ? `I've permanently erased that.`
        : `I've forgotten that. I won't bring it up again.`,
    });
  } catch (error) {
    logger.error({ error }, 'Error forgetting memory');
    res.status(500).json({ error: 'Failed to forget memory' });
  }
});
