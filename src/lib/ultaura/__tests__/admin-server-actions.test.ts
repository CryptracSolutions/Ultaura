import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MembershipRole from '~/lib/organizations/types/membership-role';

const mocks = vi.hoisted(() => {
  const state = {
    withAdminAllowed: true,
    superAdminAllowed: true,
    currentAdminContext: {
      userId: 'admin-user-1',
      email: 'admin@example.com',
    } as { userId: string; email: string } | null,
    requireSessionResult: {
      user: {
        id: 'session-admin-1',
        email: 'session-admin@example.com',
      },
    } as { user: { id: string; email?: string | null } },
    getSupabaseCalls: [] as Array<Record<string, unknown> | undefined>,
    getSupabaseClientImpl: null as null | ((options?: Record<string, unknown>) => any),
  };

  const loggerFns = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  const withAdminSession = vi.fn((fn: (...args: any[]) => any) => {
    return async (...args: any[]) => {
      if (!state.withAdminAllowed) {
        throw new Error('Unauthorized');
      }

      return await fn(...args);
    };
  });

  const getSupabaseServerActionClient = vi.fn(
    (options?: Record<string, unknown>) => {
      state.getSupabaseCalls.push(options);

      if (!state.getSupabaseClientImpl) {
        throw new Error('No Supabase client mock configured for this test');
      }

      return state.getSupabaseClientImpl(options);
    },
  );

  const writeAdminAuditLog = vi.fn(async () => undefined);
  const getCurrentAdminContext = vi.fn(async () => state.currentAdminContext);
  const isUserSuperAdmin = vi.fn(async () => state.superAdminAllowed);
  const requireSession = vi.fn(async () => state.requireSessionResult);
  const deleteUser = vi.fn(async () => undefined);
  const revalidatePath = vi.fn();
  const redirect = vi.fn();
  const sanitizeHtml = vi.fn((html: string) =>
    `SANITIZED:${String(html).replace(/<[^>]*>/g, '')}`,
  );
  const renderBroadcastHtmlEmail = vi.fn((params: Record<string, unknown>) => ({
    html: `RENDERED:${String((params as { htmlContent?: string }).htmlContent ?? '')}`,
  }));

  const resend = {
    listBroadcasts: vi.fn(),
    getBroadcast: vi.fn(),
    createBroadcast: vi.fn(),
    sendBroadcast: vi.fn(),
    scheduleBroadcast: vi.fn(),
    removeBroadcast: vi.fn(),
  };

  const decodeBytea = vi.fn((value: unknown) =>
    value ? Buffer.from(String(value)) : null,
  );
  const decryptDebugPayload = vi.fn(async () => null);

  return {
    state,
    loggerFns,
    withAdminSession,
    getSupabaseServerActionClient,
    writeAdminAuditLog,
    getCurrentAdminContext,
    isUserSuperAdmin,
    requireSession,
    deleteUser,
    revalidatePath,
    redirect,
    sanitizeHtml,
    renderBroadcastHtmlEmail,
    resend,
    decodeBytea,
    decryptDebugPayload,
  };
});

vi.mock('~/core/generic/actions-utils', () => ({
  withAdminSession: mocks.withAdminSession,
}));

vi.mock('~/core/supabase/action-client', () => ({
  default: mocks.getSupabaseServerActionClient,
}));

vi.mock('~/lib/ultaura/admin/audit-log', () => ({
  writeAdminAuditLog: mocks.writeAdminAuditLog,
  getCurrentAdminContext: mocks.getCurrentAdminContext,
}));

vi.mock('~/app/admin/utils/is-user-super-admin', () => ({
  __esModule: true,
  default: mocks.isUserSuperAdmin,
}));

vi.mock('~/lib/user/require-session', () => ({
  default: mocks.requireSession,
}));

vi.mock('~/core/logger', () => ({
  default: vi.fn(() => mocks.loggerFns),
}));

