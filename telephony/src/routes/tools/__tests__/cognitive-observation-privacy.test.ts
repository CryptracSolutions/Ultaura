import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Router } from 'express';

const SENTINEL = 'SENSITIVE_SENTINEL_12345';

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

vi.mock('../../../services/cognitive-flags.js', () => ({
  updateCognitiveFlagsFromObservation: vi.fn(),
}));

type SupabaseState = {
  inserts: Array<{ table: string; payload: Record<string, unknown> }>;
};

type SupabaseMock = {
  from: ReturnType<typeof vi.fn>;
  __state: SupabaseState;
};

function createSupabaseMock(): SupabaseMock {
  const state: SupabaseState = {
    inserts: [],
  };

  let table: string | null = null;
  let nextResolve: any = { data: null, error: null, count: 0 };

  const builder: any = {
    select: vi.fn((_columns?: any, options?: any) => {
      // count queries in this route use select(..., { count: 'exact', head: true })
      if (options?.count === 'exact') {
        nextResolve = { data: null, error: null, count: 0 };
      }
      return builder;
    }),
    insert: vi.fn((payload: Record<string, unknown>) => {
      if (table) state.inserts.push({ table, payload });
      nextResolve = { data: null, error: null };
      return builder;
    }),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: any, onRejected: any) => {
      return Promise.resolve(nextResolve).then(onFulfilled, onRejected);
    },
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

import { logCognitiveObservationRouter } from '../log-cognitive-observation.js';
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

const handler = getPostHandler(logCognitiveObservationRouter);

let supabaseMock: SupabaseMock;
const CALL_SESSION_ID = '00000000-0000-0000-0000-000000000001';
const LINE_ID = '00000000-0000-0000-0000-000000000002';

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMock = createSupabaseMock();
  vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
  vi.mocked(getCallSession).mockResolvedValue({
    id: CALL_SESSION_ID,
    line_id: LINE_ID,
    account_id: 'account-1',
    created_at: '2026-01-12T00:00:00.000Z',
  } as any);
});

describe('log-cognitive-observation privacy', () => {
  it('never persists context/response_given (always null)', async () => {
    const res = createMockRes();

    await handler({
      body: {
        callSessionId: CALL_SESSION_ID,
        lineId: LINE_ID,
        observation_type: 'confusion',
        severity: 'mild',
        context: `User: "${SENTINEL}"`,
        response_given: `Assistant: "${SENTINEL}"`,
      },
    } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });

    const insert = supabaseMock.__state.inserts.find((row) => row.table === 'ultaura_cognitive_observations');
    expect(insert).toBeTruthy();
    expect(insert?.payload.context).toBeNull();
    expect(insert?.payload.response_given).toBeNull();
    expect(JSON.stringify(insert?.payload)).not.toContain(SENTINEL);
  });
});
