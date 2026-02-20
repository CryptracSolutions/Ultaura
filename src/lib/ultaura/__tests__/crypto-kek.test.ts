import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DecryptionError, unwrapDEK, wrapDEKWithCurrentKey } from '../crypto-kek';

const ORIGINAL_ENV = { ...process.env };
const ALGORITHM = 'aes-256-gcm';
const TAG_LENGTH = 16;

function resetEnv(): void {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

function wrapWithKek(kekHex: string, dek: Buffer): { wrapped: Buffer; iv: Buffer; tag: Buffer } {
  const kek = Buffer.from(kekHex, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, kek, iv, { authTagLength: TAG_LENGTH });
  const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();

  return { wrapped, iv, tag };
}

describe('crypto-kek', () => {
  beforeEach(() => {
    resetEnv();
  });

  afterEach(() => {
    resetEnv();
  });

  it('unwraps with the current key', () => {
    process.env.ULTAURA_ENCRYPTION_KEY = 'a'.repeat(64);
    delete process.env.ULTAURA_ENCRYPTION_KEY_PREVIOUS;
    const dek = crypto.randomBytes(32);

    const encrypted = wrapDEKWithCurrentKey(dek, {
      algorithm: ALGORITHM,
      authTagLength: TAG_LENGTH,
      ivLength: 12,
    });

    const unwrapped = unwrapDEK(encrypted.wrapped, encrypted.iv, encrypted.tag, {
      algorithm: ALGORITHM,
      authTagLength: TAG_LENGTH,
    });

    expect(unwrapped.equals(dek)).toBe(true);
  });

  it('falls back to previous key in current_or_previous mode', () => {
    const previousKey = 'b'.repeat(64);
    process.env.ULTAURA_ENCRYPTION_KEY = 'c'.repeat(64);
    process.env.ULTAURA_ENCRYPTION_KEY_PREVIOUS = previousKey;

    const dek = crypto.randomBytes(32);
    const encrypted = wrapWithKek(previousKey, dek);
    const unwrapped = unwrapDEK(encrypted.wrapped, encrypted.iv, encrypted.tag, {
      algorithm: ALGORITHM,
      authTagLength: TAG_LENGTH,
      mode: 'current_or_previous',
    });

    expect(unwrapped.equals(dek)).toBe(true);
  });

  it('returns DEK_AUTH_FAILED in current_only mode when current key mismatches', () => {
    const previousKey = 'd'.repeat(64);
    process.env.ULTAURA_ENCRYPTION_KEY = 'e'.repeat(64);
    process.env.ULTAURA_ENCRYPTION_KEY_PREVIOUS = previousKey;
    const dek = crypto.randomBytes(32);
    const encrypted = wrapWithKek(previousKey, dek);

    expect(() =>
      unwrapDEK(encrypted.wrapped, encrypted.iv, encrypted.tag, {
        algorithm: ALGORITHM,
        authTagLength: TAG_LENGTH,
        mode: 'current_only',
      })
    ).toThrowError(
      expect.objectContaining({
        code: 'DEK_AUTH_FAILED',
      })
    );
  });

  it('returns KEK_CONFIG_INVALID for malformed ULTAURA_ENCRYPTION_KEY', () => {
    process.env.ULTAURA_ENCRYPTION_KEY = 'not-a-valid-hex-key';
    delete process.env.ULTAURA_ENCRYPTION_KEY_PREVIOUS;

    try {
      unwrapDEK(Buffer.alloc(8), Buffer.alloc(12), Buffer.alloc(16), {
        algorithm: ALGORITHM,
        authTagLength: TAG_LENGTH,
      });
      throw new Error('Expected unwrapDEK to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(DecryptionError);
      expect((error as DecryptionError).code).toBe('KEK_CONFIG_INVALID');
    }
  });
});
