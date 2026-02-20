import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../services/call-session.js', () => ({
  getCallSession: vi.fn(),
  incrementToolInvocations: vi.fn(),
  recordCallEvent: vi.fn(),
}));

vi.mock('../../../services/memory.js', () => ({
  storeMemory: vi.fn(),
  updateMemory: vi.fn(),
  getMemoriesForLine: vi.fn(),
  forgetMemory: vi.fn(),
  hardDeleteMemoryByKey: vi.fn(),
  findFuzzyMatches: vi.fn(),
  searchMemoriesSemantic: vi.fn(),
  markMemoriesAccessed: vi.fn(),
  markMemoryPrivate: vi.fn(),
  logMemoryDeactivation: vi.fn(),
}));

vi.mock('../../../services/ephemeral-buffer.js', () => ({
  addStoredKey: vi.fn(),
}));

vi.mock('../../../services/privacy.js', () => ({
  updateLineVoiceConsent: vi.fn(),
}));

vi.mock('../../../utils/supabase.js', () => ({
  getSupabaseClient: vi.fn(),
}));

vi.mock('../memory-guard.js', () => ({
  enforceMemoryConsent: vi.fn(),
}));

import { storeMemoryRouter } from '../store-memory.js';
import { updateMemoryRouter } from '../update-memory.js';
import { reviewMemoriesRouter } from '../review-memories.js';
import { forgetMemoryRouter } from '../forget-memory.js';
import { markPrivateRouter } from '../mark-private.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../../services/call-session.js';
import {
  storeMemory,
  updateMemory,
  getMemoriesForLine,
  forgetMemory,
  hardDeleteMemoryByKey,
  findFuzzyMatches,
  searchMemoriesSemantic,
  markMemoriesAccessed,
  markMemoryPrivate,
  logMemoryDeactivation,
} from '../../../services/memory.js';
import { getSupabaseClient } from '../../../utils/supabase.js';
import { enforceMemoryConsent } from '../memory-guard.js';
import {
  createMockRes,
  getPostHandler,
  BASE_SESSION_ID,
  BASE_LINE_ID,
  BASE_ACCOUNT_ID,
  baseSession,
} from './helpers/index.js';

const storeHandler = getPostHandler(storeMemoryRouter);
const updateHandler = getPostHandler(updateMemoryRouter);
const reviewHandler = getPostHandler(reviewMemoriesRouter);
const forgetHandler = getPostHandler(forgetMemoryRouter);
const markPrivateHandler = getPostHandler(markPrivateRouter);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCallSession).mockResolvedValue(baseSession);
  vi.mocked(incrementToolInvocations).mockResolvedValue(undefined);
  vi.mocked(recordCallEvent).mockResolvedValue(undefined);
  vi.mocked(enforceMemoryConsent).mockResolvedValue({ ok: true });

  // Set up supabase mock for forget_memory permanent delete
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.ilike = vi.fn(async () => ({ data: [], error: null }));
  builder.insert = vi.fn(async () => ({ data: null, error: null }));
  const supabaseMock = {
    from: vi.fn(() => builder),
  };
  vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
});

// ---------------------------------------------------------------------------
// store_memory
// ---------------------------------------------------------------------------

