import { Counter, Histogram } from 'prom-client';
import { registry } from '../utils/metrics.js';

export type ClassifierReason = 'high_verify' | 'periodic_sweep' | 'soft_signal';
export type ClassifierResult = 'ok' | 'error' | 'timeout';
export type ClassifierTriggerSource = 'model' | 'sweep' | 'keyword' | 'heuristic';
export type VerifierSource = 'model' | 'keyword_backstop' | 'sweep' | 'soft_signal';
export type VerifierDecision = 'confirm' | 'clear' | 'uncertain';
export type NotificationBlockReason =
  | 'verifier_clear'
  | 'uncertain'
  | 'rate_limited'
  | 'no_consent'
  | 'no_contacts';

export const safetyClassifierRunsTotal = new Counter({
  name: 'ultaura_safety_classifier_runs_total',
  help: 'Total safety classifier runs',
  labelNames: ['reason', 'result'],
  registers: [registry],
});

export const safetyClassifierTriggersTotal = new Counter({
  name: 'ultaura_safety_classifier_triggers_total',
  help: 'Total safety classifier triggers',
  labelNames: ['source', 'tier'],
  registers: [registry],
});

export const safetyVerifierDisagreementsTotal = new Counter({
  name: 'ultaura_safety_verifier_disagreements_total',
  help: 'Total verifier disagreements with initial assessment',
  labelNames: ['source', 'initial_tier', 'verifier'],
  registers: [registry],
});

export const safetyNotificationsBlockedTotal = new Counter({
  name: 'ultaura_safety_notifications_blocked_total',
  help: 'Total safety notifications blocked',
  labelNames: ['reason'],
  registers: [registry],
});

export const safetyNotificationsSentTotal = new Counter({
  name: 'ultaura_safety_notifications_sent_total',
  help: 'Total safety notifications sent',
  labelNames: ['channel', 'tier'],
  registers: [registry],
});

export const safetyClassifierLatencyMs = new Histogram({
  name: 'ultaura_safety_classifier_latency_ms',
  help: 'Safety classifier latency in milliseconds',
  labelNames: ['reason'],
  buckets: [100, 250, 500, 1000, 2000, 3000, 5000],
  registers: [registry],
});

export const safetyVerifierLatencyMs = new Histogram({
  name: 'ultaura_safety_verifier_latency_ms',
  help: 'Safety verifier latency in milliseconds',
  buckets: [50, 100, 250, 500, 1000, 1500],
  registers: [registry],
});

export function incrementClassifierRuns(reason: ClassifierReason, result: ClassifierResult): void {
  safetyClassifierRunsTotal.inc({ reason, result });
}

export function incrementClassifierTriggers(
  reason: ClassifierReason,
  sourceOverride?: ClassifierTriggerSource
): void {
  const source = sourceOverride ?? (reason === 'periodic_sweep'
    ? 'sweep'
    : reason === 'high_verify'
      ? 'model'
      : 'heuristic');
  safetyClassifierTriggersTotal.inc({ source, tier: 'high' });
}

export function incrementVerifierDisagreements(
  source: VerifierSource,
  verifier: VerifierDecision
): void {
  safetyVerifierDisagreementsTotal.inc({ source, initial_tier: 'high', verifier });
}

export function incrementNotificationsBlocked(reason: NotificationBlockReason): void {
  safetyNotificationsBlockedTotal.inc({ reason });
}

export function incrementNotificationsSent(channel: 'sms' | 'email', tier: 'high'): void {
  safetyNotificationsSentTotal.inc({ channel, tier });
}

export function observeClassifierLatency(reason: ClassifierReason, latencyMs: number): void {
  safetyClassifierLatencyMs.observe({ reason }, latencyMs);
}

export function observeVerifierLatency(latencyMs: number): void {
  safetyVerifierLatencyMs.observe(latencyMs);
}
