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
const resolveInviteMock = vi.fn();
const loggerMock = {
  info: vi.fn(),
  error: vi.fn(),
};
const getUserMock = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('~/configuration', () => ({
  __esModule: true,
  default: {
    auth: {
      requireEmailConfirmation: true,
    },
  },
}));

vi.mock('~/core/logger', () => ({
  __esModule: true,
  default: () => loggerMock,
}));

vi.mock('~/core/supabase/action-client', () => ({
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

vi.mock('~/lib/memberships/invite-resolution', () => ({
  resolveInvite: resolveInviteMock,
}));

describe('acceptInviteAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps explicit signup userId flows behind email confirmation even with same-user session', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'new-user-id',
          email: 'invitee@example.com',
        },
      },
    });

    resolveInviteMock.mockResolvedValue({
      status: 'accepted',
      destination: '/dashboard',
      membershipId: 77,
      organizationId: 101,
      needsOnboarding: false,
    });

    const { acceptInviteAction } = await import('~/lib/memberships/actions');

    const result = await acceptInviteAction({
      code: 'invite-code',
      userId: 'new-user-id',
    });

    expect(resolveInviteMock).toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        needsEmailVerification: true,
        destination: '/dashboard',
      }),
    );
  });
});
