import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const auditMocks = vi.hoisted(() => {
  const state = {
    headerValues: {
      'x-forwarded-for': '203.0.113.10, 198.51.100.7',
      'user-agent': 'Vitest/1.0',
    } as Record<string, string | null>,
    getClientArgs: [] as Array<unknown>,
    fromCalls: [] as string[],
    insertPayloads: [] as Array<Record<string, unknown>>,
    selectCalls: [] as Array<[unknown, unknown]>,
    orderCalls: [] as Array<[string, unknown]>,
    rangeCalls: [] as Array<[number, number]>,
    insertResult: {
      error: null as unknown,
    },
    recentLogsResult: {
      data: [] as Array<Record<string, unknown>> | null,
      error: null as unknown,
      count: 0 as number | null,
    },
    authGetUserResult: {
      data: {
        user: null as
          | {
              id: string;
              email?: string | null;
            }
          | null,
      },
      error: null as unknown,
    },
  };

  const buildAuditLogSelectChain = () => {
    const chain: Record<string, any> = {};

    chain.order = vi.fn((column: string, options: unknown) => {
      state.orderCalls.push([column, options]);
      return chain;
    });

    chain.range = vi.fn((from: number, to: number) => {
      state.rangeCalls.push([from, to]);
      return Promise.resolve(state.recentLogsResult);
    });

    return chain;
  };

  const adminClient = {
    from: vi.fn((table: string) => {
      state.fromCalls.push(table);

      if (table !== ('ultaura_admin_audit_log' as any)) {
        throw new Error(`Unexpected admin table: ${table}`);
      }

      return {
        insert: vi.fn((payload: Record<string, unknown>) => {
          state.insertPayloads.push(payload);
          return Promise.resolve(state.insertResult);
        }),
        select: vi.fn((columns: unknown, options: unknown) => {
          state.selectCalls.push([columns, options]);
          return buildAuditLogSelectChain();
        }),
      };
    }),
  };

  const defaultClient = {
    auth: {
      getUser: vi.fn(async () => state.authGetUserResult),
    },
  };

  const headersMock = vi.fn(() => ({
    get(name: string) {
      const key = name.toLowerCase();
      return state.headerValues[key] ?? null;
    },
  }));

  const getSupabaseServerActionClient = vi.fn((params?: { admin?: boolean }) => {
    state.getClientArgs.push(params);
    return params?.admin ? adminClient : defaultClient;
  });

  const loggerError = vi.fn();

  const reset = () => {
    state.headerValues = {
      'x-forwarded-for': '203.0.113.10, 198.51.100.7',
      'user-agent': 'Vitest/1.0',
    };
    state.getClientArgs.length = 0;
    state.fromCalls.length = 0;
    state.insertPayloads.length = 0;
    state.selectCalls.length = 0;
    state.orderCalls.length = 0;
    state.rangeCalls.length = 0;
    state.insertResult = { error: null };
    state.recentLogsResult = { data: [], error: null, count: 0 };
    state.authGetUserResult = { data: { user: null }, error: null };
  };

  return {
    state,
    reset,
    headersMock,
    getSupabaseServerActionClient,
    loggerError,
  };
});

vi.mock('next/headers', () => ({
  headers: auditMocks.headersMock,
}));

vi.mock('~/core/supabase/action-client', () => ({
  default: auditMocks.getSupabaseServerActionClient,
}));

vi.mock('~/core/logger', () => ({
  default: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: auditMocks.loggerError,
  })),
}));

import {
  searchByEmail,
  searchByLinePhone,
  searchByPhone,
  searchByUid,
} from '~/app/admin/search/queries';
import {
  getMembershipsByOrganizationUid,
  getOrganizations,
} from '~/app/admin/organizations/queries';
import {
  getCurrentAdminContext,
  getRecentAuditLogs,
  writeAdminAuditLog,
} from '~/lib/ultaura/admin/audit-log';

