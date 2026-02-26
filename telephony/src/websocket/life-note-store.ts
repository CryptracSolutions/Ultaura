export interface LifeNotePayload {
  note: string;
  authorName: string;
  relationship: string | null;
}

interface LifeNoteEntry {
  value: LifeNotePayload;
  expiresAt: number;
}

const LIFE_NOTE_TTL_MS = 5 * 60_000;
const CLEANUP_INTERVAL_MS = 60_000;
const lifeNotesBySessionId = new Map<string, LifeNoteEntry>();

function cleanupExpiredLifeNotes(): void {
  const now = Date.now();
  for (const [sessionId, entry] of lifeNotesBySessionId.entries()) {
    if (entry.expiresAt <= now) {
      lifeNotesBySessionId.delete(sessionId);
    }
  }
}

const cleanupInterval = setInterval(cleanupExpiredLifeNotes, CLEANUP_INTERVAL_MS);
cleanupInterval.unref();

export function setLifeNoteForCallSession(callSessionId: string, value: LifeNotePayload): void {
  cleanupExpiredLifeNotes();
  lifeNotesBySessionId.set(callSessionId, {
    value,
    expiresAt: Date.now() + LIFE_NOTE_TTL_MS,
  });
}

export function takeLifeNoteForCallSession(callSessionId: string): LifeNotePayload | null {
  const entry = lifeNotesBySessionId.get(callSessionId);
  if (!entry) {
    return null;
  }

  lifeNotesBySessionId.delete(callSessionId);
  if (entry.expiresAt <= Date.now()) {
    return null;
  }

  return entry.value;
}

export function clearLifeNoteForCallSession(callSessionId: string): void {
  lifeNotesBySessionId.delete(callSessionId);
}
