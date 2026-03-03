import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const mocks = vi.hoisted(() => {
  const state = {
    isSuperAdmin: true,
    drafts: [
      {
        id: '11111111-1111-1111-1111-111111111111',
        title: 'Draft 1',
        description: 'Description 1',
        category: 'new_feature',
        published: false,
        publishedAt: null,
        publishBatchId: null,
        emailSent: false,
        sortOrder: 0,
        createdAt: '2026-02-20T00:00:00.000Z',
        updatedAt: '2026-02-20T00:00:00.000Z',
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        title: 'Draft 2',
        description: 'Description 2',
        category: 'fix',
        published: false,
        publishedAt: null,
        publishBatchId: null,
        emailSent: false,
        sortOrder: 1,
        createdAt: '2026-02-21T00:00:00.000Z',
        updatedAt: '2026-02-21T00:00:00.000Z',
      },
    ],
    publishedEntries: [
      {
        id: '33333333-3333-3333-3333-333333333333',
        title: 'Published batch retry A',
        description: 'Published retry description A',
        category: 'announcement',
        published: true,
        publishedAt: '2026-02-22T12:00:00.000Z',
        publishBatchId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        emailSent: false,
        sortOrder: 0,
        createdAt: '2026-02-22T12:00:00.000Z',
        updatedAt: '2026-02-22T12:00:00.000Z',
      },
      {
        id: '44444444-4444-4444-4444-444444444444',
        title: 'Published batch retry B',
        description: 'Published retry description B',
        category: 'fix',
        published: true,
        publishedAt: '2026-02-22T12:00:00.000Z',
        publishBatchId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        emailSent: false,
        sortOrder: 1,
        createdAt: '2026-02-22T12:00:00.000Z',
        updatedAt: '2026-02-22T12:00:00.000Z',
      },
      {
        id: '55555555-5555-5555-5555-555555555555',
        title: 'Older unsent batch',
        description: 'Older retry description',
        category: 'improvement',
        published: true,
        publishedAt: '2026-02-21T12:00:00.000Z',
        publishBatchId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        emailSent: false,
        sortOrder: 0,
        createdAt: '2026-02-21T12:00:00.000Z',
        updatedAt: '2026-02-21T12:00:00.000Z',
      },
    ],
    updateCalls: [] as Array<{
      table: string;
      payload: Record<string, unknown>;
      inArgs: Array<[string, unknown[]]>;
      eqArgs: Array<[string, unknown]>;
    }>,
    fetchResponse: {
      status: 200,
      body: {
        success: true,
        batchId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        entryCount: 2,
        recipientsAttempted: 2,
        recipientsSent: 2,
        recipientsFailed: 0,
        dedupedFrom: 1,
        failures: [] as Array<{ email: string; message: string }>,
      },
    } as {
      status: number;
      body: {
        success: boolean;
        batchId: string;
        entryCount: number;
        recipientsAttempted: number;
        recipientsSent: number;
        recipientsFailed: number;
        dedupedFrom: number;
        failures: Array<{ email: string; message: string }>;
        error?: string;
      };
    },
  };

  const loggerFns = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  const actionClient = {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: {
            id: 'admin-user-1',
            email: 'admin@example.com',
            app_metadata: { role: 'super_admin' },
          },
        },
        error: null,
      })),
    },
  };

  function createUpdateChain(record: {
    table: string;
    payload: Record<string, unknown>;
    inArgs: Array<[string, unknown[]]>;
    eqArgs: Array<[string, unknown]>;
  }) {
    const chain: any = {
      in: vi.fn((column: string, values: unknown[]) => {
        record.inArgs.push([column, values]);
        return chain;
      }),
      eq: vi.fn((column: string, value: unknown) => {
        record.eqArgs.push([column, value]);
        return chain;
      }),
      then: (resolve: (value: { error: null }) => unknown) => {
        return Promise.resolve(resolve({ error: null }));
      },
    };

    return chain;
  }

  const adminClient = {
    from: vi.fn((table: string) => ({
      update: vi.fn((payload: Record<string, unknown>) => {
        const record = {
          table,
          payload,
          inArgs: [] as Array<[string, unknown[]]>,
          eqArgs: [] as Array<[string, unknown]>,
        };
        state.updateCalls.push(record);
        return createUpdateChain(record);
      }),
    })),
  };

  const getSupabaseServerActionClient = vi.fn((options?: { admin?: boolean }) =>
    options?.admin ? adminClient : actionClient,
  );

  const hasSuperAdminRole = vi.fn(() => state.isSuperAdmin);
  const writeAdminAuditLog = vi.fn(async () => undefined);
  const revalidatePath = vi.fn();
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify(state.fetchResponse.body), {
      status: state.fetchResponse.status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

  return {
    state,
    loggerFns,
    getSupabaseServerActionClient,
    hasSuperAdminRole,
    writeAdminAuditLog,
    revalidatePath,
    fetchMock,
  };
});

