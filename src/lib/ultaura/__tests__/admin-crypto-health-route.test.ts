import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getSupabaseRouteHandlerClientMock,
  getUserMock,
  isUserSuperAdminMock,
  loggerErrorMock,
  loggerWarnMock,
  loggerInfoMock,
  loggerDebugMock,
} = vi.hoisted(() => ({
  getSupabaseRouteHandlerClientMock: vi.fn(),
  getUserMock: vi.fn(),
  isUserSuperAdminMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  loggerWarnMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  loggerDebugMock: vi.fn(),
}));

vi.mock('~/core/supabase/route-handler-client', () => ({
  default: getSupabaseRouteHandlerClientMock,
}));

vi.mock('~/app/admin/utils/is-user-super-admin', () => ({
  __esModule: true,
  default: isUserSuperAdminMock,
}));

vi.mock('~/core/logger', () => ({
  default: vi.fn(() => ({
    error: loggerErrorMock,
    warn: loggerWarnMock,
    info: loggerInfoMock,
    debug: loggerDebugMock,
  })),
}));

import { GET } from '~/app/api/admin/crypto-health/route';

const ORIGINAL_ENV = { ...process.env };

let routeClient: { auth: { getUser: typeof getUserMock } };

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }

  Object.assign(process.env, ORIGINAL_ENV);
}

function createRequest() {
  return new NextRequest('https://example.com/api/admin/crypto-health', {
    method: 'GET',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  resetEnv();

  routeClient = {
    auth: {
      getUser: getUserMock,
    },
  };

  getSupabaseRouteHandlerClientMock.mockReturnValue(routeClient);

  getUserMock.mockResolvedValue({
    data: {
      user: {
        id: 'admin-user',
        app_metadata: { role: 'super-admin' },
      },
    },
    error: null,
  });

  isUserSuperAdminMock.mockResolvedValue(true);
  process.env.ULTAURA_INTERNAL_API_SECRET = 'admin-proxy-secret';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('admin crypto-health route', () => {
  it('returns 401 when no authenticated user is present', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(isUserSuperAdminMock).not.toHaveBeenCalled();
  });

  it('returns 403 for authenticated non-admin users', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          app_metadata: { role: 'member' },
        },
      },
      error: null,
    });
    isUserSuperAdminMock.mockResolvedValue(false);

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'Forbidden' });
    expect(isUserSuperAdminMock).toHaveBeenCalledWith({ client: routeClient });
  });

  it('returns 403 when MFA policy blocks an authenticated super-admin', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          app_metadata: { role: 'super-admin' },
        },
      },
      error: null,
    });
    isUserSuperAdminMock.mockResolvedValue(false);

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'Forbidden' });
    expect(isUserSuperAdminMock).toHaveBeenCalledWith({ client: routeClient });
  });

  it('returns 500 when the internal crypto-health secret is missing', async () => {
    delete process.env.ULTAURA_INTERNAL_API_SECRET;
    delete process.env.ULTAURA_API_SECRET;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual(
      expect.objectContaining({
        ok: false,
        code: 'SERVER_MISCONFIG',
        message: 'Internal API secret is not configured.',
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('proxies a successful internal crypto-health response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, status: 'healthy' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toEqual({ ok: true, status: 'healthy' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/api/internal/crypto-health',
      {
        method: 'GET',
        headers: {
          'x-webhook-secret': 'admin-proxy-secret',
        },
        cache: 'no-store',
      },
    );
  });

  it('falls back to ULTAURA_API_SECRET when ULTAURA_INTERNAL_API_SECRET is unset', async () => {
    delete process.env.ULTAURA_INTERNAL_API_SECRET;
    process.env.ULTAURA_API_SECRET = 'fallback-admin-proxy-secret';

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, status: 'healthy' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, status: 'healthy' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/api/internal/crypto-health',
      {
        method: 'GET',
        headers: {
          'x-webhook-secret': 'fallback-admin-proxy-secret',
        },
        cache: 'no-store',
      },
    );
  });

  it('returns 500 when the proxy fetch throws', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual(
      expect.objectContaining({
        ok: false,
        code: 'PROXY_REQUEST_FAILED',
        message: 'Failed to query internal crypto health endpoint.',
      }),
    );
    expect(loggerErrorMock).toHaveBeenCalled();
  });
});
