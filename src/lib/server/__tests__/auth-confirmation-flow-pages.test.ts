import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

globalThis.React = React;

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    cache: (fn: (...args: unknown[]) => unknown) => fn,
  };
});

vi.mock('server-only', () => ({}));

const redirectMock = vi.fn();
const getUserMock = vi.fn();
const getUserDataByIdMock = vi.fn();
const getOrganizationsByUserIdMock = vi.fn();
const autoLinkPendingViewerMembershipsMock = vi.fn(async () => undefined);
const getPendingInviteMembershipForResolutionMock = vi.fn();
const resolveInviteMock = vi.fn();
const initializeServerI18nMock = vi.fn(async () => ({ language: 'en' }));
const verifyRequiresMfaMock = vi.fn(async () => false);
const getLanguageCookieMock = vi.fn(() => 'en');
const USER_ID = 'user-1';
const USER_EMAIL = 'caregiver@example.com';
const CONFIRMED_AT = '2026-03-09T12:00:00.000Z';

function createAuthUser(emailConfirmedAt: string | null) {
  return {
    id: USER_ID,
    email: USER_EMAIL,
    email_confirmed_at: emailConfirmedAt,
  };
}

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('~/i18n/with-i18n', () => ({
  withI18n: (Component: unknown) => Component,
}));

vi.mock('~/core/supabase/server-component-client', () => ({
  __esModule: true,
  default: vi.fn((params?: { admin?: boolean }) =>
    params?.admin
      ? {}
      : {
          auth: {
            getUser: getUserMock,
          },
        },
  ),
}));

vi.mock('~/lib/server/queries', () => ({
  getUserDataById: getUserDataByIdMock,
}));

vi.mock('~/lib/memberships/queries', () => ({
  getPendingInviteMembershipForResolution:
    getPendingInviteMembershipForResolutionMock,
}));

vi.mock('~/lib/memberships/invite-resolution', async () => {
  const actual =
    await vi.importActual<typeof import('~/lib/memberships/invite-resolution')>(
      '~/lib/memberships/invite-resolution',
    );

  return {
    ...actual,
    resolveInvite: resolveInviteMock,
  };
});

vi.mock('~/lib/organizations/database/queries', () => ({
  getOrganizationsByUserId: getOrganizationsByUserIdMock,
}));

vi.mock('~/lib/server/loaders/load-app-data', () => ({
  autoLinkPendingViewerMemberships: autoLinkPendingViewerMembershipsMock,
}));

vi.mock('~/i18n/i18n.server', () => ({
  __esModule: true,
  default: initializeServerI18nMock,
}));

vi.mock('~/core/session/utils/check-requires-mfa', () => ({
  __esModule: true,
  default: verifyRequiresMfaMock,
}));

vi.mock('~/i18n/get-language-cookie', () => ({
  __esModule: true,
  default: getLanguageCookieMock,
}));

