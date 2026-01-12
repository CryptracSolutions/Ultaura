import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { getMemoriesForLine, forgetMemory, hardDeleteMemoryByKey } from '../../services/memory.js';
import { getSupabaseClient } from '../../utils/supabase.js';

export const forgetMemoryRouter = Router();

forgetMemoryRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId, whatToForget, permanent } = req.body;

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
      if (permanent === true) {
        const deletedCount = await hardDeleteMemoryByKey(accountId, lineId, toForget.key);

        if (deletedCount === null) {
          await recordFailure('hard_delete_failed');
          res.status(500).json({ error: 'Failed to delete memory' });
          return;
        }

        const supabase = getSupabaseClient();
        const { error: auditError } = await supabase
          .from('ultaura_consent_audit_log')
          .insert({
            account_id: accountId,
            line_id: lineId,
            actor_type: 'line_voice',
            action: 'memory_hard_deleted',
            consent_type: 'data_retention',
            old_value: { key: toForget.key, count: deletedCount },
            call_session_id: callSessionId,
            metadata: { trigger: 'voice_tool' },
          });

        if (auditError) {
          logger.error({ error: auditError, lineId, memoryKey: toForget.key }, 'Failed to log memory hard delete');
        }

        logger.info({ lineId, memoryKey: toForget.key, deletedCount }, 'Memory hard deleted');
      } else {
        await forgetMemory(accountId, lineId, toForget.id);
        logger.info({ lineId, memoryId: toForget.id, key: toForget.key }, 'Memory forgotten');
      }
    } else {
      logger.info({ lineId }, 'No matching memory found to forget');
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'forget_memory',
      success: true,
      result: toForget ? (permanent === true ? 'hard_deleted' : 'forgotten') : 'not_found',
    }, { skipDebugLog: true });

    res.json({
      success: true,
      message: toForget
        ? permanent === true
          ? `I've permanently erased that.`
          : `I've forgotten that. I won't bring it up again.`
        : `I'll make sure not to reference that.`,
    });
  } catch (error) {
    logger.error({ error }, 'Error forgetting memory');
    res.status(500).json({ error: 'Failed to forget memory' });
  }
});
