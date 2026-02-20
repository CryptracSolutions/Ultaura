import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

function resetEnv(): void {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

function wrapWithKek(kekHex: string, dek: Buffer): { wrapped: Buffer; iv: Buffer; tag: Buffer } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(kekHex, 'hex'),
    iv,
    { authTagLength: 16 }
  );
  const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();

  return { wrapped, iv, tag };
}

function mockSupabaseAccountKeyRow(row: {
  dek_wrapped: Uint8Array;
  dek_wrap_iv: Uint8Array;
  dek_wrap_tag: Uint8Array;
}) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: row,
            error: null,
          }),
        })),
      })),
    })),
  };
}

describe('hashReminderQueryTokens fallback', () => {
  beforeEach(() => {
    resetEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetEnv();
  });

  it('returns [] and logs warn when account DEK unwrap fails', async () => {
    const warnMock = vi.fn();
    const errorMock = vi.fn();

    vi.resetModules();
    vi.doMock('server-only', () => ({}));
    vi.doMock('~/core/logger', () => ({
      default: vi.fn(() => ({
        info: vi.fn(),
        error: errorMock,
        warn: warnMock,
        debug: vi.fn(),
      })),
    }));

    const correctKey = '1'.repeat(64);
    process.env.ULTAURA_ENCRYPTION_KEY = '2'.repeat(64);
    delete process.env.ULTAURA_ENCRYPTION_KEY_PREVIOUS;

    const { wrapped, iv, tag } = wrapWithKek(correctKey, crypto.randomBytes(32));
    const mockClient = mockSupabaseAccountKeyRow({
      dek_wrapped: wrapped,
      dek_wrap_iv: iv,
      dek_wrap_tag: tag,
    });

    const { hashReminderQueryTokens } = await import('../reminder-crypto');

    const result = await hashReminderQueryTokens(
      mockClient as unknown as any,
      'acct-fallback',
      ['doctor', 'call']
    );

    expect(result).toEqual([]);
    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'reminder_search_hash_fallback',
        accountId: 'acct-fallback',
        errorCode: 'DEK_AUTH_FAILED',
      }),
      'Failed to hash reminder query tokens; returning empty token set.'
    );
    expect(errorMock).not.toHaveBeenCalled();
  });

  it('emits threshold error log when fallback count reaches configured threshold', async () => {
    const warnMock = vi.fn();
    const errorMock = vi.fn();

    vi.resetModules();
    vi.doMock('server-only', () => ({}));
    vi.doMock('~/core/logger', () => ({
      default: vi.fn(() => ({
        info: vi.fn(),
        error: errorMock,
        warn: warnMock,
        debug: vi.fn(),
      })),
    }));

    const correctKey = '3'.repeat(64);
    process.env.ULTAURA_ENCRYPTION_KEY = '4'.repeat(64);
    process.env.ULTAURA_SEARCH_HASH_FALLBACK_ALERT_THRESHOLD = '2';
    process.env.ULTAURA_SEARCH_HASH_FALLBACK_WARN_EVERY = '1';
    delete process.env.ULTAURA_ENCRYPTION_KEY_PREVIOUS;

    const { wrapped, iv, tag } = wrapWithKek(correctKey, crypto.randomBytes(32));
    const mockClient = mockSupabaseAccountKeyRow({
      dek_wrapped: wrapped,
      dek_wrap_iv: iv,
      dek_wrap_tag: tag,
    });

    const { hashReminderQueryTokens } = await import('../reminder-crypto');

    await hashReminderQueryTokens(
      mockClient as unknown as any,
      'acct-threshold',
      ['first']
    );
    await hashReminderQueryTokens(
      mockClient as unknown as any,
      'acct-threshold',
      ['second']
    );

    expect(warnMock).toHaveBeenCalledTimes(2);
    expect(errorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'reminder_search_hash_fallback_threshold',
        accountId: 'acct-threshold',
        threshold: 2,
      }),
      'Reminder search hash fallback threshold reached.'
    );
  });
});
