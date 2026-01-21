import type { SafetyCategory, SafetyTier } from '@ultaura/types';
import { SAFETY_CATEGORY_TIERS } from '@ultaura/types';
import type { TurnSummary } from './ephemeral-buffer.js';
import { getBuffer } from './ephemeral-buffer.js';
import {
  getCallSession,
  recordCallEvent,
  recordSafetyEvent,
  updateSafetyEventSignals,
} from './call-session.js';
import { logger } from '../utils/logger.js';
import { notifyTrustedContacts } from './safety-notifications.js';
import { runModerationCheck, runLLMClassifier, verifyHighTierEvent } from './safety-verifier.js';
import {
  incrementClassifierRuns,
  incrementClassifierTriggers,
  incrementNotificationsBlocked,
  observeClassifierLatency,
  type ClassifierTriggerSource,
} from './safety-metrics.js';
import { getGrokBridge } from '../websocket/grok-bridge-registry.js';
import { sendRoutingAlert } from './routing-alerts.js';
import { voiceRoutingIssuesTotal } from '../utils/metrics.js';

export interface ClassifierJob {
  id: string;
  callSessionId: string;
  lineId: string;
  languageCode: string;
  reason: 'high_verify' | 'periodic_sweep' | 'soft_signal';
  contextWindow: ContextWindow;
  enqueuedAt: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  safetyEventId?: string;
}

export interface ContextWindow {
  turns: TurnSummary[];
  totalChars: number;
  totalTurns: number;
  windowStartMs: number;
  windowEndMs: number;
}

export interface ClassifierResult {
  category: SafetyCategory;
  tier: SafetyTier | null;
  confidence: number;
  actionTaken: 'none' | 'suggested_988' | 'suggested_911';
  signals: {
    imminent_risk: boolean;
    has_plan_or_means: boolean;
    rationale_codes: string[];
  };
}

const MAX_QUEUE_SIZE = 50;
const MAX_CONCURRENT_JOBS = 3;
const CONTEXT_WINDOW_MAX_TURNS = 12;
const CONTEXT_WINDOW_MAX_CHARS = 2000;
const CONTEXT_WINDOW_DURATION_MS = 120_000;
const CLASSIFIER_JOB_TIMEOUT_MS = 5000;
const SAFETY_HINT_COOLDOWN_MS = 60_000;

type JobKind = 'verify' | 'sweep';

const jobQueue: Map<string, ClassifierJob> = new Map();
const pendingJobs: Map<string, Set<string>> = new Map();
const hintCooldowns: Map<string, number> = new Map();
let activeJobCount = 0;

function getJobKind(reason: ClassifierJob['reason']): JobKind {
  return reason === 'high_verify' ? 'verify' : 'sweep';
}

function shouldUpgradeSweepJob(existing: ClassifierJob, incoming: ClassifierJob['reason']): boolean {
  return existing.reason === 'periodic_sweep' && incoming === 'soft_signal';
}

function removeJob(jobId: string): void {
  const job = jobQueue.get(jobId);
  jobQueue.delete(jobId);
  if (!job) return;
  const sessionJobs = pendingJobs.get(job.callSessionId);
  if (sessionJobs) {
    sessionJobs.delete(jobId);
    if (sessionJobs.size === 0) pendingJobs.delete(job.callSessionId);
  }
}

export function buildContextWindow(
  turns: TurnSummary[],
  maxTurns: number = CONTEXT_WINDOW_MAX_TURNS,
  maxChars: number = CONTEXT_WINDOW_MAX_CHARS,
  windowDurationMs: number = CONTEXT_WINDOW_DURATION_MS
): ContextWindow {
  const now = Date.now();
  const cutoffTime = now - windowDurationMs;

  const recentTurns = turns.filter((t) => t.timestamp >= cutoffTime);
  const windowTurns = recentTurns.slice(-maxTurns);

  let totalChars = 0;
  const truncatedTurns: TurnSummary[] = [];

  for (let i = windowTurns.length - 1; i >= 0 && totalChars < maxChars; i--) {
    const turn = windowTurns[i];
    const turnChars = turn.summary.length;
    if (totalChars + turnChars <= maxChars) {
      truncatedTurns.unshift(turn);
      totalChars += turnChars;
    } else {
      const remaining = maxChars - totalChars;
      truncatedTurns.unshift({
        ...turn,
        summary: turn.summary.slice(0, remaining),
      });
      totalChars = maxChars;
      break;
    }
  }

  return {
    turns: truncatedTurns,
    totalChars,
    totalTurns: truncatedTurns.length,
    windowStartMs: truncatedTurns[0]?.timestamp ?? now,
    windowEndMs: truncatedTurns[truncatedTurns.length - 1]?.timestamp ?? now,
  };
}