vi.mock('~/lib/server/user/delete-user', () => ({
  deleteUser: mocks.deleteUser,
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('sanitize-html', () => ({
  __esModule: true,
  default: mocks.sanitizeHtml,
}));

vi.mock('~/lib/emails/newsletter-broadcast', () => ({
  renderBroadcastHtmlEmail: mocks.renderBroadcastHtmlEmail,
}));

vi.mock('~/lib/resend/broadcasts', () => ({
  listBroadcasts: mocks.resend.listBroadcasts,
  getBroadcast: mocks.resend.getBroadcast,
  createBroadcast: mocks.resend.createBroadcast,
  sendBroadcast: mocks.resend.sendBroadcast,
  scheduleBroadcast: mocks.resend.scheduleBroadcast,
  removeBroadcast: mocks.resend.removeBroadcast,
}));

vi.mock('~/lib/ultaura/bytea', () => ({
  decodeBytea: mocks.decodeBytea,
}));

vi.mock('~/lib/ultaura/debug-log-decrypt', () => ({
  decryptDebugPayload: mocks.decryptDebugPayload,
}));

import {
  banUser,
  deleteUserAction,
  impersonateUser,
  reactivateUser,
} from '~/app/admin/users/@modal/[uid]/actions.server';
import {
  adminAddMember,
  adminChangeMemberRole,
  adminRemoveMember,
  adminTransferOwnership,
} from '~/app/admin/organizations/[uid]/actions.server';
import { getDebugLogs } from '~/lib/ultaura/admin-actions';
import {
  adminCancelBroadcast,
  adminCreateAndSendBroadcast,
  adminGetBroadcast,
  adminListBroadcasts,
  getSubscriberStats,
  listSubscribers,
} from '~/lib/ultaura/newsletter-admin-actions';

function createThenableChain<T>(
  base: Record<string, any>,
  getResult: () => T,
): Record<string, any> {
  base.then = (
    onFulfilled: (value: T) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(getResult()).then(onFulfilled, onRejected);
  base.catch = (onRejected: (reason: unknown) => unknown) =>
    Promise.resolve(getResult()).catch(onRejected);
  base.finally = (onFinally: () => void) =>
    Promise.resolve(getResult()).finally(onFinally);
  return base;
}

function createGenericQueryChain<T>(
  result: T,
  record: {
    eq?: Array<[string, unknown]>;
    in?: Array<[string, unknown[]]>;
    is?: Array<[string, unknown]>;
    gte?: Array<[string, unknown]>;
    lte?: Array<[string, unknown]>;
    order?: Array<[string, unknown]>;
    range?: Array<[number, number]>;
  } = {},
) {
  const chain: Record<string, any> = {};

  chain.eq = vi.fn((column: string, value: unknown) => {
    record.eq?.push([column, value]);
    return chain;
  });

  chain.in = vi.fn((column: string, value: unknown[]) => {
    record.in?.push([column, value]);
    return chain;
  });

  chain.is = vi.fn((column: string, value: unknown) => {
    record.is?.push([column, value]);
    return chain;
  });

  chain.gte = vi.fn((column: string, value: unknown) => {
    record.gte?.push([column, value]);
    return chain;
  });

  chain.lte = vi.fn((column: string, value: unknown) => {
    record.lte?.push([column, value]);
    return chain;
  });

  chain.order = vi.fn((column: string, value: unknown) => {
    record.order?.push([column, value]);
    return chain;
  });

  chain.range = vi.fn((from: number, to: number) => {
    record.range?.push([from, to]);
    return chain;
  });

  chain.single = vi.fn(async () => result);
  chain.maybeSingle = vi.fn(async () => result);

  return createThenableChain(chain, () => result);
}

function makeFormData(values: Record<string, string | number>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, String(value));
  }

  return formData;
}

function configureUserActionClients(options?: {
  currentUserId?: string;
  targetEmail?: string | null;
  updateUserError?: { message: string } | null;
  getUserByIdError?: { message: string } | null;
  generateLinkError?: { message: string } | null;
  actionLink?: string;
}) {
  const regularClient = {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: options?.currentUserId === null
            ? null
            : { id: options?.currentUserId ?? 'current-admin-user' },
        },
      })),
    },
  };

  const adminClient = {
    auth: {
      admin: {
        updateUserById: vi.fn(async () => ({
          data: null,
          error: options?.updateUserError ?? null,
        })),
        getUserById: vi.fn(async () => ({
          data: {
            user: options?.getUserByIdError
              ? null
              : {
                  id: 'target-user-1',
                  email: options?.targetEmail ?? 'target@example.com',
                },
          },
          error: options?.getUserByIdError ?? null,
        })),
        generateLink: vi.fn(async () => ({
          error: options?.generateLinkError ?? null,
          data: options?.generateLinkError
            ? null
            : {
                properties: {
                  action_link:
                    options?.actionLink ??
                    'https://ultaura.test/#access_token=access-123&refresh_token=refresh-456',
                },
              },
        })),
      },
    },
  };

  mocks.state.getSupabaseClientImpl = (supabaseOptions?: Record<string, unknown>) =>
    supabaseOptions?.admin ? adminClient : regularClient;

  return { regularClient, adminClient };
}

type OrgScript = {
  memberships?: {
    selectResults?: Array<any>;
    updateResults?: Array<any>;
    deleteResults?: Array<any>;
    insertResults?: Array<any>;
  };
  organizations?: {
    selectResults?: Array<any>;
  };
  rpcResults?: Array<{ data: unknown; error: { message: string } | null }>;
};

function shiftOrThrow<T>(queue: T[] | undefined, label: string): T {
  if (!queue || queue.length === 0) {
    throw new Error(`Missing scripted result for ${label}`);
  }

  return queue.shift() as T;
}

