export type GrokBridgeHandle = {
  setDetectedLanguage: (code: string) => void;
};

const bridges = new Map<string, GrokBridgeHandle>();

export function registerGrokBridge(callSessionId: string, bridge: GrokBridgeHandle): void {
  bridges.set(callSessionId, bridge);
}

export function unregisterGrokBridge(callSessionId: string): void {
  bridges.delete(callSessionId);
}

export function getGrokBridge(callSessionId: string): GrokBridgeHandle | undefined {
  return bridges.get(callSessionId);
}
