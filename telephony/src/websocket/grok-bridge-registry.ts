import type { GrokBridge } from './grok-bridge.js';

const bridges = new Map<string, GrokBridge>();

export function registerGrokBridge(callSessionId: string, bridge: GrokBridge): void {
  bridges.set(callSessionId, bridge);
}

export function unregisterGrokBridge(callSessionId: string): void {
  bridges.delete(callSessionId);
}

export function getGrokBridge(callSessionId: string): GrokBridge | undefined {
  return bridges.get(callSessionId);
}
