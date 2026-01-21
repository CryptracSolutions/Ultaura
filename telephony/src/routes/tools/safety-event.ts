import { Router, Request, Response } from 'express';
import {
  SafetyEventInputSchema,
  type SafetyEventInput,
} from '@ultaura/schemas/telephony';
import { SAFETY_CATEGORY_TIERS } from '@ultaura/types';
import { logger } from '../../server.js';
import {
  getCallSession,
  recordCallEvent,
  recordSafetyEvent,
  updateSafetyEventSignals,
} from '../../services/call-session.js';
import { buildContextWindow, enqueueClassifierJob } from '../../services/safety-classifier.js';
import { getBuffer, type TurnSummary } from '../../services/ephemeral-buffer.js';
import { incrementNotificationsBlocked } from '../../services/safety-metrics.js';
import { notifyTrustedContacts } from '../../services/safety-notifications.js';
import { markSafetyTier, wasBackstopTriggered } from '../../services/safety-state.js';
import { verifyHighTierEvent } from '../../services/safety-verifier.js';
import { getGrokBridge } from '../../websocket/grok-bridge-registry.js';
import { sendRoutingAlert } from '../../services/routing-alerts.js';
import { voiceRoutingIssuesTotal } from '../../utils/metrics.js';

export const safetyEventRouter = Router();

const MAX_VERIFIER_TURNS = 12;
const MAX_VERIFIER_CHARS = 2000;
const VERIFIER_WINDOW_DURATION_MS = 120_000;

function turnKey(turn: TurnSummary): string {
  return `${turn.timestamp}-${turn.speaker}-${turn.summary}`;
}

function getPreviousAssistantTurn(turns: TurnSummary[]): TurnSummary | null {
  if (!turns.length) return null;
  const lastTurn = turns[turns.length - 1];
  if (lastTurn.speaker !== 'user') return null;

  for (let i = turns.length - 2; i >= 0; i--) {
    if (turns[i].speaker === 'assistant') {
      return turns[i];
    }
  }

  return null;
}

function trimContextTurns(
  turns: TurnSummary[],
  requiredKey: string | null
): TurnSummary[] {
  const trimmed = [...turns];
  let totalChars = trimmed.reduce((sum, t) => sum + t.summary.length, 0);

  while (trimmed.length > MAX_VERIFIER_TURNS || totalChars > MAX_VERIFIER_CHARS) {
    let removeIndex = 0;
    if (requiredKey && trimmed.length > 1 && turnKey(trimmed[0]) === requiredKey) {
      removeIndex = 1;
    }

    const removed = trimmed.splice(removeIndex, 1)[0];
    if (removed) {
      totalChars -= removed.summary.length;
    }

    if (trimmed.length === 1 && totalChars > MAX_VERIFIER_CHARS) {
      const remaining = Math.max(0, MAX_VERIFIER_CHARS);
      trimmed[0] = {
        ...trimmed[0],
        summary: trimmed[0].summary.slice(0, remaining),
      };
      totalChars = trimmed[0].summary.length;
      break;
    }
  }

  return trimmed;
}

function buildVerifierContext(turns: TurnSummary[]): { text: string; stats: { turns: number; chars: number } } {
  const cutoffTime = Date.now() - VERIFIER_WINDOW_DURATION_MS;
  const recentTurns = turns.filter((turn) => turn.timestamp >= cutoffTime);
  const baseWindow = buildContextWindow(
    recentTurns,
    MAX_VERIFIER_TURNS,
    MAX_VERIFIER_CHARS
  );
  let windowTurns = [...baseWindow.turns];
  const previousAssistant = getPreviousAssistantTurn(recentTurns);
  let requiredKey: string | null = null;

  if (previousAssistant) {
    requiredKey = turnKey(previousAssistant);
    if (!windowTurns.some((turn) => turnKey(turn) === requiredKey)) {
      windowTurns.push(previousAssistant);
      windowTurns.sort((a, b) => a.timestamp - b.timestamp);
    }
  }

  windowTurns = trimContextTurns(windowTurns, requiredKey);

  const text = windowTurns
    .map((turn) => `${turn.speaker}: ${turn.summary}`)
    .join('\n')
    .slice(0, MAX_VERIFIER_CHARS);
  const chars = windowTurns.reduce((sum, turn) => sum + turn.summary.length, 0);

  return {
    text,
    stats: {
      turns: windowTurns.length,
      chars,
    },
  };
}

