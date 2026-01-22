import { beforeEach, describe, expect, it, vi } from 'vitest';

type SupabaseResponse = {
  data?: any;
  error?: any;
};

type SupabaseMock = {
  from: ReturnType<typeof vi.fn>;
  storage: {
    from: ReturnType<typeof vi.fn>;
  };
};

let uploadPayload: Buffer | null = null;

function createBuilder(response: SupabaseResponse) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    single: vi.fn(async () => response),
    maybeSingle: vi.fn(async () => response),
  };
  builder.then = (resolve: (value: any) => any, reject: (reason: any) => any) => (
    Promise.resolve(response).then(resolve, reject)
  );
  return builder;
}

function createSupabaseMock(responses: Record<string, SupabaseResponse[]>): SupabaseMock {
  const counters = new Map<string, number>();

  return {
    from: vi.fn((table: string) => {
      const count = counters.get(table) ?? 0;
      counters.set(table, count + 1);
      const response = responses[table]?.[count] ?? { data: null, error: null };
      return createBuilder(response);
    }),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async (_path: string, payload: Buffer) => {
          uploadPayload = payload;
          return { error: null };
        }),
        createSignedUrl: vi.fn(async () => ({
          data: { signedUrl: 'https://signed.example/ultaura-export' },
          error: null,
        })),
      })),
    },
  };
}

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../utils/encryption.js', () => ({
  fetchDecryptedMemories: vi.fn(),
}));

vi.mock('../../utils/supabase.js', () => ({
  getSupabaseClient: vi.fn(),
}));

describe('exports', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    uploadPayload = null;

    const { getSupabaseClient } = await import('../../utils/supabase.js');
    const supabaseMock = createSupabaseMock({
      ultaura_data_export_requests: [
        {
          data: {
            id: 'export-1',
            account_id: 'account-1',
            status: 'pending',
            format: 'json',
            include_memories: true,
            include_call_metadata: false,
            include_reminders: false,
            requested_by: 'user-1',
          },
          error: null,
        },
        { data: { id: 'export-1' }, error: null },
        { data: null, error: null },
      ],
      ultaura_accounts: [
        {
          data: {
            id: 'account-1',
            created_at: '2026-01-01T00:00:00.000Z',
            plan_id: 'care',
            status: 'active',
            user_type: 'family_managed',
          },
          error: null,
        },
      ],
      ultaura_account_privacy_settings: [
        { data: { retention_period: 'indefinite' }, error: null },
      ],
      ultaura_lines: [
        {
          data: [
            {
              id: 'line-1',
              display_name: 'Test Line',
              phone_e164: '+15551234567',
              timezone: 'America/Los_Angeles',
              created_at: '2026-01-01T00:00:00.000Z',
              voicemail_behavior: 'none',
              inbound_allowed: true,
              do_not_call: false,
            },
          ],
          error: null,
        },
      ],
      ultaura_consent_audit_log: [{ data: [], error: null }],
    });

    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
  });

  it('skips memory export for family-managed accounts', async () => {
    const { processExportRequest } = await import('../exports.js');
    const { fetchDecryptedMemories } = await import('../../utils/encryption.js');

    const result = await processExportRequest('export-1');

    expect(result).toEqual({ success: true });
    expect(fetchDecryptedMemories).not.toHaveBeenCalled();
    expect(uploadPayload).toBeTruthy();

    const parsed = JSON.parse(Buffer.from(uploadPayload as Buffer).toString('utf-8'));
    expect(parsed.memories).toEqual([]);
  });
});