describe('store_memory', () => {
  it('happy path - created', async () => {
    vi.mocked(storeMemory).mockResolvedValue({
      memoryId: 'mem-1',
      action: 'created',
      version: 1,
      embeddingGenerated: true,
      pinned: false,
    } as any);

    const res = createMockRes();
    await storeHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID, memoryType: 'fact', key: 'favorite_color', value: 'blue' } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.action).toBe('created');
    expect(res.body.memoryId).toBe('mem-1');
  });

  it('happy path - updated/skipped', async () => {
    vi.mocked(storeMemory).mockResolvedValue({
      memoryId: 'mem-2',
      action: 'skipped',
      version: 2,
      reason: 'duplicate_value',
    } as any);

    const res = createMockRes();
    await storeHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID, memoryType: 'preference', key: 'hobby', value: 'gardening' } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.action).toBe('skipped');
    expect(res.body.reason).toBe('duplicate_value');
  });

  it('missing required fields returns 400', async () => {
    const res = createMockRes();
    await storeHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID } } as any,
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/missing required fields/i);
  });

  it('session not found returns 404', async () => {
    vi.mocked(getCallSession).mockResolvedValue(null as any);

    const res = createMockRes();
    await storeHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID, memoryType: 'fact', key: 'name', value: 'Alice' } } as any,
      res,
    );

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('line mismatch - consent call still uses session account_id (no explicit line check in store)', async () => {
    // store_memory does NOT check lineId === session.line_id; it passes both to storeMemory
    vi.mocked(storeMemory).mockResolvedValue({
      memoryId: 'mem-3',
      action: 'created',
      version: 1,
    } as any);

    const res = createMockRes();
    await storeHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: 'different-line', memoryType: 'fact', key: 'x', value: 'y' } } as any,
      res,
    );

    // Should succeed — store_memory passes lineId from body to storeMemory without checking session.line_id
    expect(res.body.success).toBe(true);
  });

  it('consent rejected returns error', async () => {
    vi.mocked(enforceMemoryConsent).mockResolvedValue({ ok: false, error: 'Memory consent not granted' });

    const res = createMockRes();
    await storeHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID, memoryType: 'fact', key: 'x', value: 'y' } } as any,
      res,
    );

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Memory consent not granted');
  });

  it('suggests reminder when memoryType is follow_up and suggestReminder is true', async () => {
    vi.mocked(storeMemory).mockResolvedValue({
      memoryId: 'mem-4',
      action: 'created',
      version: 1,
    } as any);

    const res = createMockRes();
    await storeHandler(
      {
        body: {
          callSessionId: BASE_SESSION_ID,
          lineId: BASE_LINE_ID,
          memoryType: 'follow_up',
          key: 'doctor_appointment',
          value: 'next Tuesday',
          suggestReminder: true,
        },
      } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.suggestReminder).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// update_memory
// ---------------------------------------------------------------------------

describe('update_memory', () => {
  it('happy path - exact key match results in updated', async () => {
    const existingMem = { id: 'mem-10', key: 'favorite_color', value: 'blue', type: 'fact' };
    vi.mocked(getMemoriesForLine).mockResolvedValue([existingMem] as any);
    vi.mocked(updateMemory).mockResolvedValue({ memoryId: 'mem-10', action: 'updated', version: 2 } as any);

    const res = createMockRes();
    await updateHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID, existingKey: 'favorite_color', newValue: 'green' } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.action).toBe('updated');
    expect(res.body.memoryId).toBe('mem-10');
  });

  it('happy path - no match auto-creates new memory', async () => {
    vi.mocked(getMemoriesForLine).mockResolvedValue([]);
    vi.mocked(searchMemoriesSemantic).mockResolvedValue([]);
    vi.mocked(storeMemory).mockResolvedValue({ memoryId: 'mem-new', action: 'created', version: 1 } as any);

    const res = createMockRes();
    await updateHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID, existingKey: 'nonexistent_key', newValue: 'some value' } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.action).toBe('created');
    expect(res.body.memoryId).toBe('mem-new');
  });

  it('missing existingKey returns 400', async () => {
    const res = createMockRes();
    await updateHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID, newValue: 'something' } } as any,
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('session not found returns 404', async () => {
    vi.mocked(getCallSession).mockResolvedValue(null as any);

    const res = createMockRes();
    await updateHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID, existingKey: 'x', newValue: 'y' } } as any,
      res,
    );

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('consent rejected returns error', async () => {
    vi.mocked(enforceMemoryConsent).mockResolvedValue({ ok: false, error: 'Memory consent not granted' });

    const res = createMockRes();
    await updateHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID, existingKey: 'x', newValue: 'y' } } as any,
      res,
    );

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Memory consent not granted');
  });

  it('needs confirmation when semantic match found and not confirmed', async () => {
    vi.mocked(getMemoriesForLine).mockResolvedValue([]);
    vi.mocked(searchMemoriesSemantic).mockResolvedValue([
      { memory: { id: 'mem-20', key: 'health_update', value: 'knee surgery last month' }, similarity: 0.85 },
    ] as any);

    const res = createMockRes();
    await updateHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID, existingKey: 'knee health', newValue: 'recovered' } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.needsConfirmation).toBe(true);
    expect(res.body.bestGuess.key).toBe('health_update');
  });
});

