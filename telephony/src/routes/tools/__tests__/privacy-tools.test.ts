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

vi.mock('../../../services/topic-exclusions.js', () => ({
  excludeTopic: vi.fn(),
  includeTopic: vi.fn(),
  listTopicExclusions: vi.fn(),
  EXCLUSION_DISPLAY_NAMES: {
    health_medical: 'health and medical topics',
    family_relationships: 'family and relationship topics',
    finances: 'financial topics',
    location_address: 'location and address information',
  },
}));

vi.mock('../../../utils/supabase.js', () => ({
  getSupabaseClient: vi.fn(),
}));

vi.mock('../../../services/insight-state.js', () => ({
  addPrivateTopic: vi.fn(),
}));

import { excludeTopicRouter } from '../exclude-topic.js';
import { includeTopicRouter } from '../include-topic.js';
import { listExclusionsRouter } from '../list-exclusions.js';
import { markTopicPrivateRouter } from '../mark-topic-private.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../../services/call-session.js';
import { excludeTopic, includeTopic, listTopicExclusions } from '../../../services/topic-exclusions.js';
import { getSupabaseClient } from '../../../utils/supabase.js';
import { addPrivateTopic } from '../../../services/insight-state.js';
import {
  createMockRes,
  getPostHandler,
  BASE_SESSION_ID,
  BASE_LINE_ID,
  BASE_ACCOUNT_ID,
  baseSession,
} from './helpers/index.js';

const excludeHandler = getPostHandler(excludeTopicRouter);
const includeHandler = getPostHandler(includeTopicRouter);
const listHandler = getPostHandler(listExclusionsRouter);
const markTopicPrivateHandler = getPostHandler(markTopicPrivateRouter);

function makeSupabaseMock(privacyData: any = null, upsertError: any = null) {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => ({ data: privacyData, error: null }));
  builder.upsert = vi.fn(async () => ({ data: null, error: upsertError }));
  return { from: vi.fn(() => builder) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCallSession).mockResolvedValue(baseSession);
  vi.mocked(incrementToolInvocations).mockResolvedValue(undefined);
  vi.mocked(recordCallEvent).mockResolvedValue(undefined);
  vi.mocked(getSupabaseClient).mockReturnValue(makeSupabaseMock() as any);
});

// ---------------------------------------------------------------------------
// exclude_memory_topic
// ---------------------------------------------------------------------------

describe('exclude_memory_topic', () => {
  it('happy path - returns affectedMemories count', async () => {
    vi.mocked(excludeTopic).mockResolvedValue({ affectedMemoryIds: ['m1', 'm2'] } as any);

    const res = createMockRes();
    await excludeHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID, category: 'health_medical' } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.affectedMemories).toBe(2);
    expect(res.body.category).toBe('health_medical');
    expect(res.body.message).toContain('health and medical topics');
  });

  it('invalid category returns 400', async () => {
    const res = createMockRes();
    await excludeHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID, category: 'invalid_category' } } as any,
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/invalid category/i);
  });

  it('missing fields returns 400', async () => {
    const res = createMockRes();
    await excludeHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID } } as any,
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/missing required fields/i);
  });

  it('line mismatch returns 403', async () => {
    const res = createMockRes();
    await excludeHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: 'wrong-line', category: 'finances' } } as any,
      res,
    );

    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// include_memory_topic
// ---------------------------------------------------------------------------

describe('include_memory_topic', () => {
  it('happy path - returns restoredMemories count', async () => {
    vi.mocked(includeTopic).mockResolvedValue({ restoredMemoryIds: ['m3', 'm4', 'm5'] } as any);

    const res = createMockRes();
    await includeHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID, category: 'family_relationships' } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.restoredMemories).toBe(3);
    expect(res.body.category).toBe('family_relationships');
    expect(res.body.message).toContain('family and relationship topics');
  });

  it('invalid category returns 400', async () => {
    const res = createMockRes();
    await includeHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID, category: 'bad_cat' } } as any,
      res,
    );

    expect(res.statusCode).toBe(400);
  });

  it('missing fields returns 400', async () => {
    const res = createMockRes();
    await includeHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID } } as any,
      res,
    );

    expect(res.statusCode).toBe(400);
  });

  it('line mismatch returns 403', async () => {
    const res = createMockRes();
    await includeHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: 'wrong-line', category: 'finances' } } as any,
      res,
    );

    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// list_topic_exclusions