describe('auth confirmation pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    getOrganizationsByUserIdMock.mockResolvedValue({
      data: [],
      error: null,
    });
    getPendingInviteMembershipForResolutionMock.mockResolvedValue({
      data: {
        role: -1,
      },
      error: null,
    });
    resolveInviteMock.mockResolvedValue({
      status: 'ready',
      destination: '/dashboard',
      needsOnboarding: false,
    });
  });

  describe('/auth/confirmed', () => {
    it('allows confirmed users through the interstitial', async () => {
      getUserMock.mockResolvedValue({
        data: {
          user: createAuthUser(CONFIRMED_AT),
        },
      });

      const mod = await import('~/app/auth/confirmed/page');
      const result = await mod.default({
        searchParams: { next: '/onboarding' },
      } as never);

      expect(redirectMock).not.toHaveBeenCalled();
      expect((result as { props?: { next?: string } }).props?.next).toBe(
        '/onboarding',
      );
      expect((result as { props?: { autoRedirect?: boolean } }).props?.autoRedirect).toBe(
        true,
      );
    });

    it('sanitizes unsafe next values to /onboarding', async () => {
      getUserMock.mockResolvedValue({
        data: {
          user: createAuthUser(CONFIRMED_AT),
        },
      });

      const mod = await import('~/app/auth/confirmed/page');
      const result = await mod.default({
        searchParams: { next: '//evil.com' },
      } as never);

      expect(redirectMock).not.toHaveBeenCalled();
      expect((result as { props?: { next?: string } }).props?.next).toBe(
        '/onboarding',
      );
    });

    it('redirects unconfirmed users to sign-up', async () => {
      getUserMock.mockResolvedValue({
        data: {
          user: createAuthUser(null),
        },
      });

      const mod = await import('~/app/auth/confirmed/page');
      await mod.default({ searchParams: { next: '/onboarding' } } as never);

      expect(redirectMock).toHaveBeenCalledWith('/auth/sign-up');
    });

    it('redirects missing-session users to sign-up', async () => {
      getUserMock.mockResolvedValue({
        data: {
          user: null,
        },
      });

      const mod = await import('~/app/auth/confirmed/page');
      await mod.default({ searchParams: { next: '/onboarding' } } as never);

      expect(redirectMock).toHaveBeenCalledWith('/auth/sign-up');
    });

    it('shows the waiting state for pending confirmations before email is verified', async () => {
      getUserMock.mockResolvedValue({
        data: {
          user: createAuthUser(null),
        },
      });

      const mod = await import('~/app/auth/confirmed/page');
      const result = await mod.default({
        searchParams: {
          pending: '1',
          email: 'invitee@example.com',
          inviteCode: 'invite-123',
          next: '/onboarding',
        },
      } as never);

      expect(redirectMock).not.toHaveBeenCalled();
      expect((result as { props?: { email?: string } }).props?.email).toBe(
        'invitee@example.com',
      );
    });

    it('keeps pending confirmations on the waiting flow even after email is verified', async () => {
      getUserMock.mockResolvedValue({
        data: {
          user: createAuthUser(CONFIRMED_AT),
        },
      });

      const mod = await import('~/app/auth/confirmed/page');
      const result = await mod.default({
        searchParams: {
          pending: '1',
          email: 'invitee@example.com',
          inviteCode: 'invite-123',
          next: '/onboarding',
        },
      } as never);

      expect(redirectMock).not.toHaveBeenCalled();
      expect((result as { props?: { email?: string } }).props?.email).toBe(
        'invitee@example.com',
      );
    });

    it('keeps auto-redirect enabled for invite confirmations', async () => {
      getUserMock.mockResolvedValue({
        data: {
          user: createAuthUser(CONFIRMED_AT),
        },
      });

      const mod = await import('~/app/auth/confirmed/page');
      const result = await mod.default({
        searchParams: { inviteCode: 'invite-123', next: '/onboarding' },
      } as never);

      expect(redirectMock).not.toHaveBeenCalled();
      expect((result as { props?: { next?: string } }).props?.next).toBe(
        '/dashboard',
      );
      expect((result as { props?: { autoRedirect?: boolean } }).props?.autoRedirect).toBe(
        true,
      );
    });
  });

  describe('/auth/sign-up', () => {
    it('redirects confirmed users without onboarding to /onboarding', async () => {
      getUserMock.mockResolvedValue({
        data: {
          user: createAuthUser(CONFIRMED_AT),
        },
      });
      getUserDataByIdMock.mockResolvedValue({
        id: USER_ID,
        onboarded: false,
      });

      const mod = await import('~/app/auth/sign-up/page');
      await mod.default({ searchParams: {} } as never);

      expect(redirectMock).toHaveBeenCalledWith('/onboarding');
    });

    it('redirects confirmed onboarded users to /dashboard', async () => {
      getUserMock.mockResolvedValue({
        data: {
          user: createAuthUser(CONFIRMED_AT),
        },
      });
      getUserDataByIdMock.mockResolvedValue({
        id: USER_ID,
        onboarded: true,
      });

      const mod = await import('~/app/auth/sign-up/page');
      await mod.default({ searchParams: {} } as never);

      expect(redirectMock).toHaveBeenCalledWith('/dashboard');
    });

    it('does not redirect unconfirmed users away from sign-up', async () => {
      getUserMock.mockResolvedValue({
        data: {
          user: createAuthUser(null),
        },
      });

      const mod = await import('~/app/auth/sign-up/page');
      await mod.default({ searchParams: {} } as never);

      expect(redirectMock).not.toHaveBeenCalledWith('/onboarding');
      expect(redirectMock).not.toHaveBeenCalledWith('/dashboard');
      expect(redirectMock).not.toHaveBeenCalledWith('/auth/verify');
    });

    it('redirects signed-in invite users to the invite route', async () => {
      getUserMock.mockResolvedValue({
        data: {
          user: createAuthUser(CONFIRMED_AT),
        },
      });

      const mod = await import('~/app/auth/sign-up/page');
      await mod.default({
        searchParams: { inviteCode: 'invite-123' },
      } as never);

      expect(redirectMock).toHaveBeenCalledWith('/invite/invite-123');
    });

    it('keeps invite sign-up users on the page when email confirmation is pending', async () => {
      getUserMock.mockResolvedValue({
        data: {
          user: createAuthUser(CONFIRMED_AT),
        },
      });

      const mod = await import('~/app/auth/sign-up/page');
      await mod.default({
        searchParams: {
          inviteCode: 'invite-123',
          emailConfirmation: 'pending',
          next: '/onboarding',
        },
      } as never);

      expect(redirectMock).not.toHaveBeenCalledWith('/invite/invite-123');
      expect(redirectMock).not.toHaveBeenCalledWith('/onboarding');
    });

    it('still enforces MFA before redirecting signed-in invite users', async () => {
      getUserMock.mockResolvedValue({
        data: {
          user: createAuthUser(CONFIRMED_AT),
        },
      });
      verifyRequiresMfaMock.mockResolvedValue(true);

      const mod = await import('~/app/auth/sign-up/page');
      await mod.default({
        searchParams: { inviteCode: 'invite-123' },
      } as never);

      expect(redirectMock).toHaveBeenCalledWith('/auth/verify');
    });

    it('redirects invalid invite codes to sign-in', async () => {
      getUserMock.mockResolvedValue({
        data: {
          user: null,
        },
      });
      getPendingInviteMembershipForResolutionMock.mockResolvedValue({
        data: null,
        error: null,
      });

      const mod = await import('~/app/auth/sign-up/page');
      await mod.default({
        searchParams: { inviteCode: 'missing-code' },
      } as never);

      expect(redirectMock).toHaveBeenCalledWith('/auth/sign-in');
    });

    it('redirects consumed invite codes to sign-in', async () => {
      getUserMock.mockResolvedValue({
        data: {
          user: null,
        },
      });
      getPendingInviteMembershipForResolutionMock.mockResolvedValue({
        data: null,
        error: null,
      });

      const mod = await import('~/app/auth/sign-up/page');
      await mod.default({
        searchParams: { inviteCode: 'consumed-code' },
      } as never);

      expect(redirectMock).toHaveBeenCalledWith('/auth/sign-in');
    });
  });

  describe('/auth/sign-in', () => {
    it('redirects confirmed users without onboarding to /onboarding', async () => {
      getUserMock.mockResolvedValue({
        data: {
          user: createAuthUser(CONFIRMED_AT),
        },
      });
      getUserDataByIdMock.mockResolvedValue({
        id: USER_ID,
        onboarded: false,
      });

      const mod = await import('~/app/auth/sign-in/page');
      await mod.default({} as never);

      expect(redirectMock).toHaveBeenCalledWith('/onboarding');
    });

    it('redirects confirmed onboarded users to /dashboard', async () => {
      getUserMock.mockResolvedValue({
        data: {
          user: createAuthUser(CONFIRMED_AT),
        },
      });
      getUserDataByIdMock.mockResolvedValue({
        id: USER_ID,
        onboarded: true,
      });

      const mod = await import('~/app/auth/sign-in/page');
      await mod.default({} as never);

      expect(redirectMock).toHaveBeenCalledWith('/dashboard');
    });
  });
});