// ---------------------------------------------------------------------------
// review_memories
// ---------------------------------------------------------------------------

describe('review_memories', () => {
  it('happy path - returns summary, count, and categories', async () => {
    vi.mocked(getMemoriesForLine).mockResolvedValue([
      { id: 'm1', key: 'preferred_name', value: 'Grandma Rose', type: 'fact' },
      { id: 'm2', key: 'hobby', value: 'knitting', type: 'preference' },
      { id: 'm3', key: 'morning_walk', value: 'walks every morning', type: 'routine' },
    ] as any);

    const res = createMockRes();
    await reviewHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.memoryCount).toBe(3);
    expect(Array.isArray(res.body.categories)).toBe(true);
    expect(typeof res.body.summary).toBe('string');
  });

  it('empty memories returns summary with no saved memories message', async () => {
    vi.mocked(getMemoriesForLine).mockResolvedValue([]);

    const res = createMockRes();
    await reviewHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.memoryCount).toBe(0);
    expect(res.body.summary).toContain("don't have any saved memories");
  });

  it('missing required fields returns 400', async () => {
    const res = createMockRes();
    await reviewHandler(
      { body: { callSessionId: BASE_SESSION_ID } } as any,
      res,
    );

    expect(res.statusCode).toBe(400);
  });

  it('session not found returns 404', async () => {
    vi.mocked(getCallSession).mockResolvedValue(null as any);

    const res = createMockRes();
    await reviewHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID } } as any,
      res,
    );

    expect(res.statusCode).toBe(404);
  });

  it('line mismatch returns 403', async () => {
    const res = createMockRes();
    await reviewHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: 'wrong-line-id' } } as any,
      res,
    );

    expect(res.statusCode).toBe(403);
  });

  it('consent rejected returns error with success false', async () => {
    vi.mocked(enforceMemoryConsent).mockResolvedValue({ ok: false, error: 'Memory consent not granted' });

    const res = createMockRes();
    await reviewHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID } } as any,
      res,
    );

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Memory consent not granted');
  });
});

// ---------------------------------------------------------------------------
// forget_memory
// ---------------------------------------------------------------------------

describe('forget_memory', () => {
  it('happy path - soft delete', async () => {
    vi.mocked(searchMemoriesSemantic).mockResolvedValue([
      { memory: { id: 'mem-30', key: 'doctor_visit', value: 'visited cardiologist', type: 'fact', confidence: 0.9 }, similarity: 0.92 },
    ] as any);
    vi.mocked(markMemoriesAccessed).mockResolvedValue(undefined);
    vi.mocked(forgetMemory).mockResolvedValue(true);
    vi.mocked(logMemoryDeactivation).mockResolvedValue(undefined);

    const res = createMockRes();
    await forgetHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID, whatToForget: 'doctor visit', confirmed: true } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("forgotten");
    expect(vi.mocked(forgetMemory)).toHaveBeenCalled();
  });

  it('happy path - permanent delete', async () => {
    vi.mocked(searchMemoriesSemantic).mockResolvedValue([
      { memory: { id: 'mem-31', key: 'medical_history', value: 'heart condition', type: 'fact', confidence: 0.95 }, similarity: 0.9 },
    ] as any);
    vi.mocked(markMemoriesAccessed).mockResolvedValue(undefined);
    vi.mocked(hardDeleteMemoryByKey).mockResolvedValue(1 as any);
    vi.mocked(logMemoryDeactivation).mockResolvedValue(undefined);

    // Override supabase mock for select to return the memory
    const builder: any = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.ilike = vi.fn(async () => ({ data: [{ id: 'mem-31', key: 'medical_history', confidence: 0.95 }], error: null }));
    builder.insert = vi.fn(async () => ({ data: null, error: null }));
    vi.mocked(getSupabaseClient).mockReturnValue({ from: vi.fn(() => builder) } as any);

    const res = createMockRes();
    await forgetHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID, whatToForget: 'medical history', permanent: true, confirmed: true } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('permanently erased');
    expect(vi.mocked(hardDeleteMemoryByKey)).toHaveBeenCalled();
  });

  it('not found returns success with polite message', async () => {
    vi.mocked(searchMemoriesSemantic).mockResolvedValue([]);
    vi.mocked(findFuzzyMatches).mockResolvedValue([]);

    const res = createMockRes();
    await forgetHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID, whatToForget: 'something unknown', confirmed: true } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("make sure not to reference");
  });

  it('needs confirmation when matches found and not confirmed', async () => {
    vi.mocked(searchMemoriesSemantic).mockResolvedValue([
      { memory: { id: 'mem-32', key: 'family_visit', value: 'son visits Sundays' }, similarity: 0.88 },
    ] as any);
    vi.mocked(markMemoriesAccessed).mockResolvedValue(undefined);

    const res = createMockRes();
    await forgetHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID, whatToForget: 'family', confirmed: false } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.needsConfirmation).toBe(true);
    expect(res.body.matchedMemory).toBeDefined();
  });

  it('missing required fields returns 400', async () => {
    const res = createMockRes();
    await forgetHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID } } as any,
      res,
    );

    expect(res.statusCode).toBe(400);
  });

  it('line mismatch returns 403', async () => {
    const res = createMockRes();
    await forgetHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: 'wrong-line', whatToForget: 'something' } } as any,
      res,
    );

    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// mark_private
