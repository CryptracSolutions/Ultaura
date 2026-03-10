import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return { ...actual, cache: (fn: (...args: unknown[]) => unknown) => fn };
});
vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Map()),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));
vi.mock('next/dist/client/components/redirect', () => ({
  isRedirectError: vi.fn(() => false),
  getURLFromRedirectError: vi.fn(() => '/'),
}));

const getSupabaseServerComponentClient = vi.fn();
const requireSessionMock = vi.fn();
const getOrganizationsByUserIdMock = vi.fn();
const getUserDataByIdMock = vi.fn();
const initializeServerI18nMock = vi.fn(async () => ({ language: 'en' }));
const getLanguageCookieMock = vi.fn(() => 'en');
const getUIStateCookiesMock = vi.fn(() => ({}));
const parseOrganizationIdCookieMock = vi.fn(async () => undefined);
const hasManualOrganizationSelectionCookieMock = vi.fn(async () => false);

vi.mock('~/core/supabase/server-component-client', () => ({
  default: getSupabaseServerComponentClient,
}));

vi.mock('~/lib/user/require-session', () => ({
  __esModule: true,
  default: requireSessionMock,
}));

vi.mock('~/lib/organizations/database/queries', () => ({
  getOrganizationsByUserId: getOrganizationsByUserIdMock,
}));

vi.mock('~/lib/server/queries', () => ({
  getUserDataById: getUserDataByIdMock,
}));

vi.mock('~/i18n/i18n.server', () => ({
  __esModule: true,
  default: initializeServerI18nMock,
}));

vi.mock('~/i18n/get-language-cookie', () => ({
  __esModule: true,
  default: getLanguageCookieMock,
}));

vi.mock('~/lib/server/loaders/utils/get-ui-state-cookies', () => ({
  __esModule: true,
  default: getUIStateCookiesMock,
}));

vi.mock('~/lib/server/cookies/organization.cookie', () => ({
  parseOrganizationIdCookie: parseOrganizationIdCookieMock,
  hasManualOrganizationSelectionCookie: hasManualOrganizationSelectionCookieMock,
}));

type QueryResult<T> = {
  data: T;
  error: { code: string } | null;
};

function createResolvedChain<T>(result: QueryResult<T>) {
  const chain: any = {};

  chain.eq = vi.fn(() => chain);
  chain.not = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.then = (
    resolve: (value: QueryResult<T>) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);

  return chain;
}

function createUpdateChain(
  result: QueryResult<null>,
  onEq: (column: string, value: unknown) => void,
){
  const chain: any = {};

  chain.eq = vi.fn((column: string, value: unknown) => {
    onEq(column, value);
    return chain;
  });
  chain.then = (
    resolve: (value: QueryResult<null>) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);

  return chain;
}

describe('autoLinkPendingViewerMemberships', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires a verified auth email before linking pending memberships', async () => {
    const { autoLinkPendingViewerMemberships } = await import(
      '~/lib/server/loaders/load-app-data'
    );

    await autoLinkPendingViewerMemberships({
      userId: 'user-1',
      userEmail: 'viewer@example.com',
      emailVerifiedAt: null,
    });

    expect(getSupabaseServerComponentClient).not.toHaveBeenCalled();
  });

  it('only links memberships tied to recipients with granted dashboard access', async () => {
    const updateFilters: Array<Array<[string, unknown]>> = [];
    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return {
            select: vi.fn(() =>
              createResolvedChain({
                data: [
                  { id: 11, organization_id: 1001 },
                  { id: 22, organization_id: 2002 },
                ],
                error: null,
              }),
            ),
            update: vi.fn(() => {
              const filters: Array<[string, unknown]> = [];
              updateFilters.push(filters);

              return createUpdateChain({ data: null, error: null }, (column, value) => {
                filters.push([column, value]);
              });
            }),
            delete: vi.fn(() => createResolvedChain({ data: null, error: null })),
          };
        }

        if (table === 'ultaura_notification_recipients') {
          return {
            select: vi.fn(() =>
              createResolvedChain({
                data: [{ account_id: 'account-1' }],
                error: null,
              }),
            ),
          };
        }

        if (table === 'ultaura_accounts') {
          return {
            select: vi.fn(() =>
              createResolvedChain({
                data: [{ id: 'account-1', organization_id: 1001 }],
                error: null,
              }),
            ),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    getSupabaseServerComponentClient.mockReturnValue(adminClient);

    const { autoLinkPendingViewerMemberships } = await import(
      '~/lib/server/loaders/load-app-data'
    );

    await autoLinkPendingViewerMemberships({
      userId: 'viewer-user-id',
      userEmail: 'viewer@example.com',
      emailVerifiedAt: '2026-03-01T00:00:00.000Z',
    });

    expect(updateFilters).toHaveLength(1);
    expect(updateFilters[0]).toContainEqual(['id', 11]);
    expect(updateFilters[0]).not.toContainEqual(['id', 22]);
  });
});

