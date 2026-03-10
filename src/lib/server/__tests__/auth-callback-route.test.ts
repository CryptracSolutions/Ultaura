import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const redirectMock = vi.fn((path: string) => path);
const exchangeCodeForSessionMock = vi.fn();
const resolveInviteMock = vi.fn();

function createMaybeSingleChain(data: unknown) {
  return {
    eq: vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({ data })),
      order: vi.fn(() => ({
        limit: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data })),
        })),
      })),
    })),
  };
}

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('~/core/supabase/route-handler-client', () => ({
  __esModule: true,
  default: vi.fn((params?: { admin?: boolean }) =>
    params?.admin
      ? {
          from: vi.fn((table: string) => {
            if (table === 'users') {
              return {
                select: vi.fn(() => createMaybeSingleChain({ display_name: null })),
                update: vi.fn(() => ({
                  eq: vi.fn(async () => ({ error: null })),
                })),
              };
            }

            if (table === 'ultaura_notification_recipients') {
              return {
                select: vi.fn(() =>
                  createMaybeSingleChain({ name: 'Viewer Name' }),
                ),
              };
            }

            throw new Error(`Unexpected table: ${table}`);
          }),
        }
      : {
          auth: {
            exchangeCodeForSession: exchangeCodeForSessionMock,
          },
        },
  ),
}));

vi.mock('~/lib/memberships/invite-resolution', () => ({
  resolveInvite: resolveInviteMock,
}));

describe('/auth/callback route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    exchangeCodeForSessionMock.mockResolvedValue({
      error: null,
      data: {
        user: {
          id: 'user-1',
          email: 'viewer@example.com',
        },
      },
    });
  });

  it('redirects wrong-account invite attempts to the invite page', async () => {
    resolveInviteMock.mockResolvedValue({
      status: 'wrong_account',
      destination: '/dashboard',
    });

    const mod = await import('~/app/auth/callback/route');
    const response = await mod.GET(
      new Request(
        'http://localhost:3000/auth/callback?code=auth-code&inviteCode=invite-123',
      ) as never,
    );

    expect(resolveInviteMock).toHaveBeenCalled();
    expect(response).toBe('/invite/invite-123');
  });

  it('redirects invite resolution failures to the recovery page', async () => {
    resolveInviteMock.mockResolvedValue({
      status: 'failed',
      destination: '/auth/invite-error',
    });

    const mod = await import('~/app/auth/callback/route');
    const response = await mod.GET(
      new Request(
        'http://localhost:3000/auth/callback?code=auth-code&inviteCode=invite-123',
      ) as never,
    );

    expect(response).toBe('/auth/invite-error');
  });

  it('redirects successful viewer invite callbacks to dashboard', async () => {
    resolveInviteMock.mockResolvedValue({
      status: 'accepted',
      role: -1,
      destination: '/dashboard',
    });

    const mod = await import('~/app/auth/callback/route');
    const response = await mod.GET(
      new Request(
        'http://localhost:3000/auth/callback?code=auth-code&inviteCode=invite-123',
      ) as never,
    );

    expect(response).toBe('/dashboard');
  });
});