function configureOrgAdminClient(script: OrgScript) {
  const records = {
    membershipSelectEq: [] as Array<[string, unknown]>,
    membershipSelectIs: [] as Array<[string, unknown]>,
    membershipUpdateEq: [] as Array<[string, unknown]>,
    membershipDeleteEq: [] as Array<[string, unknown]>,
    organizationSelectEq: [] as Array<[string, unknown]>,
    membershipInsertPayloads: [] as Array<Record<string, unknown>>,
    membershipUpdatePayloads: [] as Array<Record<string, unknown>>,
    rpcCalls: [] as Array<[string, Record<string, unknown>]>,
  };

  const membershipsTable = {
    select: vi.fn(() => {
      const result = shiftOrThrow(script.memberships?.selectResults, 'memberships.select');
      return createGenericQueryChain(result, {
        eq: records.membershipSelectEq,
        is: records.membershipSelectIs,
      });
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      records.membershipUpdatePayloads.push(payload);
      const result = shiftOrThrow(script.memberships?.updateResults, 'memberships.update');
      return createGenericQueryChain(result, {
        eq: records.membershipUpdateEq,
      });
    }),
    delete: vi.fn(() => {
      const result = shiftOrThrow(script.memberships?.deleteResults, 'memberships.delete');
      return createGenericQueryChain(result, {
        eq: records.membershipDeleteEq,
      });
    }),
    insert: vi.fn(async (payload: Record<string, unknown>) => {
      records.membershipInsertPayloads.push(payload);
      return shiftOrThrow(script.memberships?.insertResults, 'memberships.insert');
    }),
  };

  const organizationsTable = {
    select: vi.fn(() => {
      const result = shiftOrThrow(script.organizations?.selectResults, 'organizations.select');
      return createGenericQueryChain(result, {
        eq: records.organizationSelectEq,
      });
    }),
  };

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'memberships') return membershipsTable;
      if (table === 'organizations') return organizationsTable;
      throw new Error(`Unexpected table in org test: ${table}`);
    }),
    rpc: vi.fn(async (fnName: string, params: Record<string, unknown>) => {
      records.rpcCalls.push([fnName, params]);
      return shiftOrThrow(script.rpcResults, 'rpc');
    }),
  };

  mocks.state.getSupabaseClientImpl = (supabaseOptions?: Record<string, unknown>) => {
    if (!supabaseOptions?.admin) {
      throw new Error('Expected admin Supabase client for organization actions');
    }

    return client;
  };

  return { client, records };
}

function configureNewsletterSubscriberClient(options?: {
  result?: { data: any[]; count: number | null; error: { message: string } | null };
}) {
  const records = {
    selectColumns: [] as string[],
    eq: [] as Array<[string, unknown]>,
    order: [] as Array<[string, unknown]>,
    range: [] as Array<[number, number]>,
  };

  const queryResult =
    options?.result ?? ({ data: [], count: 0, error: null } as const);

  const subscribersTable = {
    select: vi.fn((columns: string) => {
      records.selectColumns.push(columns);
      return createGenericQueryChain(queryResult, {
        eq: records.eq,
        order: records.order,
        range: records.range,
      });
    }),
  };

  const client = {
    from: vi.fn((table: string) => {
      if (table !== 'ultaura_newsletter_subscribers') {
        throw new Error(`Unexpected newsletter table: ${table}`);
      }
      return subscribersTable;
    }),
  };

  mocks.state.getSupabaseClientImpl = (supabaseOptions?: Record<string, unknown>) => {
    if (supabaseOptions?.admin) return client;
    return { auth: { getUser: vi.fn() } };
  };

  return { client, records };
}

function configureNewsletterStatsClient(counts: {
  confirmed: number;
  pending: number;
  unsubscribed: number;
  blogDigest: number;
  elderCareTips: number;
  productUpdates: number;
}) {
  const subscriberResults = [
    { data: null, count: counts.confirmed, error: null },
    { data: null, count: counts.pending, error: null },
    { data: null, count: counts.unsubscribed, error: null },
  ];
  const topicResults = [
    { data: null, count: counts.blogDigest, error: null },
    { data: null, count: counts.elderCareTips, error: null },
    { data: null, count: counts.productUpdates, error: null },
  ];

  const client = {
    from: vi.fn((table: string) => {
      if (
        table !== 'ultaura_newsletter_subscribers' &&
        table !== 'ultaura_newsletter_topic_subscriptions'
      ) {
        throw new Error(`Unexpected table for stats: ${table}`);
      }

      return {
        select: vi.fn(() => {
          if (table === 'ultaura_newsletter_subscribers') {
            return createGenericQueryChain(
              shiftOrThrow(subscriberResults, 'newsletter_subscribers.stats'),
            );
          }

          return createGenericQueryChain(
            shiftOrThrow(topicResults, 'newsletter_topic_subscriptions.stats'),
          );
        }),
      };
    }),
  };

  mocks.state.getSupabaseClientImpl = (supabaseOptions?: Record<string, unknown>) => {
    if (supabaseOptions?.admin) return client;
    return { auth: { getUser: vi.fn() } };
  };

  return { client };
}

