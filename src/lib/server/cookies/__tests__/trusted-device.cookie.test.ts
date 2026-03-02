import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const TEST_SECRET = 'b'.repeat(64);

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

beforeAll(() => {
  process.env.TRUSTED_DEVICE_SECRET = TEST_SECRET;
});

beforeEach(() => {
  vi.resetModules();

  vi.doMock('next/headers', () => ({
    cookies: () => mockCookieStore,
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
  mockCookieStore.get.mockReset();
  mockCookieStore.set.mockReset();
  mockCookieStore.delete.mockReset();
});

describe('trusted-device cookie', () => {
  describe('setTrustedDeviceCookie', () => {
    it('sets cookie with correct options', async () => {
      const { setTrustedDeviceCookie } = await import(
        '~/lib/server/cookies/trusted-device.cookie'
      );

      setTrustedDeviceCookie('test-token-value');

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'trusted-device',
        'test-token-value',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 30 * 24 * 60 * 60,
        }),
      );
    });
  });

  describe('clearTrustedDeviceCookie', () => {
    it('deletes the cookie', async () => {
      const { clearTrustedDeviceCookie } = await import(
        '~/lib/server/cookies/trusted-device.cookie'
      );

      clearTrustedDeviceCookie();

      expect(mockCookieStore.delete).toHaveBeenCalledWith('trusted-device');
    });
  });

  describe('validateTrustedDevice', () => {
    it('returns null when cookie does not exist', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const { validateTrustedDevice } = await import(
        '~/lib/server/cookies/trusted-device.cookie'
      );

      expect(validateTrustedDevice('user-1')).toBeNull();
    });

    it('returns payload for valid cookie', async () => {
      const { generateTrustedDeviceToken } = await import(
        '~/lib/server/trusted-device'
      );

      const token = generateTrustedDeviceToken('user-1', 'factor-1');
      mockCookieStore.get.mockReturnValue({ value: token });

      const { validateTrustedDevice } = await import(
        '~/lib/server/cookies/trusted-device.cookie'
      );

      const result = validateTrustedDevice('user-1');

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user-1');
      expect(result?.factorId).toBe('factor-1');
    });

    it('clears cookie and returns null for invalid token', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'invalid.token' });

      const { validateTrustedDevice } = await import(
        '~/lib/server/cookies/trusted-device.cookie'
      );

      const result = validateTrustedDevice('user-1');

      expect(result).toBeNull();
      expect(mockCookieStore.delete).toHaveBeenCalledWith('trusted-device');
    });
  });

  describe('isTrustedDevice', () => {
    it('returns true when cookie is valid and factor exists', async () => {
      const { generateTrustedDeviceToken } = await import(
        '~/lib/server/trusted-device'
      );

      const token = generateTrustedDeviceToken('user-1', 'factor-1');
      mockCookieStore.get.mockReturnValue({ value: token });

      const { isTrustedDevice } = await import(
        '~/lib/server/cookies/trusted-device.cookie'
      );

      expect(isTrustedDevice('user-1', ['factor-1', 'factor-2'])).toBe(true);
    });

    it('returns false when factor is not in enrolled list', async () => {
      const { generateTrustedDeviceToken } = await import(
        '~/lib/server/trusted-device'
      );

      const token = generateTrustedDeviceToken('user-1', 'factor-1');
      mockCookieStore.get.mockReturnValue({ value: token });

      const { isTrustedDevice } = await import(
        '~/lib/server/cookies/trusted-device.cookie'
      );

      expect(isTrustedDevice('user-1', ['factor-2', 'factor-3'])).toBe(false);
      expect(mockCookieStore.delete).toHaveBeenCalledWith('trusted-device');
    });

    it('returns false when cookie does not exist', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const { isTrustedDevice } = await import(
        '~/lib/server/cookies/trusted-device.cookie'
      );

      expect(isTrustedDevice('user-1', ['factor-1'])).toBe(false);
    });
  });
});
