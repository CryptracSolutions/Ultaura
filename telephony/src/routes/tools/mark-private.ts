import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { findFuzzyMatches, markMemoriesAccessed, markMemoryPrivate, searchMemoriesSemantic } from '../../services/memory.js';
import { getSupabaseClient } from '../../utils/supabase.js';
import { isHealthSuppressionActive, activateHealthSuppression } from '../../services/health-privacy-state.js';

export const markPrivateRouter = Router();

markPrivateRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId, whatToKeepPrivate, confirmed, clarification } = req.body as {
      callSessionId?: string;
      lineId?: string;
      whatToKeepPrivate?: string;
      confirmed?: boolean;
      clarification?: string;
    };

    if (!callSessionId || !lineId || !whatToKeepPrivate) {
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
        tool: 'mark_private',
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

    const query = (clarification?.trim() || whatToKeepPrivate.trim());

    const semanticMatches = await searchMemoriesSemantic(accountId, lineId, query, {
      limit: 3,
      similarityThreshold: Number.parseFloat(process.env.ULTAURA_EMBEDDING_SIMILARITY_THRESHOLD || '0.7'),
    });

    if (semanticMatches.length > 0) {
      await markMemoriesAccessed(semanticMatches.map(match => match.memory.id));
    }

    let matches = semanticMatches;
    let matchType: 'exact' | 'semantic' | 'multiple' | 'not_found' = 'not_found';

    if (matches.length === 0) {
      matches = await findFuzzyMatches(accountId, lineId, query, { limit: 25 });
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
      logger.info({ lineId }, 'No matching memory found to mark private');

      await incrementToolInvocations(callSessionId);
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'mark_private',
        success: true,
        matchType,
        result: 'not_found',
      }, { skipDebugLog: true });

      res.json({
        success: true,
        matchType,
        message: `Of course, I'll keep that just between us. Your family won't see it.`,
      });
      return;
    }

    if (matches.length > 1 && !confirmed) {
      const bestGuess = matches[0];
      const alternatives = matches.slice(1, 4).map(match => ({
        id: match.memory.id,
        key: match.memory.key,
        preview: previewFor(match.memory),
        similarity: match.similarity,
      }));

      await incrementToolInvocations(callSessionId);
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'mark_private',
        success: true,
        matchType: 'multiple',
        result: 'needs_confirmation',
      }, { skipDebugLog: true });

      res.json({
        success: true,
        matchType: 'multiple',
        needsConfirmation: true,
        bestGuess: {
          id: bestGuess.memory.id,
          key: bestGuess.memory.key,
          preview: previewFor(bestGuess.memory),
          similarity: bestGuess.similarity,
        },
        alternatives,
        confirmationPrompt: `I think you mean "${bestGuess.memory.key}" - is that right?`,
        wrongGuessPrompt: 'Can you tell me a bit more about which one you meant?',
      });
      return;
    }

    const toMark = matches[0].memory;
    await markMemoryPrivate(accountId, lineId, toMark.id);
    logger.info({ lineId, memoryId: toMark.id }, 'Memory marked as private');

    // Health-adjacent auto-suppression: check all 3 criteria from spec Section 8.6
    // Fail closed: if unsure, treat as health-adjacent
    if (!session.is_test_call && !session.is_preview_mode) {
      const alreadySuppressed = await isHealthSuppressionActive(callSessionId);
      if (!alreadySuppressed) {
        const supabase = getSupabaseClient();
        let isHealthAdjacent = false;

        // Criterion 1: health mention categories in this call
        const { data: healthMentions } = await supabase
          .from('ultaura_health_mentions')
          .select('id')
          .eq('call_session_id', callSessionId)
          .limit(1);
        if (healthMentions && healthMentions.length > 0) {
          isHealthAdjacent = true;
        }

        // Criterion 2: call-insight concern/follow-up codes
        if (!isHealthAdjacent) {
          const { data: insights } = await supabase
            .from('ultaura_call_insights')
            .select('insights_ciphertext')
            .eq('call_session_id', callSessionId)
            .limit(1);
          // If any call insight exists for this session, conservatively treat as potentially health-adjacent
          // since we cannot decrypt to check codes here — fail closed
          if (insights && insights.length > 0) {
            isHealthAdjacent = true;
          }
        }

        // Criterion 3: health_medical classifier pattern on the privacy request text
        if (!isHealthAdjacent && whatToKeepPrivate) {
          const HEALTH_MEDICAL_PATTERN = /(medication|medicine|doctor|hospital|surgery|diagnosis|symptom|pain|prescription|illness|disease|treatment|therapy|medical|nurse|clinic|pharmacy|pill|dose|appointment|checkup|blood pressure|diabetes|arthritis|heart|cancer)/i;
          if (HEALTH_MEDICAL_PATTERN.test(whatToKeepPrivate)) {
            isHealthAdjacent = true;
          }
        }

        if (isHealthAdjacent) {
          await activateHealthSuppression(callSessionId, lineId);
          logger.info({ callSessionId, lineId }, 'Health suppression auto-activated from mark_private');
        }
      }
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'mark_private',
      success: true,
      matchType,
    }, { skipDebugLog: true });

    res.json({
      success: true,
      message: `Of course, I'll keep that just between us. Your family won't see it.`,
    });
  } catch (error) {
    logger.error({ error }, 'Error marking memory private');
    res.status(500).json({ error: 'Failed to mark as private' });
  }
});
