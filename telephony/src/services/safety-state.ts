import type { SafetyTier } from '@ultaura/types';

type SafetySource = 'keyword_backstop' | 'model';

export interface SafetyState {
  triggeredTiers: Set<SafetyTier>;
  backstopTiersTriggered: Set<SafetyTier>;
  modelTiersLogged: Set<SafetyTier>;
  lastDetectionTime: number;
}

const safetyStates = new Map<string, SafetyState>();
const safetySummaryLogged = new Set<string>();

const TIER_ORDER: SafetyTier[] = ['low', 'medium', 'high'];

export function getOrCreateSafetyState(callSessionId: string): SafetyState {
  const existing = safetyStates.get(callSessionId);
  if (existing) {
    return existing;
  }

  const state: SafetyState = {
    triggeredTiers: new Set(),
    backstopTiersTriggered: new Set(),
    modelTiersLogged: new Set(),
    lastDetectionTime: 0,
  };

  safetyStates.set(callSessionId, state);
  return state;
}

export function markSafetyTier(
  callSessionId: string,
  tier: SafetyTier,
  source: SafetySource
): SafetyState {
  const state = getOrCreateSafetyState(callSessionId);
  state.triggeredTiers.add(tier);

  if (source === 'keyword_backstop') {
    state.backstopTiersTriggered.add(tier);
  } else {
    state.modelTiersLogged.add(tier);
  }

  state.lastDetectionTime = Date.now();
  return state;
}

export function wasBackstopTriggered(callSessionId: string, tier?: SafetyTier): boolean {
  const state = safetyStates.get(callSessionId);
  if (!state) return false;

  if (!tier) {
    return state.backstopTiersTriggered.size > 0;
  }

  return state.backstopTiersTriggered.has(tier);
}

export function getSafetySummary(callSessionId: string): {
  backstopTiersTriggered: SafetyTier[];
  modelTiersLogged: SafetyTier[];
  potentialFalsePositives: number;
} {
  const state = safetyStates.get(callSessionId);
  if (!state) {
    return {
      backstopTiersTriggered: [],
      modelTiersLogged: [],
      potentialFalsePositives: 0,
    };
  }

  const backstopTiersTriggered = TIER_ORDER.filter((tier) =>
    state.backstopTiersTriggered.has(tier)
  );
  const modelTiersLogged = TIER_ORDER.filter((tier) =>
    state.modelTiersLogged.has(tier)
  );
  const potentialFalsePositives = backstopTiersTriggered.filter(
    (tier) => !state.modelTiersLogged.has(tier)
  ).length;

  return {
    backstopTiersTriggered,
    modelTiersLogged,
    potentialFalsePositives,
  };
}

export function markSafetySummaryLogged(callSessionId: string): boolean {
  if (safetySummaryLogged.has(callSessionId)) {
    return false;
  }

  safetySummaryLogged.add(callSessionId);
  return true;
}

export function clearSafetyState(callSessionId: string): void {
  safetyStates.delete(callSessionId);
}