describe('loadAppDataForUser role-aware onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireSessionMock.mockResolvedValue({
      access_token: 'access-token',
      user: {
        id: 'user-1',
        email: 'viewer@example.com',
        phone: null,
        email_confirmed_at: '2026-03-01T00:00:00.000Z',
      },
    });
  });

  it('allows viewer users without onboarded records by auto-provisioning a minimal user row', async () => {
    getUserDataByIdMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'user-1',
        onboarded: false,
      });
    getOrganizationsByUserIdMock.mockResolvedValue({
      data: [
        {
          role: -1,
          organization: { id: 101, uuid: 'org-101', name: 'Viewer Org' },
        },
      ],
      error: null,
    });

    const insertMock = vi.fn(() => createResolvedChain({ data: null, error: null }));
    const selectMock = vi.fn(() =>
      createResolvedChain({
        data: [],
        error: null,
      }),
    );
    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return { select: selectMock };
        }
        if (table === 'users') {
          return { insert: insertMock };
        }
        if (table === 'ultaura_notification_recipients') {
          return { select: vi.fn(() => createResolvedChain({ data: [], error: null })) };
        }
        if (table === 'ultaura_accounts') {
          return { select: vi.fn(() => createResolvedChain({ data: [], error: null })) };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    const userClient = {
      from: vi.fn(() => ({ select: vi.fn(() => createResolvedChain({ data: [], error: null })) })),
    };

    getSupabaseServerComponentClient.mockImplementation((params?: { admin?: boolean }) =>
      params?.admin ? adminClient : userClient,
    );

    const { loadAppDataForUser } = await import('~/lib/server/loaders/load-app-data');
    const result = await loadAppDataForUser();

    expect(insertMock).toHaveBeenCalled();
    expect((result as { role?: number }).role).toBe(-1);
    expect((result as { user?: { onboarded?: boolean } }).user?.onboarded).toBe(false);
  });

  it('still redirects non-viewers without onboarding to onboarding', async () => {
    getUserDataByIdMock.mockResolvedValue({
      id: 'user-1',
      onboarded: false,
    });
    getOrganizationsByUserIdMock.mockResolvedValue({
      data: [
        {
          role: 0,
          organization: { id: 102, uuid: 'org-102', name: 'Member Org' },
        },
      ],
      error: null,
    });

    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return { select: vi.fn(() => createResolvedChain({ data: [], error: null })) };
        }
        if (table === 'ultaura_notification_recipients') {
          return { select: vi.fn(() => createResolvedChain({ data: [], error: null })) };
        }
        if (table === 'ultaura_accounts') {
          return { select: vi.fn(() => createResolvedChain({ data: [], error: null })) };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    const userClient = {
      from: vi.fn(() => ({ select: vi.fn(() => createResolvedChain({ data: [], error: null })) })),
    };
    getSupabaseServerComponentClient.mockImplementation((params?: { admin?: boolean }) =>
      params?.admin ? adminClient : userClient,
    );

    const { loadAppDataForUser } = await import('~/lib/server/loaders/load-app-data');
    await loadAppDataForUser();

    const { redirect } = await import('next/navigation');
    expect(redirect).toHaveBeenCalledWith('/onboarding');
  });

});
