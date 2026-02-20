import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  fromMock,
  eqMock,
  maybeSingleMock,
  orderMock,
  limitMock,
  loggerErrorMock,
  loggerWarnMock,
  loggerInfoMock,
  loggerDebugMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  eqMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  orderMock: vi.fn(),
  limitMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  loggerWarnMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  loggerDebugMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('~/core/logger', () => ({
  default: vi.fn(() => ({
    error: loggerErrorMock,
    warn: loggerWarnMock,
    info: loggerInfoMock,
    debug: loggerDebugMock,
  })),
}));

vi.mock('~/core/supabase/route-handler-client', () => ({
  default: vi.fn(() => ({
    from: fromMock,
  })),
}));

import { GET } from '~/app/api/internal/crypto-health/route';

const ORIGINAL_ENV = { ...process.env };
const TEST_ACCOUNT_ID = 'bbbbbbbb-0000-4000-a000-000000000001';

function resetEnv(): void {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

function createRequest(secret?: string) {
  return new NextRequest('http://localhost/api/internal/crypto-health', {
    method: 'GET',
    headers: secret ? { 'x-webhook-secret': secret } : undefined,
  });
}

function wrapWithKey(kekHex: string, dek = crypto.randomBytes(32)): {
  wrapped: Buffer;
  iv: Buffer;
  tag: Buffer;
} {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(kekHex, 'hex'), iv, {
    authTagLength: 16,
  });
  const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();

  return { wrapped, iv, tag };
}

describe('crypto-health route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetEnv();

    process.env.ULTAURA_INTERNAL_API_SECRET = 'test-internal-secret';
    process.env.ULTAURA_ENCRYPTION_KEY = 'a'.repeat(64);
    delete process.env.ULTAURA_ENCRYPTION_KEY_PREVIOUS;

    maybeSingleMock.mockReset();
    limitMock.mockReset();

    eqMock.mockReturnValue({
      maybeSingle: maybeSingleMock,
    });
    orderMock.mockReturnValue({
      limit: limitMock,
    });
    fromMock.mockReturnValue({
      select: vi.fn(() => ({
        eq: eqMock,
        order: orderMock,
      })),
    });
  });

  it('returns 401 for invalid secret', async () => {
    const response = await GET(createRequest('wrong-secret'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 500 when internal secret is not configured', async () => {
    delete process.env.ULTAURA_INTERNAL_API_SECRET;
    delete process.env.ULTAURA_API_SECRET;

    const response = await GET(createRequest('any-secret'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Server misconfigured');
  });

  it('accepts ULTAURA_API_SECRET fallback when internal secret is unset', async () => {
    delete process.env.ULTAURA_INTERNAL_API_SECRET;
    process.env.ULTAURA_API_SECRET = 'fallback-secret';
    delete process.env.ULTAURA_CRYPTO_HEALTH_ACCOUNT_ID;
    limitMock.mockResolvedValue({
      data: [],
      error: null,
    });

    const response = await GET(createRequest('fallback-secret'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'skipped',
      })
    );
  });

  it('returns 200 for successful decrypt validation with configured account', async () => {
    process.env.ULTAURA_CRYPTO_HEALTH_ACCOUNT_ID = TEST_ACCOUNT_ID;
    const encrypted = wrapWithKey(process.env.ULTAURA_ENCRYPTION_KEY as string);
    maybeSingleMock.mockResolvedValue({
      data: {
        account_id: TEST_ACCOUNT_ID,
        dek_wrapped: encrypted.wrapped,
        dek_wrap_iv: encrypted.iv,
        dek_wrap_tag: encrypted.tag,
        created_at: new Date().toISOString(),
      },
      error: null,
    });

    const response = await GET(createRequest('test-internal-secret'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        ok: true,
        accountId: TEST_ACCOUNT_ID,
      })
    );
  });

  it('returns 503 when decrypt authentication fails', async () => {
    process.env.ULTAURA_CRYPTO_HEALTH_ACCOUNT_ID = TEST_ACCOUNT_ID;
    const encrypted = wrapWithKey('f'.repeat(64));
    maybeSingleMock.mockResolvedValue({
      data: {
        account_id: TEST_ACCOUNT_ID,
        dek_wrapped: encrypted.wrapped,
        dek_wrap_iv: encrypted.iv,
        dek_wrap_tag: encrypted.tag,
        created_at: new Date().toISOString(),
      },
      error: null,
    });

    const response = await GET(createRequest('test-internal-secret'));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual(
      expect.objectContaining({
        ok: false,
        code: 'DEK_AUTH_FAILED',
      })
    );
  });

  it('returns 503 when configured account key row is missing', async () => {
    process.env.ULTAURA_CRYPTO_HEALTH_ACCOUNT_ID = TEST_ACCOUNT_ID;
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    });

    const response = await GET(createRequest('test-internal-secret'));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual(
      expect.objectContaining({
        ok: false,
        code: 'ACCOUNT_KEY_NOT_FOUND',
      })
    );
  });

  it('returns skipped status when no key rows exist and no account is configured', async () => {
    delete process.env.ULTAURA_CRYPTO_HEALTH_ACCOUNT_ID;
    limitMock.mockResolvedValue({
      data: [],
      error: null,
    });

    const response = await GET(createRequest('test-internal-secret'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'skipped',
      })
    );
  });
});