function configureDebugLogsClients(options?: {
  rows?: any[];
  count?: number;
  error?: { message: string } | null;
}) {
  const records = {
    eq: [] as Array<[string, unknown]>,
    gte: [] as Array<[string, unknown]>,
    lte: [] as Array<[string, unknown]>,
    order: [] as Array<[string, unknown]>,
    range: [] as Array<[number, number]>,
  };

  const queryResult = {
    data:
      options?.rows ??
      [
        {
          id: 'log-1',
          account_id: 'acct-1',
          call_session_id: 'call-1',
          event_type: 'tool_call',
          tool_name: 'lookup',
          payload_summary: { note: 'summary' },
          metadata: { tag: 'a' },
          payload: { ok: true },
          payload_ciphertext: null,
          payload_iv: null,
          payload_tag: null,
          payload_alg: null,
          payload_kid: null,
          created_at: '2026-02-21T00:00:00.000Z',
        },
      ],
    error: options?.error ?? null,
    count: options?.count ?? 1,
  };

  const debugLogsTable = {
    select: vi.fn(() =>
      createGenericQueryChain(queryResult, {
        eq: records.eq,
        gte: records.gte,
        lte: records.lte,
        order: records.order,
        range: records.range,
      }),
    ),
  };

  const adminClient = {
    from: vi.fn((table: string) => {
      if (table !== 'ultaura_debug_logs') {
        throw new Error(`Unexpected debug logs table: ${table}`);
      }
      return debugLogsTable;
    }),
  };

  const sessionClient = { auth: { getUser: vi.fn() } };

  mocks.state.getSupabaseClientImpl = (supabaseOptions?: Record<string, unknown>) =>
    supabaseOptions?.admin ? adminClient : sessionClient;

  return { adminClient, sessionClient, records };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.withAdminAllowed = true;
  mocks.state.superAdminAllowed = true;
  mocks.state.currentAdminContext = {
    userId: 'admin-user-1',
    email: 'admin@example.com',
  };
  mocks.state.requireSessionResult = {
    user: {
      id: 'session-admin-1',
      email: 'session-admin@example.com',
    },
  };
  mocks.state.getSupabaseCalls = [];
  mocks.state.getSupabaseClientImpl = () => ({ auth: { getUser: vi.fn() } });
  mocks.redirect.mockImplementation(() => undefined);
  mocks.resend.listBroadcasts.mockResolvedValue({ data: { data: [] }, error: null });
  mocks.resend.getBroadcast.mockResolvedValue({ data: null, error: null });
  mocks.resend.createBroadcast.mockResolvedValue({ data: null, error: null });
  mocks.resend.sendBroadcast.mockResolvedValue({ error: null });
  mocks.resend.scheduleBroadcast.mockResolvedValue({ error: null });
  mocks.resend.removeBroadcast.mockResolvedValue({ error: null });
  mocks.writeAdminAuditLog.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('user admin server actions', () => {
  it.each([
    ['banUser', () => banUser({ userId: 'user-1' })],
    ['reactivateUser', () => reactivateUser({ userId: 'user-1' })],
    ['impersonateUser', () => impersonateUser({ userId: 'user-1' })],
    ['deleteUserAction', () => deleteUserAction({ userId: 'user-1' })],
  ])('blocks %s when withAdminSession denies access', async (_name, runAction) => {
    mocks.state.withAdminAllowed = false;
    configureUserActionClients();

    await expect(runAction()).rejects.toThrow('Unauthorized');
    expect(mocks.writeAdminAuditLog).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it('banUser writes audit log and bans target user', async () => {
    const { adminClient } = configureUserActionClients({
      currentUserId: 'another-admin',
    });

    await banUser({ userId: 'target-1' });

    expect(adminClient.auth.admin.updateUserById).toHaveBeenCalledWith('target-1', {
      ban_duration: '876600h',
    });
    expect(mocks.writeAdminAuditLog).toHaveBeenCalledWith(
      { userId: 'admin-user-1', email: 'admin@example.com' },
      expect.objectContaining({
        action: 'user.ban',
        targetType: 'user',
        targetId: 'target-1',
      }),
    );
  });

  it('reactivateUser writes audit log and removes ban', async () => {
    const { adminClient } = configureUserActionClients({
      currentUserId: 'another-admin',
    });

    await reactivateUser({ userId: 'target-2' });

    expect(adminClient.auth.admin.updateUserById).toHaveBeenCalledWith('target-2', {
      ban_duration: 'none',
    });
    expect(mocks.writeAdminAuditLog).toHaveBeenCalledWith(
      { userId: 'admin-user-1', email: 'admin@example.com' },
      expect.objectContaining({
        action: 'user.reactivate',
        targetType: 'user',
        targetId: 'target-2',
      }),
    );
  });

  it('impersonateUser writes audit log and returns tokens', async () => {
    configureUserActionClients({ currentUserId: 'another-admin' });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        headers: {
          get: (name: string) =>
            name === 'Location'
              ? 'https://ultaura.test/#access_token=imp-123&refresh_token=imp-456'
              : null,
        },
      })),
    );

    const result = await impersonateUser({ userId: 'target-3' });

    expect(result).toEqual({
      accessToken: 'imp-123',
      refreshToken: 'imp-456',
    });
    expect(mocks.writeAdminAuditLog).toHaveBeenCalledWith(
      { userId: 'admin-user-1', email: 'admin@example.com' },
      expect.objectContaining({
        action: 'user.impersonate',
        targetType: 'user',
        targetId: 'target-3',
      }),
    );
  });

  it('impersonateUser prevents self-target actions and skips audit logging', async () => {
    configureUserActionClients({ currentUserId: 'target-self' });

    await expect(impersonateUser({ userId: 'target-self' })).rejects.toThrow(
      'You cannot perform a destructive action on your own account as a Super Admin',
    );
    expect(mocks.writeAdminAuditLog).not.toHaveBeenCalled();
  });

  it('deleteUserAction writes audit log and deletes the user', async () => {
    configureUserActionClients({ currentUserId: 'another-admin' });

    await deleteUserAction({ userId: 'target-4' });

    expect(mocks.deleteUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'target-4', sendEmail: false }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/users', 'page');
    expect(mocks.redirect).toHaveBeenCalledWith('/admin/users');
    expect(mocks.writeAdminAuditLog).toHaveBeenCalledWith(
      { userId: 'admin-user-1', email: 'admin@example.com' },
      expect.objectContaining({
        action: 'user.delete',
        targetType: 'user',
        targetId: 'target-4',
      }),
    );
  });

  it('deleteUserAction prevents deleting the current super admin account', async () => {
    configureUserActionClients({ currentUserId: 'target-self' });

    await expect(deleteUserAction({ userId: 'target-self' })).rejects.toThrow(
      'You cannot perform a destructive action on your own account as a Super Admin',
    );
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.writeAdminAuditLog).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe('organization admin server actions', () => {
  it.each([
    ['adminTransferOwnership', () => adminTransferOwnership(makeFormData({ orgId: 'org-1', newOwnerMembershipId: 11 }))],
    ['adminAddMember', () => adminAddMember(makeFormData({ orgUid: 'org-uid-1', email: 'new@example.com', role: MembershipRole.Member }))],
    ['adminChangeMemberRole', () => adminChangeMemberRole(makeFormData({ membershipId: 12, newRole: MembershipRole.Admin, orgUid: 'org-uid-1' }))],
    ['adminRemoveMember', () => adminRemoveMember(makeFormData({ membershipId: 13, orgUid: 'org-uid-1' }))],
  ])('blocks %s when withAdminSession denies access', async (_name, runAction) => {
    mocks.state.withAdminAllowed = false;
    configureOrgAdminClient({});

    await expect(runAction()).rejects.toThrow('Unauthorized');
    expect(mocks.writeAdminAuditLog).not.toHaveBeenCalled();
  });

  it('adminTransferOwnership writes audit log with previous and new owner metadata', async () => {
    configureOrgAdminClient({
      memberships: {
        selectResults: [
          {
            data: {
              id: 22,
              role: MembershipRole.Member,
              user_id: 'user-new-owner',
              organization_id: 77,
            },
            error: null,
          },
          {
            data: { id: 10, user_id: 'user-current-owner' },
            error: null,
          },
        ],
        updateResults: [{ error: null }, { error: null }],
      },
    });

    await adminTransferOwnership(
      makeFormData({ orgId: 'org-77', newOwnerMembershipId: 22 }),
    );

    expect(mocks.writeAdminAuditLog).toHaveBeenCalledWith(
      { userId: 'admin-user-1', email: 'admin@example.com' },
      expect.objectContaining({
        action: 'transfer_ownership',
        targetType: 'organization',
        targetId: 'org-77',
        metadata: expect.objectContaining({
          previousOwnerId: 'user-current-owner',
          newOwnerId: 'user-new-owner',
          previousOwnerMembershipId: 10,
          newOwnerMembershipId: 22,
        }),
      }),
    );
  });

  it('adminTransferOwnership rejects when selected member is already owner', async () => {
    configureOrgAdminClient({
      memberships: {
        selectResults: [
          {
            data: {
              id: 22,
              role: MembershipRole.Owner,
              user_id: 'owner-1',
              organization_id: 77,
            },
            error: null,
          },
        ],
      },
    });

    await expect(
      adminTransferOwnership(makeFormData({ orgId: 'org-77', newOwnerMembershipId: 22 })),
    ).rejects.toThrow('This member is already the owner');
    expect(mocks.writeAdminAuditLog).not.toHaveBeenCalled();
  });

  it('adminAddMember writes audit log and normalizes to a non-owner role', async () => {
    const { records } = configureOrgAdminClient({
      organizations: {
        selectResults: [{ data: { id: 88 }, error: null }],
      },
      rpcResults: [{ data: { user_id: 'auth-user-22' }, error: null }],
      memberships: {
        selectResults: [{ data: null, error: null }],
        insertResults: [{ error: null }],
      },
    });

    await adminAddMember(
      makeFormData({
        orgUid: 'org-uid-88',
        email: ' New@Example.com ',
        role: MembershipRole.Admin,
      }),
    );

    expect(records.rpcCalls).toEqual([
      ['get_user_id_by_email', { lookup_email: 'new@example.com' }],
    ]);
    expect(records.membershipInsertPayloads[0]).toMatchObject({
      organization_id: 88,
      user_id: 'auth-user-22',
      role: MembershipRole.Admin,
    });
    expect(mocks.writeAdminAuditLog).toHaveBeenCalledWith(
      { userId: 'admin-user-1', email: 'admin@example.com' },
      expect.objectContaining({
        action: 'add_member',
        targetType: 'organization',
        targetId: 'org-uid-88',
        metadata: expect.objectContaining({
          addedUserId: 'auth-user-22',
          addedEmail: 'new@example.com',
          role: MembershipRole.Admin,
        }),
      }),
    );
  });

  it('adminAddMember rejects owner role assignment', async () => {
    configureOrgAdminClient({});

    await expect(
      adminAddMember(
        makeFormData({
          orgUid: 'org-uid-99',
          email: 'owner@example.com',
          role: MembershipRole.Owner,
        }),
      ),
    ).rejects.toThrow('Cannot add a member as Owner. Use transfer ownership instead.');
    expect(mocks.writeAdminAuditLog).not.toHaveBeenCalled();
  });

  it('adminChangeMemberRole writes audit log for role updates', async () => {
    const { records } = configureOrgAdminClient({
      memberships: {
        selectResults: [
          {
            data: {
              id: 41,
              role: MembershipRole.Member,
              user_id: 'user-41',
            },
            error: null,
          },
        ],
        updateResults: [{ error: null }],
      },
    });

    await adminChangeMemberRole(
      makeFormData({
        membershipId: 41,
        newRole: MembershipRole.Admin,
        orgUid: 'org-uid-41',
      }),
    );

    expect(records.membershipUpdatePayloads[0]).toEqual({ role: MembershipRole.Admin });
    expect(mocks.writeAdminAuditLog).toHaveBeenCalledWith(
      { userId: 'admin-user-1', email: 'admin@example.com' },
      expect.objectContaining({
        action: 'change_member_role',
        targetType: 'membership',
        targetId: '41',
        metadata: expect.objectContaining({
          userId: 'user-41',
          previousRole: MembershipRole.Member,
          newRole: MembershipRole.Admin,
          orgUid: 'org-uid-41',
        }),
      }),
    );
  });

  it('adminChangeMemberRole rejects direct owner assignment', async () => {
    configureOrgAdminClient({});

    await expect(
      adminChangeMemberRole(
        makeFormData({ membershipId: 41, newRole: MembershipRole.Owner, orgUid: 'org-uid-41' }),
      ),
    ).rejects.toThrow('Cannot set role to Owner directly. Use transfer ownership instead.');
    expect(mocks.writeAdminAuditLog).not.toHaveBeenCalled();
  });

  it('adminRemoveMember writes audit log for member removal', async () => {
    configureOrgAdminClient({
      memberships: {
        selectResults: [
          {
            data: {
              id: 55,
              role: MembershipRole.Admin,
              user_id: 'user-55',
            },
            error: null,
          },
        ],
        deleteResults: [{ error: null }],
      },
    });

    await adminRemoveMember(makeFormData({ membershipId: 55, orgUid: 'org-uid-55' }));

    expect(mocks.writeAdminAuditLog).toHaveBeenCalledWith(
      { userId: 'admin-user-1', email: 'admin@example.com' },
      expect.objectContaining({
        action: 'remove_member',
        targetType: 'membership',
        targetId: '55',
        metadata: expect.objectContaining({
          userId: 'user-55',
          role: MembershipRole.Admin,
          orgUid: 'org-uid-55',
        }),
      }),
    );
  });

  it('adminRemoveMember rejects removing the owner', async () => {
    configureOrgAdminClient({
      memberships: {
        selectResults: [
          {
            data: {
              id: 55,
              role: MembershipRole.Owner,
              user_id: 'owner-55',
            },
            error: null,
          },
        ],
      },
    });

    await expect(
      adminRemoveMember(makeFormData({ membershipId: 55, orgUid: 'org-uid-55' })),
    ).rejects.toThrow('Cannot remove the organization owner. Transfer ownership first.');
    expect(mocks.writeAdminAuditLog).not.toHaveBeenCalled();
  });
});

describe('newsletter admin actions audit + sanitization', () => {
  it('listSubscribers rejects unauthorized access for non-admin users', async () => {
    mocks.state.superAdminAllowed = false;
    configureNewsletterSubscriberClient();

    await expect(
      listSubscribers({ page: 1, perPage: 25, status: 'confirmed' }),
    ).rejects.toThrow('Unauthorized');
    expect(mocks.writeAdminAuditLog).not.toHaveBeenCalled();
  });

  it('listSubscribers rejects unauthorized access for super-admin users lacking MFA', async () => {
    mocks.state.superAdminAllowed = false;
    configureNewsletterSubscriberClient();

    await expect(
      listSubscribers({ page: 1, perPage: 25, status: 'confirmed' }),
    ).rejects.toThrow('Unauthorized');
    expect(mocks.writeAdminAuditLog).not.toHaveBeenCalled();
  });

  it('listSubscribers writes an audit entry without subscriber emails in metadata', async () => {
    configureNewsletterSubscriberClient({
      result: {
        data: [
          {
            id: 'sub-1',
            email: 'alpha@example.com',
            first_name: 'Alpha',
            status: 'confirmed',
            source: 'website',
            confirmed_at: '2026-01-01T00:00:00.000Z',
            created_at: '2026-01-01T00:00:00.000Z',
            ultaura_newsletter_topic_subscriptions: [
              { topic_key: 'blog_digest', subscribed: true },
            ],
          },
        ],
        count: 1,
        error: null,
      },
    });

    const result = await listSubscribers({
      page: 1,
      perPage: 25,
      status: 'confirmed',
      source: 'website',
    });

    expect(result.subscribers).toHaveLength(1);
    expect(result.effectivePerPage).toBe(25);
    expect(mocks.writeAdminAuditLog).toHaveBeenCalledTimes(1);

    const auditEntry = (mocks.writeAdminAuditLog.mock.calls[0] as any[])[1];
    expect(auditEntry).toMatchObject({
      action: 'newsletter.subscribers.list',
      targetType: 'newsletter_subscribers',
      metadata: expect.objectContaining({
        resultCount: 1,
        filters: expect.objectContaining({
          page: 1,
          perPage: 25,
          status: 'confirmed',
          source: 'website',
        }),
      }),
    });
    expect((auditEntry as any).metadata).not.toHaveProperty('subscribers');
    expect(JSON.stringify((auditEntry as any).metadata)).not.toContain('alpha@example.com');
  });

  it('listSubscribers skips audit logging when admin context is unavailable', async () => {
    mocks.state.currentAdminContext = null;
    configureNewsletterSubscriberClient();

    await listSubscribers({ page: 1, perPage: 25 });

    expect(mocks.getCurrentAdminContext).toHaveBeenCalledTimes(1);
    expect(mocks.writeAdminAuditLog).not.toHaveBeenCalled();
  });

  it.each([
    { perPage: 999, page: 1, expected: 100, expectedRange: [0, 99] },
    { perPage: 0, page: 2, expected: 1, expectedRange: [1, 1] },
    { perPage: Number.NaN, page: 2, expected: 25, expectedRange: [25, 49] },
    { perPage: 10.9, page: 3, expected: 10, expectedRange: [20, 29] },
  ])(
    'listSubscribers clamps perPage=$perPage to effectivePerPage=$expected',
    async ({ perPage, page, expected, expectedRange }) => {
      const { records } = configureNewsletterSubscriberClient();

      const result = await listSubscribers({ page, perPage });

      expect(result.effectivePerPage).toBe(expected);
      expect(records.range.at(-1)).toEqual(expectedRange);
    },
  );

  it('getSubscriberStats does not write an audit log', async () => {
    configureNewsletterStatsClient({
      confirmed: 10,
      pending: 2,
      unsubscribed: 3,
      blogDigest: 11,
      elderCareTips: 7,
      productUpdates: 5,
    });

    const result = await getSubscriberStats();

    expect(result).toEqual({
      confirmed: 10,
      pending: 2,
      unsubscribed: 3,
      topicCounts: {
        blog_digest: 11,
        elder_care_tips: 7,
        product_updates: 5,
      },
    });
    expect(mocks.writeAdminAuditLog).not.toHaveBeenCalled();
  });

  it('adminListBroadcasts does not write an audit log', async () => {
    mocks.resend.listBroadcasts.mockResolvedValue({
      data: { data: [{ id: 'b-1' }] },
      error: null,
    });

    const result = await adminListBroadcasts();

    expect(result).toEqual({ broadcasts: [{ id: 'b-1' }], error: null });
    expect(mocks.writeAdminAuditLog).not.toHaveBeenCalled();
  });

  it('adminGetBroadcast sanitizes HTML and does not write an audit log', async () => {
    mocks.resend.getBroadcast.mockResolvedValue({
      data: { id: 'b-2', html: '<script>alert(1)</script><p>Hello</p>' },
      error: null,
    });

    const result = await adminGetBroadcast('b-2');

    expect(mocks.sanitizeHtml).toHaveBeenCalledWith(
      '<script>alert(1)</script><p>Hello</p>',
      expect.any(Object),
    );
    expect(result).toEqual({
      broadcast: { id: 'b-2', html: 'SANITIZED:alert(1)Hello' },
      error: null,
    });
    expect(mocks.writeAdminAuditLog).not.toHaveBeenCalled();
  });

  it('adminCreateAndSendBroadcast writes audit metadata without raw HTML', async () => {
    mocks.resend.createBroadcast.mockResolvedValue({
      data: { id: 'broadcast-123' },
      error: null,
    });
    mocks.resend.sendBroadcast.mockResolvedValue({ error: null });

    const result = await adminCreateAndSendBroadcast({
      subject: 'Weekly Update',
      previewText: 'Preview line',
      html: '<p>Hello</p><script>bad()</script>',
      topicKey: 'blog_digest',
    });

    expect(result).toEqual({
      success: true,
      broadcastId: 'broadcast-123',
      action: 'sent',
    });
    expect(mocks.sanitizeHtml).toHaveBeenCalledWith(
      '<p>Hello</p><script>bad()</script>',
      expect.any(Object),
    );
    expect(mocks.renderBroadcastHtmlEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: 'SANITIZED:Hellobad()',
      }),
    );

    const auditEntry = (mocks.writeAdminAuditLog.mock.calls[0] as any[])[1];
    expect(auditEntry).toMatchObject({
      action: 'newsletter.broadcast.send',
      targetType: 'broadcast',
      targetId: 'broadcast-123',
      metadata: expect.objectContaining({
        broadcastId: 'broadcast-123',
        subject: 'Weekly Update',
        topicKey: 'blog_digest',
        action: 'sent',
      }),
    });
    expect((auditEntry as any).metadata).not.toHaveProperty('html');
    expect((auditEntry as any).metadata).not.toHaveProperty('renderedHtml');
    expect(JSON.stringify((auditEntry as any).metadata)).not.toContain('<p>');
    expect(JSON.stringify((auditEntry as any).metadata)).not.toContain('<script>');
  });

  it('adminCancelBroadcast writes an audit entry when admin context exists', async () => {
    mocks.resend.removeBroadcast.mockResolvedValue({ error: null });

    const result = await adminCancelBroadcast('broadcast-999');

    expect(result).toEqual({ success: true });
    expect(mocks.writeAdminAuditLog).toHaveBeenCalledWith(
      { userId: 'admin-user-1', email: 'admin@example.com' },
      expect.objectContaining({
        action: 'newsletter.broadcast.cancel',
        targetType: 'broadcast',
        targetId: 'broadcast-999',
        metadata: { broadcastId: 'broadcast-999' },
      }),
    );
  });
});