// ---------------------------------------------------------------------------

describe('mark_private', () => {
  it('happy path - single match marks private', async () => {
    vi.mocked(searchMemoriesSemantic).mockResolvedValue([
      { memory: { id: 'mem-40', key: 'health_condition', value: 'diabetes' }, similarity: 0.91 },
    ] as any);
    vi.mocked(markMemoriesAccessed).mockResolvedValue(undefined);
    vi.mocked(markMemoryPrivate).mockResolvedValue(true);

    const res = createMockRes();
    await markPrivateHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID, whatToKeepPrivate: 'health condition', confirmed: true } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("keep that just between us");
    expect(vi.mocked(markMemoryPrivate)).toHaveBeenCalledWith(BASE_ACCOUNT_ID, BASE_LINE_ID, 'mem-40');
  });

  it('not found returns success with reassuring message', async () => {
    vi.mocked(searchMemoriesSemantic).mockResolvedValue([]);
    vi.mocked(findFuzzyMatches).mockResolvedValue([]);

    const res = createMockRes();
    await markPrivateHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID, whatToKeepPrivate: 'unknown topic' } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("keep that just between us");
  });

  it('needs confirmation when multiple matches and not confirmed', async () => {
    vi.mocked(searchMemoriesSemantic).mockResolvedValue([
      { memory: { id: 'mem-41', key: 'health_a', value: 'blood pressure' }, similarity: 0.89 },
      { memory: { id: 'mem-42', key: 'health_b', value: 'cholesterol' }, similarity: 0.82 },
    ] as any);
    vi.mocked(markMemoriesAccessed).mockResolvedValue(undefined);

    const res = createMockRes();
    await markPrivateHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID, whatToKeepPrivate: 'health', confirmed: false } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.needsConfirmation).toBe(true);
    expect(res.body.matchType).toBe('multiple');
    expect(res.body.bestGuess).toBeDefined();
    expect(Array.isArray(res.body.alternatives)).toBe(true);
  });

  it('missing required fields returns 400', async () => {
    const res = createMockRes();
    await markPrivateHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID } } as any,
      res,
    );

    expect(res.statusCode).toBe(400);
  });

  it('session not found returns 404', async () => {
    vi.mocked(getCallSession).mockResolvedValue(null as any);

    const res = createMockRes();
    await markPrivateHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID, whatToKeepPrivate: 'something' } } as any,
      res,
    );

    expect(res.statusCode).toBe(404);
  });

  it('line mismatch returns 403', async () => {
    const res = createMockRes();
    await markPrivateHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: 'wrong-line', whatToKeepPrivate: 'something' } } as any,
      res,
    );

    expect(res.statusCode).toBe(403);
  });
});
