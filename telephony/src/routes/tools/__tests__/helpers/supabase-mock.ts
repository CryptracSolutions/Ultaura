import { vi } from 'vitest';

export type SupabaseResponse = {
  data?: any;
  error?: any;
  count?: number;
};

export type SupabaseState = {
  table: string | null;
  inserts: Array<{ table: string | null; payload: Record<string, unknown> }>;
  updates: Array<{ table: string | null; payload: Record<string, unknown> }>;
  rpcCalls: Array<{ name: string; params: Record<string, unknown> }>;
  singleResult: { data: any; error: any };
  maybeSingleResult: { data: any; error: any };
  updateError: any;
  counters: Map<string, number>;
  rpcCounters: Map<string, number>;
};

export type SupabaseMock = {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  __state: SupabaseState;
};

function createBuilder(response: SupabaseResponse | null, state: SupabaseState) {
  const resolved = response ?? { data: null, error: null };
  const builder: any = {
    select: vi.fn(() => builder),
    insert: vi.fn((payload: Record<string, unknown>) => {
      state.inserts.push({ table: state.table, payload });
      return builder;
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      state.updates.push({ table: state.table, payload });
      builder.error = state.updateError;
      return builder;
    }),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    not: vi.fn(() => builder),
    is: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    onConflict: vi.fn(() => builder),
    single: vi.fn(async () => (response ? response : state.singleResult)),
    maybeSingle: vi.fn(async () => (response ? response : state.maybeSingleResult)),
    error: null,
  };
  builder.then = (resolve: (value: any) => any, reject: (reason: any) => any) =>
    Promise.resolve(resolved).then(resolve, reject);
  return builder;
}

export function createSupabaseMock(
  supabaseResponses?: Record<string, SupabaseResponse[]>,
  rpcResponses?: Record<string, SupabaseResponse[]>
): SupabaseMock {
  const state: SupabaseState = {
    table: null,
    inserts: [],
    updates: [],
    rpcCalls: [],
    singleResult: { data: { id: 'row-1' }, error: null },
    maybeSingleResult: { data: null, error: null },
    updateError: null,
    counters: new Map<string, number>(),
    rpcCounters: new Map<string, number>(),
  };

  const fromFn = vi.fn((table: string) => {
    state.table = table;

    if (supabaseResponses) {
      const count = state.counters.get(table) ?? 0;
      state.counters.set(table, count + 1);
      const response = supabaseResponses[table]?.[count] ?? { data: null, error: null };
      return createBuilder(response, state);
    }

    return createBuilder(null, state);
  });

  const rpcFn = vi.fn(async (fnName: string, params?: Record<string, unknown>) => {
    state.rpcCalls.push({ name: fnName, params: params ?? {} });

    if (rpcResponses) {
      const count = state.rpcCounters.get(fnName) ?? 0;
      state.rpcCounters.set(fnName, count + 1);
      return rpcResponses[fnName]?.[count] ?? { data: null, error: null };
    }

    return { data: null, error: null };
  });

  return {
    from: fromFn,
    rpc: rpcFn as any,
    __state: state,
  };
}
