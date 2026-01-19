import { activeCalls } from '../utils/metrics.js';

const activeCallSessions = new Set<string>();

function updateActiveCallsGauge(): void {
  activeCalls.set(activeCallSessions.size);
}

export function registerActiveCall(callSessionId: string): void {
  const beforeSize = activeCallSessions.size;
  activeCallSessions.add(callSessionId);
  if (activeCallSessions.size !== beforeSize) {
    updateActiveCallsGauge();
  }
}

export function unregisterActiveCall(callSessionId: string): void {
  const removed = activeCallSessions.delete(callSessionId);
  if (removed) {
    updateActiveCallsGauge();
  }
}

export function getActiveCallCount(): number {
  return activeCallSessions.size;
}

export function getActiveCallSessionIds(): string[] {
  return Array.from(activeCallSessions);
}