export function enqueueClassifierJob(
  callSessionId: string,
  lineId: string,
  languageCode: string,
  reason: ClassifierJob['reason'],
  contextWindow: ContextWindow,
  safetyEventId?: string,
  triggerSource?: ClassifierTriggerSource
): string | null {
  if (!contextWindow.turns.length) {
    return null;
  }

  const sessionJobs = pendingJobs.get(callSessionId) || new Set<string>();
  const jobKind = getJobKind(reason);
  const existingJob = Array.from(sessionJobs).find((id) => {
    const job = jobQueue.get(id);
    return job
      && getJobKind(job.reason) === jobKind
      && (job.status === 'pending' || job.status === 'processing');
  });

  if (existingJob) {
    const job = jobQueue.get(existingJob);
    if (job && shouldUpgradeSweepJob(job, reason)) {
      if (job.status === 'pending') {
        job.reason = 'soft_signal';
        job.contextWindow = contextWindow;
        job.languageCode = languageCode;
        job.lineId = lineId;
        job.enqueuedAt = Date.now();
        incrementClassifierTriggers(reason, triggerSource);
        logger.info(
          { callSessionId, from: 'periodic_sweep', to: 'soft_signal' },
          'Upgraded classifier job to soft signal'
        );
        return existingJob;
      }

      if (job.status === 'processing') {
        logger.info(
          { callSessionId, existing: job.reason, incoming: reason },
          'Scheduling additional soft-signal classifier job after sweep started'
        );
      } else {
        logger.debug({ callSessionId, reason }, 'Deduplicated classifier job');
        return existingJob;
      }
    } else {
      logger.debug({ callSessionId, reason }, 'Deduplicated classifier job');
      return existingJob;
    }
  }

  if (jobQueue.size >= MAX_QUEUE_SIZE) {
    const oldestId = jobQueue.keys().next().value as string | undefined;
    if (oldestId) {
      removeJob(oldestId);
      logger.warn({ droppedJobId: oldestId }, 'Dropped oldest classifier job due to queue full');
    }
  }

  const jobId = `${callSessionId}-${reason}-${Date.now()}`;
  const job: ClassifierJob = {
    id: jobId,
    callSessionId,
    lineId,
    languageCode,
    reason,
    contextWindow,
    enqueuedAt: Date.now(),
    status: 'pending',
    safetyEventId,
  };

  jobQueue.set(jobId, job);
  sessionJobs.add(jobId);
  pendingJobs.set(callSessionId, sessionJobs);

  incrementClassifierTriggers(reason, triggerSource);

  processNextJob().catch((error) => {
    logger.error({ error }, 'Error processing classifier job');
  });

  return jobId;
}

async function processNextJob(): Promise<void> {
  if (activeJobCount >= MAX_CONCURRENT_JOBS) {
    return;
  }

  const nextJob = Array.from(jobQueue.values()).find((job) => job.status === 'pending');
  if (!nextJob) {
    return;
  }

  nextJob.status = 'processing';
  activeJobCount++;
  const startTime = Date.now();
  const deadlineMs = startTime + CLASSIFIER_JOB_TIMEOUT_MS;

  try {
    const result = await runClassifier(nextJob, deadlineMs);
    nextJob.status = 'completed';
    observeClassifierLatency(nextJob.reason, Date.now() - startTime);
    incrementClassifierRuns(nextJob.reason, 'ok');

    if (result && isHighTierResult(result)) {
      await handleHighTierResult(nextJob, result);
    }
  } catch (error) {
    nextJob.status = 'failed';
    const message = error instanceof Error ? error.message : String(error);
    const result = message.includes('timeout') ? 'timeout' : 'error';
    incrementClassifierRuns(nextJob.reason, result);
    logger.error({ error, jobId: nextJob.id }, 'Classifier job failed');
  } finally {
    activeJobCount--;
    removeJob(nextJob.id);
    processNextJob().catch((error) => {
      logger.error({ error }, 'Error processing next classifier job');
    });
  }
}

function isHighTierResult(result: ClassifierResult): boolean {
  const tier = result.category === 'GENERAL_CONCERN'
    ? result.tier
    : SAFETY_CATEGORY_TIERS[result.category];
  return tier === 'high';
}

async function runClassifier(
  job: ClassifierJob,
  deadlineMs: number
): Promise<ClassifierResult | null> {
  const contextText = job.contextWindow.turns
    .map((t) => `${t.speaker}: ${t.summary}`)
    .join('\n');

  const moderationTimeout = Math.max(0, Math.min(1000, deadlineMs - Date.now()));
  if (moderationTimeout === 0) {
    throw new Error('classifier_timeout');
  }

  const moderationResult = await runModerationCheck(
    contextText,
    job.languageCode,
    moderationTimeout
  );

  if (job.reason === 'periodic_sweep' && !moderationResult.flagged) {
    return null;
  }

  if (Date.now() >= deadlineMs) {
    throw new Error('classifier_timeout');
  }

  return runLLMClassifier(contextText, job.languageCode, moderationResult, deadlineMs);
}

