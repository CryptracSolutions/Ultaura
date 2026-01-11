// Ephemeral in-memory transcript buffer per call
// Stores distilled turn summaries only; never persisted

export interface TurnSummary {
  timestamp: number;
  speaker: 'user' | 'assistant';
  summary: string;
  intent?: string;
  entities?: string[];
}

export interface EphemeralBuffer {
  callSessionId: string;
  lineId: string;
  accountId: string;
  startTime: number;
  turns: TurnSummary[];
  storedKeys: Set<string>;
  consentGrantedAtTurnIndex: number | null;
}

const buffers = new Map<string, EphemeralBuffer>();

const MAX_BUFFER_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const MAX_TURNS = 200;

export function createBuffer(callSessionId: string, lineId: string, accountId: string): void {
  buffers.set(callSessionId, {
    callSessionId,
    lineId,
    accountId,
    startTime: Date.now(),
    turns: [],
    storedKeys: new Set(),
    consentGrantedAtTurnIndex: null,
  });
}

export function addTurn(callSessionId: string, turn: TurnSummary): void {
  const buffer = buffers.get(callSessionId);
  if (!buffer) return;

  buffer.turns.push(turn);

  // Auto-prune by count
  while (buffer.turns.length > MAX_TURNS) {
    buffer.turns.shift();
  }

  // Auto-prune by time
  const cutoff = Date.now() - MAX_BUFFER_DURATION_MS;
  while (buffer.turns.length > 0 && buffer.turns[0].timestamp < cutoff) {
    buffer.turns.shift();
  }
}

export function addStoredKey(callSessionId: string, key: string): void {
  const buffer = buffers.get(callSessionId);
  if (buffer) {
    buffer.storedKeys.add(key.toLowerCase());
  }
}

export function markConsentGranted(callSessionId: string): void {
  const buffer = buffers.get(callSessionId);
  if (!buffer) return;

  if (buffer.consentGrantedAtTurnIndex === null) {
    buffer.consentGrantedAtTurnIndex = buffer.turns.length;
  }
}

export function getBuffer(callSessionId: string): EphemeralBuffer | null {
  return buffers.get(callSessionId) || null;
}

export function clearBuffer(callSessionId: string): EphemeralBuffer | null {
  const buffer = buffers.get(callSessionId);
  buffers.delete(callSessionId);
  return buffer || null;
}
