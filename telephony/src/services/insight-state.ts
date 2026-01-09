import type { TopicCode } from '@ultaura/types';

interface InsightState {
  privateTopics: Set<TopicCode>;
}

const insightStates = new Map<string, InsightState>();

function getOrCreateInsightState(callSessionId: string): InsightState {
  const existing = insightStates.get(callSessionId);
  if (existing) return existing;

  const state: InsightState = {
    privateTopics: new Set(),
  };

  insightStates.set(callSessionId, state);
  return state;
}

export function addPrivateTopic(callSessionId: string, topic: TopicCode): void {
  const state = getOrCreateInsightState(callSessionId);
  state.privateTopics.add(topic);
}

export function getPrivateTopics(callSessionId: string): TopicCode[] {
  const state = insightStates.get(callSessionId);
  if (!state) return [];
  return Array.from(state.privateTopics);
}

export function clearInsightState(callSessionId: string): void {
  insightStates.delete(callSessionId);
}
