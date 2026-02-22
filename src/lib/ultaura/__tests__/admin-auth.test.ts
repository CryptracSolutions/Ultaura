import { afterEach, describe, expect, it, vi } from 'vitest';

import GlobalRole from '~/core/session/types/global-role';

type AuthClientOptions = {
  role?: string;
  getUserError?: { message: string } | null;
  aal?: 'aal1' | 'aal2';
  aalError?: { message: string } | null;
};

function createMockAuthClient(options: AuthClientOptions = {}) {
  const getUserMock = vi.fn().mockResolvedValue({
    data: {
      user: options.getUserError
        ? null
        : {
            id: 'user-1',
            app_metadata: {
              role: options.role,
            },
          },
    },
    error: options.getUserError ?? null,
  });

  const getAalMock = vi.fn().mockResolvedValue({
    data: options.aalError
      ? null
      : {
          currentLevel: options.aal ?? 'aal1',
          nextLevel: options.aal ?? 'aal1',
          currentAuthenticationMethods: [],
        },
    error: options.aalError ?? null,
  });

  const client = {
    auth: {
      getUser: getUserMock,
      mfa: {
        getAuthenticatorAssuranceLevel: getAalMock,
      },
    },
  };

  return {
    client: client as any,
    getUserMock,
    getAalMock,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('admin auth helpers', () => {
  it('isUserSuperAdmin returns true for super-admin with MFA AAL2', async () => {
    vi.doUnmock('~/app/admin/utils/is-user-super-admin');

    const { default: isUserSuperAdmin } = await import(
      '~/app/admin/utils/is-user-super-admin'
    );
    const { client } = createMockAuthClient({
      role: GlobalRole.SuperAdmin,
      aal: 'aal2',
    });

    await expect(
      isUserSuperAdmin({ client, enforceMfa: true }),
    ).resolves.toBe(true);
  });

  it('isUserSuperAdmin returns false for non-admin role', async () => {
    vi.doUnmock('~/app/admin/utils/is-user-super-admin');

    const { default: isUserSuperAdmin } = await import(
      '~/app/admin/utils/is-user-super-admin'
    );
    const { client } = createMockAuthClient({
      role: 'member',
      aal: 'aal2',
    });

    await expect(
      isUserSuperAdmin({ client, enforceMfa: true }),
    ).resolves.toBe(false);
  });

  it('isUserSuperAdmin returns false when getUser returns an error', async () => {
    vi.doUnmock('~/app/admin/utils/is-user-super-admin');

    const { default: isUserSuperAdmin } = await import(
      '~/app/admin/utils/is-user-super-admin'
    );
    const { client } = createMockAuthClient({
      getUserError: { message: 'auth failed' },
    });

    await expect(
      isUserSuperAdmin({ client, enforceMfa: true }),
    ).resolves.toBe(false);
  });

  it('isUserSuperAdmin returns false when MFA is required but not satisfied', async () => {
    vi.doUnmock('~/app/admin/utils/is-user-super-admin');

    const { default: isUserSuperAdmin } = await import(
      '~/app/admin/utils/is-user-super-admin'
    );
    const { client } = createMockAuthClient({
      role: GlobalRole.SuperAdmin,
      aal: 'aal1',
    });

    await expect(
      isUserSuperAdmin({ client, enforceMfa: true }),
    ).resolves.toBe(false);
  });

  it('isUserSuperAdmin returns true for super-admin without MFA when enforcement is off', async () => {
    vi.doUnmock('~/app/admin/utils/is-user-super-admin');

    const { default: isUserSuperAdmin } = await import(
      '~/app/admin/utils/is-user-super-admin'
    );
    const { client } = createMockAuthClient({
      role: GlobalRole.SuperAdmin,
      aal: 'aal1',
    });

    await expect(
      isUserSuperAdmin({ client, enforceMfa: false }),
    ).resolves.toBe(true);
  });

  it('isUserSuperAdminWithoutMfa checks role without calling MFA endpoint', async () => {
    vi.doUnmock('~/app/admin/utils/is-user-super-admin');

    const { isUserSuperAdminWithoutMfa } = await import(
      '~/app/admin/utils/is-user-super-admin'
    );
    const { client, getAalMock } = createMockAuthClient({
      role: GlobalRole.SuperAdmin,
      aal: 'aal1',
    });

    await expect(isUserSuperAdminWithoutMfa(client)).resolves.toBe(true);
    expect(getAalMock).not.toHaveBeenCalled();
  });

  it('isUserSuperAdminWithoutMfa returns false for non-admin role', async () => {
    vi.doUnmock('~/app/admin/utils/is-user-super-admin');

    const { isUserSuperAdminWithoutMfa } = await import(
      '~/app/admin/utils/is-user-super-admin'
    );
    const { client, getAalMock } = createMockAuthClient({
      role: 'member',
      aal: 'aal2',
    });

    await expect(isUserSuperAdminWithoutMfa(client)).resolves.toBe(false);
    expect(getAalMock).not.toHaveBeenCalled();
  });
});

describe('withAdminSession', () => {
  it('passes action client into isUserSuperAdmin and runs the wrapped action', async () => {
    const actionClient = { kind: 'action-client' };
    const notFoundMock = vi.fn(() => {
      throw new Error('not-found');
    });
    const getSupabaseServerActionClientMock = vi
      .fn()
      .mockReturnValue(actionClient);
    const isUserSuperAdminMock = vi.fn().mockResolvedValue(true);

    vi.doMock('next/navigation', () => ({
      notFound: notFoundMock,
    }));
    vi.doMock('~/core/supabase/action-client', () => ({
      default: getSupabaseServerActionClientMock,
    }));
    vi.doMock('~/lib/user/require-session', () => ({
      default: vi.fn(),
    }));
    vi.doMock('~/app/admin/utils/is-user-super-admin', () => ({
      __esModule: true,
      default: isUserSuperAdminMock,
    }));

    const { withAdminSession } = await import('~/core/generic/actions-utils');
    const action = withAdminSession(async (value: number) => value + 1);

    await expect(action(2)).resolves.toBe(3);
    expect(getSupabaseServerActionClientMock).toHaveBeenCalledTimes(1);
    expect(isUserSuperAdminMock).toHaveBeenCalledWith({ client: actionClient });
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('calls notFound when admin check fails (non-admin path)', async () => {
    const notFoundError = new Error('NEXT_NOT_FOUND');
    const notFoundMock = vi.fn(() => {
      throw notFoundError;
    });
    const getSupabaseServerActionClientMock = vi
      .fn()
      .mockReturnValue({ kind: 'action-client' });
    const isUserSuperAdminMock = vi.fn().mockResolvedValue(false);

    vi.doMock('next/navigation', () => ({
      notFound: notFoundMock,
    }));
    vi.doMock('~/core/supabase/action-client', () => ({
      default: getSupabaseServerActionClientMock,
    }));
    vi.doMock('~/lib/user/require-session', () => ({
      default: vi.fn(),
    }));
    vi.doMock('~/app/admin/utils/is-user-super-admin', () => ({
      __esModule: true,
      default: isUserSuperAdminMock,
    }));

    const { withAdminSession } = await import('~/core/generic/actions-utils');
    const action = withAdminSession(async () => 'ok');

    await expect(action()).rejects.toBe(notFoundError);
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('calls notFound when admin check fails (MFA-fail path)', async () => {
    const notFoundError = new Error('NEXT_NOT_FOUND');
    const notFoundMock = vi.fn(() => {
      throw notFoundError;
    });
    const getSupabaseServerActionClientMock = vi
      .fn()
      .mockReturnValue({ kind: 'action-client' });
    const isUserSuperAdminMock = vi.fn().mockResolvedValue(false);

    vi.doMock('next/navigation', () => ({
      notFound: notFoundMock,
    }));
    vi.doMock('~/core/supabase/action-client', () => ({
      default: getSupabaseServerActionClientMock,
    }));
    vi.doMock('~/lib/user/require-session', () => ({
      default: vi.fn(),
    }));
    vi.doMock('~/app/admin/utils/is-user-super-admin', () => ({
      __esModule: true,
      default: isUserSuperAdminMock,
    }));

    const { withAdminSession } = await import('~/core/generic/actions-utils');
    const action = withAdminSession(async () => 'ok');

    await expect(action()).rejects.toBe(notFoundError);
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});

describe('AdminGuard', () => {
  it('returns the wrapped page element when user is admin', async () => {
    const notFoundMock = vi.fn(() => {
      throw new Error('not-found');
    });
    const isUserSuperAdminMock = vi.fn().mockResolvedValue(true);

    vi.doMock('next/navigation', () => ({
      notFound: notFoundMock,
    }));
    vi.doMock('~/app/admin/utils/is-user-super-admin', () => ({
      __esModule: true,
      default: isUserSuperAdminMock,
    }));
    vi.stubGlobal('React', await import('react'));

    const { default: AdminGuard } = await import(
      '~/app/admin/components/AdminGuard'
    );

    function TestPage(props: { value: string }) {
      return `page:${props.value}`;
    }

    const GuardedPage = AdminGuard(TestPage);
    const result = await GuardedPage({ value: 'abc' });

    expect(isUserSuperAdminMock).toHaveBeenCalledWith();
    expect(notFoundMock).not.toHaveBeenCalled();
    expect((result as any).type).toBe(TestPage);
    expect((result as any).props).toMatchObject({ value: 'abc' });
  });

  it('calls notFound when user is not admin (non-admin path)', async () => {
    const notFoundError = new Error('NEXT_NOT_FOUND');
    const notFoundMock = vi.fn(() => {
      throw notFoundError;
    });
    const isUserSuperAdminMock = vi.fn().mockResolvedValue(false);

    vi.doMock('next/navigation', () => ({
      notFound: notFoundMock,
    }));
    vi.doMock('~/app/admin/utils/is-user-super-admin', () => ({
      __esModule: true,
      default: isUserSuperAdminMock,
    }));
    vi.stubGlobal('React', await import('react'));

    const { default: AdminGuard } = await import(
      '~/app/admin/components/AdminGuard'
    );

    const GuardedPage = AdminGuard(() => null);

    await expect(GuardedPage({})).rejects.toBe(notFoundError);
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('calls notFound when user is not admin (MFA-fail path)', async () => {
    const notFoundError = new Error('NEXT_NOT_FOUND');
    const notFoundMock = vi.fn(() => {
      throw notFoundError;
    });
    const isUserSuperAdminMock = vi.fn().mockResolvedValue(false);

    vi.doMock('next/navigation', () => ({
      notFound: notFoundMock,
    }));
    vi.doMock('~/app/admin/utils/is-user-super-admin', () => ({
      __esModule: true,
      default: isUserSuperAdminMock,
    }));
    vi.stubGlobal('React', await import('react'));

    const { default: AdminGuard } = await import(
      '~/app/admin/components/AdminGuard'
    );

    const GuardedPage = AdminGuard(() => null);

    await expect(GuardedPage({})).rejects.toBe(notFoundError);
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});

describe('isUltauraAdmin', () => {
  it('uses the server action client when calling isUserSuperAdmin', async () => {
    const actionClient = { kind: 'action-client' };
    const getSupabaseServerActionClientMock = vi
      .fn()
      .mockReturnValue(actionClient);
    const isUserSuperAdminMock = vi.fn().mockResolvedValue(true);
    const requireSessionMock = vi.fn();

    vi.doMock('~/core/supabase/action-client', () => ({
      default: getSupabaseServerActionClientMock,
    }));
    vi.doMock('~/app/admin/utils/is-user-super-admin', () => ({
      __esModule: true,
      default: isUserSuperAdminMock,
    }));
    vi.doMock('~/lib/user/require-session', () => ({
      default: requireSessionMock,
    }));
    vi.doMock('~/core/logger', () => ({
      default: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      })),
    }));
    vi.doMock('~/lib/ultaura/bytea', () => ({
      decodeBytea: vi.fn(),
    }));
    vi.doMock('~/lib/ultaura/debug-log-decrypt', () => ({
      decryptDebugPayload: vi.fn(),
    }));
    vi.doMock('~/lib/ultaura/admin/audit-log', () => ({
      writeAdminAuditLog: vi.fn(),
    }));

    const { isUltauraAdmin } = await import('~/lib/ultaura/admin-actions');

    await expect(isUltauraAdmin()).resolves.toBe(true);
    expect(getSupabaseServerActionClientMock).toHaveBeenCalledTimes(1);
    expect(getSupabaseServerActionClientMock).toHaveBeenCalledWith();
    expect(isUserSuperAdminMock).toHaveBeenCalledWith({ client: actionClient });
    expect(requireSessionMock).not.toHaveBeenCalled();
  });

  it('returns false for non-admin users while using the server action client', async () => {
    const actionClient = { kind: 'action-client' };
    const getSupabaseServerActionClientMock = vi
      .fn()
      .mockReturnValue(actionClient);
    const isUserSuperAdminMock = vi.fn().mockResolvedValue(false);
    const requireSessionMock = vi.fn();

    vi.doMock('~/core/supabase/action-client', () => ({
      default: getSupabaseServerActionClientMock,
    }));
    vi.doMock('~/app/admin/utils/is-user-super-admin', () => ({
      __esModule: true,
      default: isUserSuperAdminMock,
    }));
    vi.doMock('~/lib/user/require-session', () => ({
      default: requireSessionMock,
    }));
    vi.doMock('~/core/logger', () => ({
      default: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      })),
    }));
    vi.doMock('~/lib/ultaura/bytea', () => ({
      decodeBytea: vi.fn(),
    }));
    vi.doMock('~/lib/ultaura/debug-log-decrypt', () => ({
      decryptDebugPayload: vi.fn(),
    }));
    vi.doMock('~/lib/ultaura/admin/audit-log', () => ({
      writeAdminAuditLog: vi.fn(),
    }));

    const { isUltauraAdmin } = await import('~/lib/ultaura/admin-actions');

    await expect(isUltauraAdmin()).resolves.toBe(false);
    expect(getSupabaseServerActionClientMock).toHaveBeenCalledTimes(1);
    expect(getSupabaseServerActionClientMock).toHaveBeenCalledWith();
    expect(isUserSuperAdminMock).toHaveBeenCalledWith({ client: actionClient });
    expect(requireSessionMock).not.toHaveBeenCalled();
  });

  it('returns false when a super-admin fails MFA while using the server action client', async () => {
    const actionClient = { kind: 'action-client' };
    const getSupabaseServerActionClientMock = vi
      .fn()
      .mockReturnValue(actionClient);
    const isUserSuperAdminMock = vi.fn().mockResolvedValue(false);
    const requireSessionMock = vi.fn();

    vi.doMock('~/core/supabase/action-client', () => ({
      default: getSupabaseServerActionClientMock,
    }));
    vi.doMock('~/app/admin/utils/is-user-super-admin', () => ({
      __esModule: true,
      default: isUserSuperAdminMock,
    }));
    vi.doMock('~/lib/user/require-session', () => ({
      default: requireSessionMock,
    }));
    vi.doMock('~/core/logger', () => ({
      default: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      })),
    }));
    vi.doMock('~/lib/ultaura/bytea', () => ({
      decodeBytea: vi.fn(),
    }));
    vi.doMock('~/lib/ultaura/debug-log-decrypt', () => ({
      decryptDebugPayload: vi.fn(),
    }));
    vi.doMock('~/lib/ultaura/admin/audit-log', () => ({
      writeAdminAuditLog: vi.fn(),
    }));

    const { isUltauraAdmin } = await import('~/lib/ultaura/admin-actions');

    await expect(isUltauraAdmin()).resolves.toBe(false);
    expect(getSupabaseServerActionClientMock).toHaveBeenCalledTimes(1);
    expect(getSupabaseServerActionClientMock).toHaveBeenCalledWith();
    expect(isUserSuperAdminMock).toHaveBeenCalledWith({ client: actionClient });
    expect(requireSessionMock).not.toHaveBeenCalled();
  });
});
