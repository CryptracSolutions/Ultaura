import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Router } from 'express';

vi.mock('../../../server.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../services/call-session.js', () => ({
  getCallSession: vi.fn(),
  incrementToolInvocations: vi.fn(),
  recordCallEvent: vi.fn(),
}));

type SupabaseState = {
  inserts: Array<{ table: string; payload: Record<string, unknown> }>;
};

type SupabaseMock = {
  from: ReturnType<typeof vi.fn>;
  __state: SupabaseState;
};

function createSupabaseMock(): SupabaseMock {
  const state: SupabaseState = { inserts: [] };
  let table: string | null = null;
  let nextResolve: any = { data: null, error: null };

  const builder: any = {
    insert: vi.fn((payload: Record<string, unknown>) => {
      if (table) state.inserts.push({ table, payload });
      nextResolve = { data: null, error: null };
      return builder;
    }),
    select: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: { id: 'row-1' }, error: null })),
    eq: vi.fn(() => builder),
    then: (onFulfilled: any, onRejected: any) => Promise.resolve(nextResolve).then(onFulfilled, onRejected),
  };

  return {
    from: vi.fn((name: string) => {
      table = name;
      return builder;
    }),
    __state: state,
  };
}

vi.mock('../../../utils/supabase.js', () => ({
  getSupabaseClient: vi.fn(),
}));

let capturedHealthSummary: string | null = null;
vi.mock('../../../utils/health-mention-crypto.js', () => ({
  encryptHealthMentionSummary: vi.fn(async (_accountId: string, _lineId: string, _callSessionId: string, _mentionId: string, summary: string) => {
    capturedHealthSummary = summary;
    return {
      ciphertext: Buffer.from('cipher'),
      iv: Buffer.from('iv'),
      tag: Buffer.from('tag'),
      alg: 'aes-256-gcm',
      kid: 'kek_v1',
    };
  }),
}));

let capturedLifeNarrative: string | null = null;
vi.mock('../../../utils/life-chapter-crypto.js', () => ({
  encryptLifeChapterNarrative: vi.fn(async (_accountId: string, _lineId: string, _chapterId: string, narrative: string) => {
    capturedLifeNarrative = narrative;
    return {
      ciphertext: Buffer.from('cipher'),
      iv: Buffer.from('iv'),
      tag: Buffer.from('tag'),
      alg: 'aes-256-gcm',
      kid: 'kek_v1',
    };
  }),
}));

import { logHealthMentionRouter } from '../log-health-mention.js';
import { storeLifeChapterRouter } from '../store-life-chapter.js';
import { getCallSession } from '../../../services/call-session.js';
import { getSupabaseClient } from '../../../utils/supabase.js';

function getPostHandler(router: Router) {
  const layer = (router as any).stack.find((stackLayer: any) => (
    stackLayer.route?.path === '/' && stackLayer.route?.methods?.post
  ));
  if (!layer) {
    throw new Error('POST handler not found');
  }
  return layer.route.stack[0].handle;
}

function createMockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload: any) => {
    res.body = payload;
    return res;
  });
  return res;
}

const healthHandler = getPostHandler(logHealthMentionRouter);
const lifeHandler = getPostHandler(storeLifeChapterRouter);

const CALL_SESSION_ID = '00000000-0000-0000-0000-000000000201';
const LINE_ID = '00000000-0000-0000-0000-000000000202';

let supabaseMock: SupabaseMock;

beforeEach(() => {
  vi.clearAllMocks();
  capturedHealthSummary = null;
  capturedLifeNarrative = null;

  supabaseMock = createSupabaseMock();
  vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
  vi.mocked(getCallSession).mockResolvedValue({
    id: CALL_SESSION_ID,
    line_id: LINE_ID,
    account_id: '00000000-0000-0000-0000-000000000203',
    created_at: '2026-01-12T00:00:00.000Z',
  } as any);
});

describe('derived artifact minimization at storage boundaries', () => {
  it('minimizes log_health_mention.summary before encryption/storage', async () => {
    const res = createMockRes();
    await healthHandler({
      body: {
        callSessionId: CALL_SESSION_ID,
        lineId: LINE_ID,
        category: 'general',
        summary: `User: "I feel awful today."\nSecond sentence should be dropped.`,
        severity: 'mild',
      },
    } as any, res);

    expect(res.body.success).toBe(true);
    expect(capturedHealthSummary).toBeTruthy();
    expect(capturedHealthSummary).toBe('I feel awful today.');
    expect(capturedHealthSummary).not.toContain('\n');
    expect(capturedHealthSummary).not.toContain('"');
    expect(capturedHealthSummary?.toLowerCase()).not.toContain('user:');
    expect((capturedHealthSummary ?? '').length).toBeLessThanOrEqual(200);
  });

  it('minimizes store_life_chapter narrative/title before encryption/storage', async () => {
    const res = createMockRes();
    await lifeHandler({
      body: {
        callSessionId: CALL_SESSION_ID,
        lineId: LINE_ID,
        chapter_type: 'other',
        title: `Assistant: "A big day"\n`,
        narrative_summary: `User: "It was wonderful."\nSecond sentence should be dropped.`,
        key_people: [`User: "Alice"\n`, `Assistant: "Bob"`],
      },
    } as any, res);

    expect(res.body.success).toBe(true);
    expect(capturedLifeNarrative).toBe('It was wonderful.');

    const insert = supabaseMock.__state.inserts.find((row) => row.table === 'ultaura_life_chapters');
    expect(insert).toBeTruthy();
    expect(insert?.payload.title).toBe('A big day');
    expect(insert?.payload.key_people).toEqual(['Alice', 'Bob']);
  });
});

