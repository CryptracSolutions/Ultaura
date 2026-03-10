import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return { ...actual, cache: (fn: (...args: unknown[]) => unknown) => fn };
});

const redirectMock = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});

const getMembershipByInviteCodeMock = vi.fn();
const getUserMock = vi.fn();
const resolveInviteMock = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('~/i18n/with-i18n', () => ({
  withI18n: (Component: unknown) => Component,
}));

vi.mock('~/lib/memberships/queries', () => ({
  getMembershipByInviteCode: getMembershipByInviteCodeMock,
}));

vi.mock('~/lib/memberships/invite-resolution', () => ({
  resolveInvite: resolveInviteMock,
}));

vi.mock('~/core/supabase/server-component-client', () => ({
  __esModule: true,
  default: vi.fn((params?: { admin?: boolean }) => {
    if (params?.admin) {
      return { admin: true };
    }

    return {
      auth: {
        getUser: getUserMock,
      },
    };
  }),
}));

describe('/invite/[code] page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getMembershipByInviteCodeMock.mockResolvedValue({
      data: {
        id: 1,
        code: 'code-1',
        invitedEmail: 'viewer@example.com',
        organization: {
          id: 100,
          name: 'Org 100',
        },
      },
      error: null,
    });
    resolveInviteMock.mockResolvedValue({
      status: 'accepted',
      destination: '/dashboard',
    });
  });

  it('redirects signed-out users with valid invites to invite-aware sign-up', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: null,
      },
    });

    const mod = await import('~/app/invite/[code]/page');

    await expect(
      mod.default({ params: { code: 'abc123' } } as never),
    ).rejects.toThrow('REDIRECT:/auth/sign-up?inviteCode=abc123');
    expect(resolveInviteMock).not.toHaveBeenCalled();
  });

  it('auto-accepts and redirects when signed-in user email matches invited email', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'viewer@example.com',
        },
      },
    });

    const mod = await import('~/app/invite/[code]/page');

    await expect(
      mod.default({ params: { code: 'abc123' } } as never),
    ).rejects.toThrow('REDIRECT:/dashboard');
    expect(resolveInviteMock).toHaveBeenCalled();
  });

  it('redirects missing/consumed invites to sign-in when signed out', async () => {
    getMembershipByInviteCodeMock.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116' },
    });
    getUserMock.mockResolvedValue({
      data: {
        user: null,
      },
    });

    const mod = await import('~/app/invite/[code]/page');

    await expect(
      mod.default({ params: { code: 'missing' } } as never),
    ).rejects.toThrow('REDIRECT:/auth/sign-in');
    expect(resolveInviteMock).not.toHaveBeenCalled();
  });

  it('redirects missing/consumed invites to dashboard when signed in', async () => {
    getMembershipByInviteCodeMock.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116' },
    });
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'viewer@example.com',
        },
      },
    });

    const mod = await import('~/app/invite/[code]/page');

    await expect(
      mod.default({ params: { code: 'missing' } } as never),
    ).rejects.toThrow('REDIRECT:/dashboard');
    expect(resolveInviteMock).not.toHaveBeenCalled();
  });
});
