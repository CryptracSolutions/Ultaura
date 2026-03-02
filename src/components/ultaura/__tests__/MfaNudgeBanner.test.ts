import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCookieStore = {
  get: vi.fn(),
};

const mockListFactors = vi.fn();

beforeEach(() => {
  vi.resetModules();

  vi.stubGlobal('React', {
    createElement: (...args: unknown[]) => ({ type: args[0], props: args[1] }),
  });

  vi.doMock('next/headers', () => ({
    cookies: () => mockCookieStore,
  }));

  vi.doMock('~/core/supabase/server-component-client', () => ({
    default: () => ({
      auth: {
        mfa: {
          listFactors: mockListFactors,
        },
      },
    }),
  }));

  vi.doMock('~/components/ultaura/MfaNudgeBannerClient', () => ({
    MfaNudgeBannerClient: () => 'MfaNudgeBannerClient',
  }));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  mockCookieStore.get.mockReset();
  mockListFactors.mockReset();
});

describe('MfaNudgeBanner display logic', () => {
  it('returns banner when user has no factors and no dismiss cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    mockListFactors.mockResolvedValue({
      data: { totp: [], phone: [] },
    });

    const { MfaNudgeBanner } = await import(
      '~/components/ultaura/MfaNudgeBanner'
    );

    const result = await MfaNudgeBanner();

    expect(result).not.toBeNull();
  });

  it('returns null when user has TOTP factors', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    mockListFactors.mockResolvedValue({
      data: {
        totp: [{ id: 'f1', factor_type: 'totp', status: 'verified' }],
        phone: [],
      },
    });

    const { MfaNudgeBanner } = await import(
      '~/components/ultaura/MfaNudgeBanner'
    );

    const result = await MfaNudgeBanner();

    expect(result).toBeNull();
  });

  it('returns null when user has phone factors', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    mockListFactors.mockResolvedValue({
      data: {
        totp: [],
        phone: [{ id: 'f1', factor_type: 'phone', status: 'verified' }],
      },
    });

    const { MfaNudgeBanner } = await import(
      '~/components/ultaura/MfaNudgeBanner'
    );

    const result = await MfaNudgeBanner();

    expect(result).toBeNull();
  });

  it('returns null when dismiss cookie is recent (within 30 days)', async () => {
    const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    mockCookieStore.get.mockReturnValue({
      value: recentDate.toISOString(),
    });

    const { MfaNudgeBanner } = await import(
      '~/components/ultaura/MfaNudgeBanner'
    );

    const result = await MfaNudgeBanner();

    expect(result).toBeNull();
    expect(mockListFactors).not.toHaveBeenCalled();
  });

  it('shows banner when dismiss cookie is older than 30 days', async () => {
    const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    mockCookieStore.get.mockReturnValue({
      value: oldDate.toISOString(),
    });
    mockListFactors.mockResolvedValue({
      data: { totp: [], phone: [] },
    });

    const { MfaNudgeBanner } = await import(
      '~/components/ultaura/MfaNudgeBanner'
    );

    const result = await MfaNudgeBanner();

    expect(result).not.toBeNull();
  });

  it('returns null when both TOTP and phone factors exist', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    mockListFactors.mockResolvedValue({
      data: {
        totp: [{ id: 'f1', factor_type: 'totp', status: 'verified' }],
        phone: [{ id: 'f2', factor_type: 'phone', status: 'verified' }],
      },
    });

    const { MfaNudgeBanner } = await import(
      '~/components/ultaura/MfaNudgeBanner'
    );

    const result = await MfaNudgeBanner();

    expect(result).toBeNull();
  });

  it('shows banner when factors exist but none are verified', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    mockListFactors.mockResolvedValue({
      data: {
        totp: [{ id: 'f1', factor_type: 'totp', status: 'unverified' }],
        phone: [{ id: 'f2', factor_type: 'phone', status: 'unverified' }],
      },
    });

    const { MfaNudgeBanner } = await import(
      '~/components/ultaura/MfaNudgeBanner'
    );

    const result = await MfaNudgeBanner();

    expect(result).not.toBeNull();
  });

  it('returns null when at least one factor is verified among mixed statuses', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    mockListFactors.mockResolvedValue({
      data: {
        totp: [
          { id: 'f1', factor_type: 'totp', status: 'unverified' },
          { id: 'f2', factor_type: 'totp', status: 'verified' },
        ],
        phone: [],
      },
    });

    const { MfaNudgeBanner } = await import(
      '~/components/ultaura/MfaNudgeBanner'
    );

    const result = await MfaNudgeBanner();

    expect(result).toBeNull();
  });
});