function createThenableChain<T>(
  chain: Record<string, any>,
  getResult: () => T,
) {
  chain.then = (onFulfilled: (value: T) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(getResult()).then(onFulfilled, onRejected);
  chain.catch = (onRejected: (reason: unknown) => unknown) =>
    Promise.resolve(getResult()).catch(onRejected);
  chain.finally = (onFinally: () => void) =>
    Promise.resolve(getResult()).finally(onFinally);
  return chain;
}

function createEmailSearchClient(options?: {
  rpcData?: unknown;
  memberships?: Array<Record<string, unknown>>;
  accounts?: Array<Record<string, unknown>>;
  lines?: Array<Record<string, unknown>>;
}) {
  const calls = {
    rpc: [] as Array<[string, Record<string, unknown>]>,
    from: [] as string[],
    membershipIn: [] as Array<[string, unknown[]]>,
    accountIn: [] as Array<[string, unknown[]]>,
    lineIn: [] as Array<[string, unknown[]]>,
  };

  const client = {
    rpc: vi.fn(async (fn: string, params: Record<string, unknown>) => {
      calls.rpc.push([fn, params]);
      return {
        data: options?.rpcData ?? [],
        error: null,
      };
    }),
    auth: {
      admin: {
        getUserById: vi.fn(),
      },
    },
    from: vi.fn((table: string) => {
      calls.from.push(table);

      if (table === 'memberships') {
        return {
          select: vi.fn(() => {
            const chain: Record<string, any> = {};
            chain.in = vi.fn((column: string, values: unknown[]) => {
              calls.membershipIn.push([column, values]);
              return chain;
            });
            return createThenableChain(chain, () => ({
              data: options?.memberships ?? [],
              error: null,
            }));
          }),
        };
      }

      if (table === 'ultaura_accounts') {
        return {
          select: vi.fn(() => {
            const chain: Record<string, any> = {};
            chain.in = vi.fn((column: string, values: unknown[]) => {
              calls.accountIn.push([column, values]);
              return chain;
            });
            return createThenableChain(chain, () => ({
              data: options?.accounts ?? [],
              error: null,
            }));
          }),
        };
      }

      if (table === 'ultaura_lines') {
        return {
          select: vi.fn(() => {
            const chain: Record<string, any> = {};
            chain.in = vi.fn((column: string, values: unknown[]) => {
              calls.lineIn.push([column, values]);
              return chain;
            });
            return createThenableChain(chain, () => ({
              data: options?.lines ?? [],
              error: null,
            }));
          }),
        };
      }

      throw new Error(`Unexpected table for email search client: ${table}`);
    }),
  };

  return { client, calls };
}

function createPhoneSearchClient() {
  const calls = {
    from: [] as string[],
    select: [] as string[],
    or: [] as string[],
    ilike: [] as Array<[string, string]>,
    in: [] as Array<[string, unknown[]]>,
  };

  const client = {
    auth: {
      admin: {
        getUserById: vi.fn(),
      },
    },
    from: vi.fn((table: string) => {
      calls.from.push(table);

      if (table !== 'ultaura_lines') {
        throw new Error(`Unexpected table for phone search client: ${table}`);
      }

      return {
        select: vi.fn((columns: string) => {
          calls.select.push(columns);

          const chain: Record<string, any> = {};

          chain.or = vi.fn((value: string) => {
            calls.or.push(value);
            return chain;
          });

          chain.ilike = vi.fn((column: string, value: string) => {
            calls.ilike.push([column, value]);
            return chain;
          });

          chain.in = vi.fn((column: string, values: unknown[]) => {
            calls.in.push([column, values]);
            return chain;
          });

          return createThenableChain(chain, () => ({
            data: [],
            error: null,
          }));
        }),
      };
    }),
  };

  return { client, calls };
}

function createOrganizationsClient() {
  const calls = {
    from: [] as string[],
    ilike: [] as Array<[string, string]>,
    range: [] as Array<[number, number]>,
  };

  const queryResult = {
    data: [{ id: 1, uuid: 'org-1', name: 'Org 1', memberships: [] }],
    count: 1,
    error: null,
  };

  const client = {
    from: vi.fn((table: string) => {
      calls.from.push(table);

      return {
        select: vi.fn(() => {
          const chain: Record<string, any> = {};

          chain.ilike = vi.fn((column: string, value: string) => {
            calls.ilike.push([column, value]);
            return chain;
          });

          chain.range = vi.fn((from: number, to: number) => {
            calls.range.push([from, to]);
            return Promise.resolve(queryResult);
          });

          return chain;
        }),
      };
    }),
  };

  return { client, calls, queryResult };
}

function createMembershipsClient() {
  const calls = {
    from: [] as string[],
    eq: [] as Array<[string, unknown]>,
    is: [] as Array<[string, unknown]>,
    range: [] as Array<[number, number]>,
  };

  const queryResult = {
    data: [
      {
        id: 10,
        role: 2,
        user: {
          id: 'user-1',
          displayName: 'Taylor',
          photoURL: 'https://example.com/photo.png',
        },
      },
    ],
    count: 41,
    error: null,
  };

  const client = {
    from: vi.fn((table: string) => {
      calls.from.push(table);

      return {
        select: vi.fn(() => {
          const chain: Record<string, any> = {};

          chain.eq = vi.fn((column: string, value: unknown) => {
            calls.eq.push([column, value]);
            return chain;
          });

          chain.is = vi.fn((column: string, value: unknown) => {
            calls.is.push([column, value]);
            return chain;
          });

          chain.range = vi.fn((from: number, to: number) => {
            calls.range.push([from, to]);
            return Promise.resolve(queryResult);
          });

          return chain;
        }),
      };
    }),
  };

  return { client, calls, queryResult };
}

beforeEach(() => {
  vi.clearAllMocks();
  auditMocks.reset();
});

describe('admin search query helpers', () => {
  it('searchByEmail calls RPC with lowercased query and returns enriched users', async () => {
    const { client, calls } = createEmailSearchClient({
      rpcData: [
        {
          id: 'user-1',
          email: 'User@Example.com',
          phone: '+14155551212',
          created_at: '2026-02-01T00:00:00.000Z',
          last_sign_in_at: '2026-02-10T00:00:00.000Z',
          banned_until: 'none',
        },
      ],
      memberships: [
        {
          user_id: 'user-1',
          role: 2,
          organization: {
            id: 101,
            uuid: 'org-uuid-101',
            name: 'Family Org',
          },
        },
      ],
      accounts: [
        {
          id: 'acct-1',
          name: 'Care Account',
          status: 'active',
          plan_id: 'family',
          organization_id: 101,
        },
      ],
      lines: [
        {
          id: 'line-1',
          display_name: 'Grandma Rose',
          phone_e164: '+14155551212',
          status: 'active',
          account_id: 'acct-1',
        },
      ],
    });

    const result = await searchByEmail(client as any, '  USER@EXAMPLE.COM  ');

    expect(calls.rpc).toEqual([
      [
        'search_auth_users_by_email',
        {
          query: 'user@example.com',
          result_limit: 50,
        },
      ],
    ]);
    expect(calls.membershipIn).toEqual([['user_id', ['user-1']]]);
    expect(calls.accountIn).toEqual([['organization_id', [101]]]);
    expect(calls.lineIn).toEqual([['account_id', ['acct-1']]]);
    expect(result).toEqual([
      {
        id: 'user-1',
        email: 'User@Example.com',
        phone: '+14155551212',
        createdAt: '2026-02-01T00:00:00.000Z',
        lastSignInAt: '2026-02-10T00:00:00.000Z',
        isBanned: false,
        organizations: [
          {
            id: 101,
            uuid: 'org-uuid-101',
            name: 'Family Org',
            role: 2,
          },
        ],
        accounts: [
          {
            id: 'acct-1',
            name: 'Care Account',
            status: 'active',
            planId: 'family',
            organizationId: 101,
          },
        ],
        lines: [
          {
            id: 'line-1',
            displayName: 'Grandma Rose',
            phoneE164: '+14155551212',
            status: 'active',
            accountId: 'acct-1',
          },
        ],
      },
    ]);
  });

  it('searchByEmail returns empty array when RPC finds no matches', async () => {
    const { client, calls } = createEmailSearchClient({
      rpcData: [],
    });

    const result = await searchByEmail(client as any, 'missing@example.com');

    expect(result).toEqual([]);
    expect(calls.rpc).toEqual([
      [
        'search_auth_users_by_email',
        {
          query: 'missing@example.com',
          result_limit: 50,
        },
      ],
    ]);
    expect(calls.from).toEqual([]);
  });

  it('searchByPhone queries ultaura_lines using normalized phone variants', async () => {
    const { client, calls } = createPhoneSearchClient();

    const result = await searchByPhone(client as any, '(415) 555-1212');

    expect(result).toEqual([]);
    expect(calls.from).toEqual(['ultaura_lines']);
    expect(calls.select).toEqual(['account_id']);
    expect(calls.ilike).toEqual([]);
    expect(calls.or).toEqual([
      'phone_e164.ilike.%4155551212%,phone_e164.ilike.%+4155551212%,phone_e164.ilike.%14155551212%,phone_e164.ilike.%+14155551212%',
    ]);
  });

  it('searchByUid trims the query before getUserById and returns empty when not found', async () => {
    const getUserById = vi.fn(async () => ({
      data: { user: null },
      error: null,
    }));

    const client = {
      auth: {
        admin: {
          getUserById,
        },
      },
      from: vi.fn(),
    };

    const result = await searchByUid(
      client as any,
      '  550e8400-e29b-41d4-a716-446655440000  ',
    );

    expect(result).toEqual([]);
    expect(getUserById).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('searchByLinePhone filters to E.164 variants only', async () => {
    const { client, calls } = createPhoneSearchClient();

    const result = await searchByLinePhone(client as any, '415-555-1212');

    expect(result).toEqual([]);
    expect(calls.from).toEqual(['ultaura_lines']);
    expect(calls.select).toEqual(['account_id']);
    expect(calls.in).toEqual([
      ['phone_e164', ['+4155551212', '+14155551212']],
    ]);
    expect(calls.or).toEqual([]);
    expect(calls.ilike).toEqual([]);
  });
});

describe('admin organization query pagination', () => {
  it('getOrganizations uses range(0, 19) for page 1 with perPage 20', async () => {
    const { client, calls, queryResult } = createOrganizationsClient();

    const result = await getOrganizations(client as any, '', 1, 20);

    expect(calls.range).toEqual([[0, 19]]);
    expect(result).toEqual({
      organizations: queryResult.data,
      count: queryResult.count,
    });
  });

  it('getMembershipsByOrganizationUid paginates page 1 and page 2 with the correct ranges', async () => {
    const { client, calls, queryResult } = createMembershipsClient();

    const page1 = await getMembershipsByOrganizationUid(client as any, {
      uid: 'org-uid-1',
      page: 1,
      perPage: 20,
    });

    const page2 = await getMembershipsByOrganizationUid(client as any, {
      uid: 'org-uid-1',
      page: 2,
      perPage: 20,
    });

    expect(calls.eq).toEqual([
      ['organization.uuid', 'org-uid-1'],
      ['organization.uuid', 'org-uid-1'],
    ]);
    expect(calls.is).toEqual([
      ['code', null],
      ['code', null],
    ]);
    expect(calls.range).toEqual([
      [0, 19],
      [20, 39],
    ]);
    expect(page1).toEqual({
      data: queryResult.data,
      count: queryResult.count,
    });
    expect(page2).toEqual({
      data: queryResult.data,
      count: queryResult.count,
    });
  });
});

describe('admin audit log helpers', () => {
  it('writeAdminAuditLog inserts the expected payload', async () => {
    await writeAdminAuditLog(
      {
        userId: 'admin-user-1',
        email: 'admin@example.com',
      },
      {
        action: 'admin.search',
        targetType: 'user',
        targetId: 'user-1',
        metadata: { query: 'user@example.com' },
        requestId: 'req-123',
      },
    );

    expect(auditMocks.getSupabaseServerActionClient).toHaveBeenCalledWith({
      admin: true,
    });
    expect(auditMocks.state.fromCalls).toEqual(['ultaura_admin_audit_log']);
    expect(auditMocks.state.insertPayloads).toEqual([
      {
        admin_user_id: 'admin-user-1',
        admin_email: 'admin@example.com',
        action: 'admin.search',
        target_type: 'user',
        target_id: 'user-1',
        metadata: { query: 'user@example.com' },
        request_id: 'req-123',
        ip: '203.0.113.10',
        user_agent: 'Vitest/1.0',
      },
    ]);
    expect(auditMocks.loggerError).not.toHaveBeenCalled();
  });

  it('getCurrentAdminContext returns userId and email', async () => {
    auditMocks.state.authGetUserResult = {
      data: {
        user: {
          id: 'user-123',
          email: 'owner@example.com',
        },
      },
      error: null,
    };

    const result = await getCurrentAdminContext();

    expect(auditMocks.getSupabaseServerActionClient).toHaveBeenCalledWith();
    expect(result).toEqual({
      userId: 'user-123',
      email: 'owner@example.com',
    });
  });

  it('getCurrentAdminContext returns null when no user is present', async () => {
    auditMocks.state.authGetUserResult = {
      data: { user: null },
      error: null,
    };

    const result = await getCurrentAdminContext();

    expect(result).toBeNull();
  });

  it('getRecentAuditLogs paginates and returns rows with total count', async () => {
    auditMocks.state.recentLogsResult = {
      data: [
        {
          id: 1,
          action: 'admin.search',
          created_at: '2026-02-20T00:00:00.000Z',
        },
        {
          id: 2,
          action: 'admin.orgs.list',
          created_at: '2026-02-19T00:00:00.000Z',
        },
      ],
      error: null,
      count: 12,
    };

    const result = await getRecentAuditLogs(2, 4);

    expect(auditMocks.getSupabaseServerActionClient).toHaveBeenCalledWith({
      admin: true,
    });
    expect(auditMocks.state.selectCalls).toEqual([
      ['*', { count: 'exact' }],
    ]);
    expect(auditMocks.state.orderCalls).toEqual([
      ['created_at', { ascending: false }],
    ]);
    expect(auditMocks.state.rangeCalls).toEqual([[4, 5]]);
    expect(result).toEqual({
      logs: auditMocks.state.recentLogsResult.data,
      count: 12,
    });
  });
});