safetyEventRouter.post('/', async (req: Request, res: Response) => {
  try {
    const rawBody = req.body as Partial<SafetyEventInput>;
    const parsed = SafetyEventInputSchema.safeParse(rawBody);

    if (!parsed.success) {
      const missingRequired = parsed.error.issues.some((issue) =>
        issue.code === 'invalid_type' && issue.received === 'undefined'
      );
      if (missingRequired) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
      return;
    }

    const {
      callSessionId,
      lineId,
      category,
      tier,
      confidence,
      actionTaken,
      source = 'model',
    } = parsed.data;

    const effectiveTier = category === 'GENERAL_CONCERN'
      ? tier
      : SAFETY_CATEGORY_TIERS[category];

    if (!effectiveTier) {
      res.status(400).json({ error: 'GENERAL_CONCERN requires tier' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    const accountId = session.account_id;

    const sourceValue = source === 'keyword_backstop' ? 'keyword_backstop' : 'model';
    const backstopWasTriggered =
      sourceValue === 'model' ? wasBackstopTriggered(callSessionId, effectiveTier) : false;

    const effectiveConfidence = sourceValue === 'keyword_backstop' ? 1.0 : confidence;

    logger.info({
      event: sourceValue === 'keyword_backstop' ? 'safety_backstop_triggered' : 'safety_model_confirmed',
      callSessionId,
      lineId,
      tier: effectiveTier,
      category,
      confidence: effectiveConfidence,
      source: sourceValue,
      backstopWasTriggered: sourceValue === 'model' ? backstopWasTriggered : undefined,
      timestamp: Date.now(),
    }, `Safety event logged via ${sourceValue}`);

    markSafetyTier(callSessionId, effectiveTier, sourceValue);

    const safetyEventId = await recordSafetyEvent({
      accountId,
      lineId,
      callSessionId,
      tier: effectiveTier,
      category,
      confidence: effectiveConfidence,
      signals: {
        source: sourceValue,
      },
      actionTaken,
    });

    await recordCallEvent(
      callSessionId,
      'tool_call',
      {
        tool: 'log_safety_concern',
        success: true,
        tier: effectiveTier,
        category,
        confidence: effectiveConfidence,
        actionTaken,
      },
      { skipDebugLog: true }
    );

    if (effectiveTier === 'high' && sourceValue === 'model') {
      logger.warn(
        { callSessionId, lineId, tier: effectiveTier, category, actionTaken },
        'HIGH SAFETY TIER EVENT'
      );

      const grokBridge = getGrokBridge(callSessionId);
      if (!grokBridge) {
        voiceRoutingIssuesTotal.inc({ issue: 'bridge_missing_for_tool' });
        void sendRoutingAlert({
          callSessionId,
          issue: 'bridge_missing_for_tool',
          severity: 'high',
          details: {
            tool: 'log_safety_concern',
            podName: process.env.HOSTNAME,
          },
        });
      }

      const languageCode = grokBridge?.getDetectedLanguage() ?? session.language_detected ?? 'unknown';
      const buffer = getBuffer(callSessionId);

      if (process.env.ULTAURA_MULTILINGUAL_SAFETY_ENABLED === 'true' && buffer) {
        const classifierWindow = buildContextWindow(buffer.turns);
        enqueueClassifierJob(
          callSessionId,
          lineId,
          languageCode,
          'high_verify',
          classifierWindow,
          safetyEventId ?? undefined,
          'model'
        );
      }

      void (async () => {
        const contextResult = buffer ? buildVerifierContext(buffer.turns) : null;
        const contextText = contextResult?.text ?? '';
        const contextStats = contextResult?.stats ?? { turns: 0, chars: 0 };

        if (!contextText) {
          if (safetyEventId) {
            await updateSafetyEventSignals(safetyEventId, {
              verifier_result: 'uncertain',
              verifier_latency_ms: 0,
              context_window_stats: contextStats,
            });
          }
          incrementNotificationsBlocked('uncertain');
          return;
        }

        const verifierResult = await verifyHighTierEvent({
          callSessionId,
          contextWindowText: contextText,
          languageCode,
          category: category === 'GENERAL_CONCERN' ? undefined : category,
          source: sourceValue,
        });

        if (safetyEventId) {
          await updateSafetyEventSignals(safetyEventId, {
            verifier_result: verifierResult.decision,
            verifier_latency_ms: verifierResult.latencyMs,
            context_window_stats: contextStats,
          });
        }

        if (verifierResult.decision === 'confirm') {
          await notifyTrustedContacts({
            accountId,
            callSessionId,
            lineId,
            tier: 'high',
            actionTaken,
          });
        } else {
          const blockReason = verifierResult.decision === 'clear' ? 'verifier_clear' : 'uncertain';
          incrementNotificationsBlocked(blockReason);
        }
      })().catch((error) => {
        incrementNotificationsBlocked('uncertain');
        logger.error({ error, callSessionId, lineId }, 'Safety verifier background task failed');
      });
    }

    res.json({ success: true, message: 'Safety concern logged' });
  } catch (error) {
    logger.error({ error }, 'Error logging safety event');
    res.status(500).json({ error: 'Failed to log safety event' });
  }
});