async function handleHighTierResult(
  job: ClassifierJob,
  result: ClassifierResult
): Promise<void> {
  if (job.reason === 'high_verify') {
    if (!job.safetyEventId) return;
    await updateSafetyEventSignals(job.safetyEventId, {
      imminent_risk: result.signals.imminent_risk,
      has_plan_or_means: result.signals.has_plan_or_means,
      rationale_codes: result.signals.rationale_codes,
      context_window_stats: {
        turns: job.contextWindow.totalTurns,
        chars: job.contextWindow.totalChars,
      },
    });
    return;
  }

  const source = job.reason === 'periodic_sweep' ? 'sweep' : 'soft_signal';
  maybeSendSafetyHint(job.callSessionId, source);

  const contextText = job.contextWindow.turns
    .map((t) => `${t.speaker}: ${t.summary}`)
    .join('\n')
    .slice(0, CONTEXT_WINDOW_MAX_CHARS);

  const verifierResult = await verifyHighTierEvent({
    callSessionId: job.callSessionId,
    contextWindowText: contextText,
    languageCode: job.languageCode,
    category: result.category === 'GENERAL_CONCERN' ? undefined : result.category,
    source,
  });

  const logContext = {
    callSessionId: job.callSessionId,
    lineId: job.lineId,
    language_code: job.languageCode,
    trigger_reason: job.reason,
    context_window_stats: {
      turns: job.contextWindow.totalTurns,
      chars: job.contextWindow.totalChars,
    },
    latency_ms: verifierResult.latencyMs,
    verifier_result: verifierResult.decision,
  };

  if (verifierResult.decision !== 'confirm') {
    const blockReason = verifierResult.decision === 'clear' ? 'verifier_clear' : 'uncertain';
    incrementNotificationsBlocked(blockReason);
    await recordCallEvent(job.callSessionId, 'state_change', {
      event: 'safety_verifier_blocked',
      action: verifierResult.decision,
      source: job.reason,
    });
    logger.info(logContext, 'Safety verifier blocked notification');
    return;
  }

  logger.info(logContext, 'Safety verifier confirmed notification');

  const accountId = getBuffer(job.callSessionId)?.accountId
    ?? (await getCallSession(job.callSessionId))?.account_id;

  if (!accountId) {
    logger.warn({ callSessionId: job.callSessionId }, 'Classifier could not resolve account for safety event');
    return;
  }

  const effectiveTier = result.category === 'GENERAL_CONCERN'
    ? result.tier
    : SAFETY_CATEGORY_TIERS[result.category];

  if (effectiveTier !== 'high') {
    return;
  }

  const safetyEventId = await recordSafetyEvent({
    accountId,
    lineId: job.lineId,
    callSessionId: job.callSessionId,
    tier: 'high',
    category: result.category,
    confidence: result.confidence,
    signals: {
      source,
      verifier_result: verifierResult.decision,
      verifier_latency_ms: verifierResult.latencyMs,
      imminent_risk: result.signals.imminent_risk,
      has_plan_or_means: result.signals.has_plan_or_means,
      rationale_codes: result.signals.rationale_codes,
      context_window_stats: {
        turns: job.contextWindow.totalTurns,
        chars: job.contextWindow.totalChars,
      },
    },
    actionTaken: result.actionTaken,
  });

  if (!safetyEventId) {
    return;
  }

  await notifyTrustedContacts({
    accountId,
    callSessionId: job.callSessionId,
    lineId: job.lineId,
    tier: 'high',
    actionTaken: result.actionTaken,
  });
}

function maybeSendSafetyHint(callSessionId: string, source: 'sweep' | 'soft_signal'): void {
  const now = Date.now();
  const lastSent = hintCooldowns.get(callSessionId) ?? 0;
  if (now - lastSent < SAFETY_HINT_COOLDOWN_MS) {
    return;
  }

  const bridge = getGrokBridge(callSessionId);
  if (!bridge) {
    voiceRoutingIssuesTotal.inc({ issue: 'bridge_missing_for_tool' });
    void sendRoutingAlert({
      callSessionId,
      issue: 'bridge_missing_for_tool',
      severity: 'high',
      details: {
        tool: 'safety_classifier',
        hintSource: source,
        podName: process.env.HOSTNAME,
      },
    });
    return;
  }

  bridge.sendSafetyAssessmentHint(source);
  hintCooldowns.set(callSessionId, now);
}

export function clearJobsForSession(callSessionId: string): void {
  const sessionJobs = pendingJobs.get(callSessionId);
  if (sessionJobs) {
    for (const jobId of sessionJobs) {
      jobQueue.delete(jobId);
    }
    pendingJobs.delete(callSessionId);
  }
  hintCooldowns.delete(callSessionId);
}