// ---------------------------------------------------------------------------

describe('list_topic_exclusions', () => {
  it('happy path - returns exclusions array', async () => {
    vi.mocked(listTopicExclusions).mockResolvedValue([
      { category: 'health_medical', excluded: true, excluded_at: '2026-01-01T00:00:00Z' },
      { category: 'finances', excluded: false, excluded_at: null },
    ] as any);

    const res = createMockRes();
    await listHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.exclusions)).toBe(true);
    expect(res.body.exclusions).toHaveLength(2);
    expect(res.body.exclusions[0].category).toBe('health_medical');
    expect(res.body.exclusions[0].excluded).toBe(true);
    expect(res.body.exclusions[0].displayName).toBe('health and medical topics');
  });

  it('empty list returns empty exclusions array', async () => {
    vi.mocked(listTopicExclusions).mockResolvedValue([]);

    const res = createMockRes();
    await listHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: BASE_LINE_ID } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.exclusions).toHaveLength(0);
  });

  it('missing fields returns 400', async () => {
    const res = createMockRes();
    await listHandler(
      { body: { callSessionId: BASE_SESSION_ID } } as any,
      res,
    );

    expect(res.statusCode).toBe(400);
  });

  it('line mismatch returns 403', async () => {
    const res = createMockRes();
    await listHandler(
      { body: { callSessionId: BASE_SESSION_ID, lineId: 'wrong-line' } } as any,
      res,
    );

    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// mark_topic_private
// mark_topic_private uses Zod schema with UUID validation, so we need real UUIDs
// ---------------------------------------------------------------------------

// Valid UUIDs matching baseSession values
const UUID_SESSION = 'aaaaaaaa-0000-0000-0000-000000000001';
const UUID_LINE = 'bbbbbbbb-0000-0000-0000-000000000001';
const UUID_OTHER_LINE = 'cccccccc-0000-0000-0000-000000000099';

describe('mark_topic_private', () => {
  beforeEach(() => {
    // Override session to use UUID-compatible IDs
    vi.mocked(getCallSession).mockResolvedValue({
      ...baseSession,
      id: UUID_SESSION,
      line_id: UUID_LINE,
      account_id: BASE_ACCOUNT_ID,
    });
  });

  it('happy path - appends topic_code and calls addPrivateTopic', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue(makeSupabaseMock({ id: 'priv-1', private_topic_codes: ['family'] }) as any);
    vi.mocked(addPrivateTopic).mockReturnValue(undefined);

    const res = createMockRes();
    await markTopicPrivateHandler(
      { body: { callSessionId: UUID_SESSION, lineId: UUID_LINE, topic_code: 'feelings' } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("keep that private");
    expect(vi.mocked(addPrivateTopic)).toHaveBeenCalledWith(UUID_SESSION, 'feelings');
  });

  it('missing fields returns 400', async () => {
    const res = createMockRes();
    await markTopicPrivateHandler(
      { body: { callSessionId: UUID_SESSION, lineId: UUID_LINE } } as any,
      res,
    );

    expect(res.statusCode).toBe(400);
  });

  it('line mismatch returns 403', async () => {
    const res = createMockRes();
    await markTopicPrivateHandler(
      { body: { callSessionId: UUID_SESSION, lineId: UUID_OTHER_LINE, topic_code: 'family' } } as any,
      res,
    );

    expect(res.statusCode).toBe(403);
  });

  it('privacy fetch failure returns 500', async () => {
    const builder: any = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(async () => ({ data: null, error: { message: 'DB error' } }));
    builder.upsert = vi.fn(async () => ({ data: null, error: null }));
    vi.mocked(getSupabaseClient).mockReturnValue({ from: vi.fn(() => builder) } as any);

    const res = createMockRes();
    await markTopicPrivateHandler(
      { body: { callSessionId: UUID_SESSION, lineId: UUID_LINE, topic_code: 'plans' } } as any,
      res,
    );

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/failed to update privacy/i);
  });
});
