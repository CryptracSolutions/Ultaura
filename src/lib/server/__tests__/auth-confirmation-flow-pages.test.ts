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
  default: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
    },
  })),
}));

vi.mock('~/lib/server/queries', () => ({
  getUserDataById: getUserDataByIdMock,
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
