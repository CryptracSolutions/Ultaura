import { beforeEach, describe, expect, it, vi } from 'vitest';

const SENTINEL = 'SENSITIVE_SENTINEL_12345';

type InsertCapture = Array<{ table: string; payload: Record<string, unknown> }>;

type SupabaseMock = {
  from: ReturnType<typeof vi.fn>;
  __inserts: InsertCapture;
};

function createSupabaseMock(): SupabaseMock {
  const inserts: InsertCapture = [];
  let table: string | null = null;

  const builder: any = {
    insert: vi.fn((payload: Record<string, unknown>) => {
      if (table) inserts.push({ table, payload });
      return builder;
    }),
    select: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    eq: vi.fn(() => builder),
    update: vi.fn(() => builder),
  };

  return {
    from: vi.fn((name: string) => {
      table = name;
      return builder;
    }),
    __inserts: inserts,
  };
}

let encryptInput: Record<string, unknown> | null = null;
let supabaseMock: SupabaseMock;

vi.mock('../../server.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../utils/debug-log-crypto.js', () => ({
  encryptDebugPayload: vi.fn(async (_supabase: any, _accountId: string, _sessionId: string, _debugLogId: string, payload: Record<string, unknown>) => {
    encryptInput = payload;
    return {
      ciphertext: Buffer.from('ciphertext'),
      iv: Buffer.from('iv'),
      tag: Buffer.from('tag'),
      alg: 'aes-256-gcm',
      kid: 'kek_v1',
    };
  }),
}));

vi.mock('../../utils/supabase.js', () => ({
  getSupabaseClient: vi.fn(),
}));

describe('call-session privacy invariants', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    encryptInput = null;

    const { getSupabaseClient } = await import('../../utils/supabase.js');
    supabaseMock = createSupabaseMock();
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
  });

  it('recordDebugEvent encrypts only safe summaries (never raw values)', async () => {
    const { recordDebugEvent } = await import('../call-session.js');

    await recordDebugEvent(
      'session-1',
      'tool_call',
      {
        tool: 'store_memory',
        value: SENTINEL,
        notes: `User: "${SENTINEL}"\nSecond sentence.`,
      },
      { any: 'meta' },
      { accountId: 'account-1', toolName: 'store_memory' }
    );

    expect(encryptInput).toBeTruthy();
    expect(JSON.stringify(encryptInput)).not.toContain(SENTINEL);

    const debugInsert = supabaseMock.__inserts.find((row) => row.table === 'ultaura_debug_logs');
    expect(debugInsert).toBeTruthy();
    expect(JSON.stringify(debugInsert?.payload)).not.toContain(SENTINEL);
  });

  it('recordCallEvent never persists tool args/transcript-like fields', async () => {
    const { recordCallEvent } = await import('../call-session.js');

    await recordCallEvent('session-2', 'tool_call', {
      tool: 'store_memory',
      success: true,
      key: 'preferred_name',
      reason: SENTINEL,
      value: SENTINEL,
      action: 'created',
      version: 1,
    }, { skipDebugLog: true });

    const callEventInsert = supabaseMock.__inserts.find((row) => row.table === 'ultaura_call_events');
    expect(callEventInsert).toBeTruthy();
    expect(JSON.stringify(callEventInsert?.payload)).not.toContain(SENTINEL);
  });
});
