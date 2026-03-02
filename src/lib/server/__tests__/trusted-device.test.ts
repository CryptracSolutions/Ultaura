import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const TEST_SECRET = 'a'.repeat(64);

beforeAll(() => {
  process.env.TRUSTED_DEVICE_SECRET = TEST_SECRET;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('trusted-device crypto', () => {
  describe('generateTrustedDeviceToken', () => {
    it('generates a token with payload.signature format', async () => {
      const { generateTrustedDeviceToken } = await import(
        '~/lib/server/trusted-device'
      );

      const token = generateTrustedDeviceToken('user-1', 'factor-1');
      const parts = token.split('.');

      expect(parts).toHaveLength(2);
      expect(parts[0].length).toBeGreaterThan(0);
      expect(parts[1].length).toBeGreaterThan(0);
    });

    it('includes correct payload fields', async () => {
      const { generateTrustedDeviceToken } = await import(
        '~/lib/server/trusted-device'
      );

      const token = generateTrustedDeviceToken('user-1', 'factor-1');
      const payloadStr = token.split('.')[0];
      const payload = JSON.parse(
        Buffer.from(payloadStr, 'base64url').toString(),
      );

      expect(payload).toMatchObject({
        userId: 'user-1',
        factorId: 'factor-1',
      });
      expect(payload.trustedAt).toBeTypeOf('number');
      expect(payload.expiresAt).toBeTypeOf('number');
      expect(payload.nonce).toBeTypeOf('string');
      expect(payload.expiresAt).toBeGreaterThan(payload.trustedAt);
    });

    it('sets expiry to 30 days from now', async () => {
      const { generateTrustedDeviceToken } = await import(
        '~/lib/server/trusted-device'
      );

      const before = Date.now();
      const token = generateTrustedDeviceToken('user-1', 'factor-1');
      const after = Date.now();

      const payloadStr = token.split('.')[0];
      const payload = JSON.parse(
        Buffer.from(payloadStr, 'base64url').toString(),
      );

      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      expect(payload.expiresAt).toBeGreaterThanOrEqual(before + thirtyDays);
      expect(payload.expiresAt).toBeLessThanOrEqual(after + thirtyDays);
    });

    it('generates unique nonces for each token', async () => {
      const { generateTrustedDeviceToken } = await import(
        '~/lib/server/trusted-device'
      );

      const token1 = generateTrustedDeviceToken('user-1', 'factor-1');
      const token2 = generateTrustedDeviceToken('user-1', 'factor-1');

      const payload1 = JSON.parse(
        Buffer.from(token1.split('.')[0], 'base64url').toString(),
      );
      const payload2 = JSON.parse(
        Buffer.from(token2.split('.')[0], 'base64url').toString(),
      );

      expect(payload1.nonce).not.toBe(payload2.nonce);
    });
  });

  describe('verifyTrustedDeviceToken', () => {
    it('verifies a valid token and returns payload', async () => {
      const { generateTrustedDeviceToken, verifyTrustedDeviceToken } =
        await import('~/lib/server/trusted-device');

      const token = generateTrustedDeviceToken('user-1', 'factor-1');
      const payload = verifyTrustedDeviceToken(token, 'user-1');

      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe('user-1');
      expect(payload?.factorId).toBe('factor-1');
    });

    it('returns null for wrong userId', async () => {
      const { generateTrustedDeviceToken, verifyTrustedDeviceToken } =
        await import('~/lib/server/trusted-device');

      const token = generateTrustedDeviceToken('user-1', 'factor-1');
      const payload = verifyTrustedDeviceToken(token, 'user-2');

      expect(payload).toBeNull();
    });

    it('returns null for tampered payload', async () => {
      const { generateTrustedDeviceToken, verifyTrustedDeviceToken } =
        await import('~/lib/server/trusted-device');

      const token = generateTrustedDeviceToken('user-1', 'factor-1');
      const [, signature] = token.split('.');

      const tamperedPayload = Buffer.from(
        JSON.stringify({
          userId: 'user-1',
          factorId: 'factor-1',
          trustedAt: Date.now(),
          expiresAt: Date.now() + 999999999,
          nonce: 'tampered',
        }),
      ).toString('base64url');

      const tamperedToken = `${tamperedPayload}.${signature}`;
      const payload = verifyTrustedDeviceToken(tamperedToken, 'user-1');

      expect(payload).toBeNull();
    });

    it('returns null for tampered signature', async () => {
      const { generateTrustedDeviceToken, verifyTrustedDeviceToken } =
        await import('~/lib/server/trusted-device');

      const token = generateTrustedDeviceToken('user-1', 'factor-1');
      const [payloadStr] = token.split('.');

      const tamperedToken = `${payloadStr}.tampered-signature`;
      const payload = verifyTrustedDeviceToken(tamperedToken, 'user-1');

      expect(payload).toBeNull();
    });

    it('returns null for expired token', async () => {
      const { verifyTrustedDeviceToken } = await import(
        '~/lib/server/trusted-device'
      );

      const { createHmac } = await import('crypto');

      const expiredPayload = {
        userId: 'user-1',
        factorId: 'factor-1',
        trustedAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
        expiresAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
        nonce: 'test-nonce',
      };

      const payloadStr = Buffer.from(JSON.stringify(expiredPayload)).toString(
        'base64url',
      );
      const signature = createHmac('sha256', TEST_SECRET)
        .update(payloadStr)
        .digest('base64url');

      const token = `${payloadStr}.${signature}`;
      const result = verifyTrustedDeviceToken(token, 'user-1');

      expect(result).toBeNull();
    });

    it('returns null for malformed token (no dot separator)', async () => {
      const { verifyTrustedDeviceToken } = await import(
        '~/lib/server/trusted-device'
      );

      expect(verifyTrustedDeviceToken('no-dot-separator', 'user-1')).toBeNull();
    });

    it('returns null for empty token', async () => {
      const { verifyTrustedDeviceToken } = await import(
        '~/lib/server/trusted-device'
      );

      expect(verifyTrustedDeviceToken('', 'user-1')).toBeNull();
    });
  });

  describe('missing secret', () => {
    it('throws when TRUSTED_DEVICE_SECRET is not set (generate)', async () => {
      const originalSecret = process.env.TRUSTED_DEVICE_SECRET;
      delete process.env.TRUSTED_DEVICE_SECRET;

      try {
        vi.resetModules();
        const { generateTrustedDeviceToken } = await import(
          '~/lib/server/trusted-device'
        );

        expect(() => generateTrustedDeviceToken('user-1', 'factor-1')).toThrow(
          'TRUSTED_DEVICE_SECRET',
        );
      } finally {
        process.env.TRUSTED_DEVICE_SECRET = originalSecret;
      }
    });

    it('returns null when TRUSTED_DEVICE_SECRET is not set (verify)', async () => {
      const originalSecret = process.env.TRUSTED_DEVICE_SECRET;
      delete process.env.TRUSTED_DEVICE_SECRET;

      try {
        vi.resetModules();
        const { verifyTrustedDeviceToken } = await import(
          '~/lib/server/trusted-device'
        );

        const result = verifyTrustedDeviceToken('some.token', 'user-1');
        expect(result).toBeNull();
      } finally {
        process.env.TRUSTED_DEVICE_SECRET = originalSecret;
      }
    });
  });
});