vi.mock('~/core/logger', () => ({
  default: vi.fn(() => mocks.loggerFns),
}));

vi.mock('~/core/supabase/action-client', () => ({
  default: mocks.getSupabaseServerActionClient,
}));

vi.mock('~/lib/ultaura/admin-auth', () => ({
  hasSuperAdminRole: mocks.hasSuperAdminRole,
}));

vi.mock('~/lib/ultaura/admin/audit-log', () => ({
  writeAdminAuditLog: mocks.writeAdminAuditLog,
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('~/lib/ultaura/changelog', () => ({
  CHANGELOG_CATEGORIES: ['new_feature', 'improvement', 'fix', 'announcement'] as const,
  CHANGELOG_CATEGORY_META: {
    new_feature: {
      label: 'New Feature',
      description: 'd',
      dashboardBadgeClassName: '',
      dashboardItemBorderColor: 'var(--success)',
      emailTextColor: '#000',
    },
    improvement: {
      label: 'Improvement',
      description: 'd',
      dashboardBadgeClassName: '',
      dashboardItemBorderColor: 'var(--primary)',
      emailTextColor: '#000',
    },
    fix: {
      label: 'Fix',
      description: 'd',
      dashboardBadgeClassName: '',
      dashboardItemBorderColor: 'var(--warning)',
      emailTextColor: '#000',
    },
    announcement: {
      label: 'Announcement',
      description: 'd',
      dashboardBadgeClassName: '',
      dashboardItemBorderColor: 'var(--info)',
      emailTextColor: '#000',
    },
  },
  CHANGELOG_CATEGORY_OPTIONS: [
    { value: 'new_feature', label: 'New Feature', description: 'd' },
    { value: 'improvement', label: 'Improvement', description: 'd' },
    { value: 'fix', label: 'Fix', description: 'd' },
    { value: 'announcement', label: 'Announcement', description: 'd' },
  ],
  ChangelogEmailRouteRequestSchema: z.object({
    batchId: z.string().uuid(),
    entryIds: z.array(z.string().uuid()).min(1),
  }),
  ULTAURA_CHANGELOG_TABLE: 'ultaura_changelog_entries',
  normalizeChangelogCategory: vi.fn((value: unknown) => (typeof value === 'string' ? value : 'announcement')),
  mapChangelogRow: vi.fn((row: Record<string, unknown>) => row),
  listChangelogEntries: vi.fn(async (_client: unknown, options?: Record<string, unknown>) => {
    const source = options?.published === true ? mocks.state.publishedEntries : mocks.state.drafts;

    let rows = [...source];

    if (Array.isArray(options?.ids)) {
      const ids = new Set(
        (options.ids as unknown[])
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean),
      );
      rows = rows.filter((row) => ids.has(row.id));
    }

    if (typeof options?.publishBatchId === 'string') {
      rows = rows.filter((row) => row.publishBatchId === options.publishBatchId);
    }

    return rows;
  }),
}));

import { publishAndSendChangelog, resendChangelogEmails } from '../changelog-admin-actions';

describe('publishAndSendChangelog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.isSuperAdmin = true;
    mocks.state.updateCalls = [];
    mocks.state.fetchResponse = {
      status: 200,
      body: {
        success: true,
        batchId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        entryCount: 2,
        recipientsAttempted: 2,
        recipientsSent: 2,
        recipientsFailed: 0,
        dedupedFrom: 1,
        failures: [],
      },
    };

    vi.stubGlobal('fetch', mocks.fetchMock);
    process.env.ULTAURA_INTERNAL_API_SECRET = 'test-internal-secret';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
  });

  it('throws when the caller is not a super-admin', async () => {
    mocks.state.isSuperAdmin = false;

    await expect(
      publishAndSendChangelog(['11111111-1111-1111-1111-111111111111']),
    ).rejects.toThrow('Unauthorized');
  });

  it('marks email_sent=true only when the internal route fully succeeds', async () => {
    const result = await publishAndSendChangelog([
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
    ]);

    expect(result.success).toBe(true);
    expect(result.publishedCount).toBe(2);
    expect(result.email).toEqual({
      attempted: 2,
      sent: 2,
      failed: 0,
      dedupedFrom: 1,
    });
    expect(mocks.fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.state.updateCalls).toHaveLength(2);

    expect(mocks.state.updateCalls[0]?.payload).toMatchObject({
      published: true,
      publish_batch_id: expect.any(String),
    });
    expect(mocks.state.updateCalls[0]?.inArgs).toEqual([
      ['id', ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']],
    ]);
    expect(mocks.state.updateCalls[1]?.payload).toMatchObject({
      email_sent: true,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/changelog');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard', 'page');
    expect(mocks.writeAdminAuditLog).toHaveBeenCalled();

    const fetchCall = mocks.fetchMock.mock.calls[0];
    expect(fetchCall).toBeDefined();
    const [fetchUrl, fetchOptions] = fetchCall as unknown as [string, RequestInit];
    expect(fetchUrl).toBe('https://example.com/api/internal/changelog-email');
    expect(fetchOptions.method).toBe('POST');
    expect(fetchOptions.headers).toMatchObject({ 'x-webhook-secret': 'test-internal-secret' });
    expect(fetchOptions.body).toContain('entryIds');
  });

  it('leaves entries published but unsent when the email route partially fails', async () => {
    mocks.state.fetchResponse = {
      status: 207,
      body: {
        success: false,
        batchId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        entryCount: 2,
        recipientsAttempted: 2,
        recipientsSent: 1,
        recipientsFailed: 1,
        dedupedFrom: 1,
        error: 'Some changelog emails failed to send',
        failures: [{ email: 'family@example.com', message: 'SMTP error' }],
      },
    };

    const result = await publishAndSendChangelog([
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
    ]);

    expect(result.success).toBe(false);
    expect(result.publishedCount).toBe(2);
    expect(result.email).toEqual({
      attempted: 2,
      sent: 1,
      failed: 1,
      dedupedFrom: 1,
    });
    expect(result.error).toContain('failed');
    expect(mocks.state.updateCalls).toHaveLength(1);
    expect(mocks.state.updateCalls[0]?.payload).toMatchObject({
      published: true,
    });
  });

  it('resends the latest published unsent batch and marks email_sent=true on success', async () => {
    const result = await resendChangelogEmails();

    expect(result.success).toBe(true);
    expect(result.batchId).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    expect(result.entryCount).toBe(2);
    expect(result.email).toEqual({
      attempted: 2,
      sent: 2,
      failed: 0,
      dedupedFrom: 1,
    });

    expect(mocks.fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.state.updateCalls).toHaveLength(1);
    expect(mocks.state.updateCalls[0]?.payload).toMatchObject({
      email_sent: true,
    });
    expect(mocks.state.updateCalls[0]?.inArgs).toEqual([
      ['id', ['33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444']],
    ]);
    expect(mocks.state.updateCalls[0]?.eqArgs).toEqual(
      expect.arrayContaining([
        ['publish_batch_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'],
        ['published', true],
        ['email_sent', false],
      ]),
    );
    expect(mocks.writeAdminAuditLog).toHaveBeenCalled();

    const fetchCall = mocks.fetchMock.mock.calls[0];
    const [, fetchOptions] = fetchCall as unknown as [string, RequestInit];
    expect(fetchOptions.body).toContain('"batchId":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"');
    expect(fetchOptions.body).toContain('33333333-3333-3333-3333-333333333333');
    expect(fetchOptions.body).toContain('44444444-4444-4444-4444-444444444444');
    expect(fetchOptions.body).not.toContain('55555555-5555-5555-5555-555555555555');
  });

  it('resends a specific published unsent batch when requested', async () => {
    const result = await resendChangelogEmails({
      batchId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    });

    expect(result.success).toBe(true);
    expect(result.batchId).toBe('cccccccc-cccc-cccc-cccc-cccccccccccc');
    expect(result.entryCount).toBe(1);
    expect(mocks.state.updateCalls).toHaveLength(1);
    expect(mocks.state.updateCalls[0]?.inArgs).toEqual([
      ['id', ['55555555-5555-5555-5555-555555555555']],
    ]);
  });
});
