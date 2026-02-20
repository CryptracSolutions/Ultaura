import { vi } from 'vitest';
import type { Router } from 'express';
import type { CallSessionRow } from '../../../../utils/supabase.js';
import { baseSession } from './fixtures.js';
import { createSupabaseMock, type SupabaseMock, type SupabaseResponse } from './supabase-mock.js';

export type MockResponse = {
  statusCode: number;
  body: any;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
};

export function createMockRes(): MockResponse {
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

export function getPostHandler(router: Router, path = '/') {
  const layer = (router as any).stack.find((stackLayer: any) => (
    stackLayer.route?.path === path && stackLayer.route?.methods?.post
  ));
  if (!layer) {
    throw new Error(`POST handler not found for path: ${path}`);
  }
  return layer.route.stack[0].handle;
}

export type ToolTestContext = {
  session: CallSessionRow;
  supabaseMock: SupabaseMock;
  res: MockResponse;
  mocks: {
    getCallSession: ReturnType<typeof vi.fn>;
    incrementToolInvocations: ReturnType<typeof vi.fn>;
    recordCallEvent: ReturnType<typeof vi.fn>;
    getSupabaseClient: ReturnType<typeof vi.fn>;
  };
  getPostHandler: (router: Router, path?: string) => (...args: any[]) => any;
  createMockRes: () => MockResponse;
  resetMocks: () => void;
};

export type ToolTestContextOptions = {
  sessionOverrides?: Partial<CallSessionRow>;
  lineOverrides?: Record<string, unknown>;
  accountOverrides?: Record<string, unknown>;
  supabaseResponses?: Record<string, SupabaseResponse[]>;
  rpcResponses?: Record<string, SupabaseResponse[]>;
};

export function createToolTestContext(options: ToolTestContextOptions = {}): ToolTestContext {
  const session: CallSessionRow = {
    ...baseSession,
    ...(options.sessionOverrides ?? {}),
  };

  const supabaseMock = createSupabaseMock(options.supabaseResponses, options.rpcResponses);

  const getCallSessionMock = vi.fn();
  const incrementToolInvocationsMock = vi.fn();
  const recordCallEventMock = vi.fn();
  const getSupabaseClientMock = vi.fn(() => supabaseMock as any);

  const res = createMockRes();

  const resetMocks = () => {
    vi.clearAllMocks();
    getSupabaseClientMock.mockReturnValue(supabaseMock as any);
    incrementToolInvocationsMock.mockResolvedValue(undefined);
    recordCallEventMock.mockResolvedValue(undefined);
    // Reset supabase state arrays and per-table/RPC counters
    supabaseMock.__state.inserts.length = 0;
    supabaseMock.__state.updates.length = 0;
    supabaseMock.__state.rpcCalls.length = 0;
    supabaseMock.__state.table = null;
    supabaseMock.__state.counters.clear();
    supabaseMock.__state.rpcCounters.clear();
  };

  return {
    session,
    supabaseMock,
    res,
    mocks: {
      getCallSession: getCallSessionMock,
      incrementToolInvocations: incrementToolInvocationsMock,
      recordCallEvent: recordCallEventMock,
      getSupabaseClient: getSupabaseClientMock,
    },
    getPostHandler,
    createMockRes,
    resetMocks,
  };
}