describe('getDebugLogs', () => {
  it('rejects unauthorized access when isUltauraAdmin returns false', async () => {
    mocks.state.superAdminAllowed = false;
    configureDebugLogsClients();

    await expect(getDebugLogs({ limit: 20 })).rejects.toThrow('Unauthorized');
    expect(mocks.writeAdminAuditLog).not.toHaveBeenCalled();
  });

  it('caps limit at 200 and writes the decrypt audit log entry', async () => {
    const { records } = configureDebugLogsClients({ count: 1 });

    const result = await getDebugLogs({ limit: 999, offset: 10 });

    expect(result.count).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(records.range).toEqual([[10, 209]]);

    expect(mocks.writeAdminAuditLog).toHaveBeenCalledWith(
      {
        userId: 'session-admin-1',
        email: 'session-admin@example.com',
      },
      expect.objectContaining({
        action: 'admin.debug_logs.decrypt',
        targetType: 'debug_logs',
        metadata: expect.objectContaining({
          returnedCount: 1,
          totalCount: 1,
          filters: expect.objectContaining({
            limit: 200,
            offset: 10,
          }),
        }),
      }),
    );
  });

  it('uses default limit 50 when no limit is provided', async () => {
    const { records } = configureDebugLogsClients({ count: 1 });

    await getDebugLogs({});

    expect(records.range).toEqual([[0, 49]]);
    const auditEntry = (mocks.writeAdminAuditLog.mock.calls[0] as any[])[1];
    expect((auditEntry as any).action).toBe('admin.debug_logs.decrypt');
    expect((auditEntry as any).metadata.filters.limit).toBe(50);
    expect((auditEntry as any).metadata.filters.offset).toBe(0);
  });
});
