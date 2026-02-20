import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { unwrapDEK, wrapDEK } from '../crypto.js';

const ORIGINAL_ENV = { ...process.env };

function resetEnv(): void {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

function wrapWithKey(kekHex: string, dek: Buffer): { wrapped: Buffer; iv: Buffer; tag: Buffer } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(kekHex, 'hex'), iv, {
    authTagLength: 16,
  });
  const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();

  return { wrapped, iv, tag };
}

describe('telephony crypto key unwrap', () => {
  beforeEach(() => {
    resetEnv();
  });

  afterEach(() => {
    resetEnv();
  });

  it('unwraps DEK with current key', () => {
    process.env.ULTAURA_ENCRYPTION_KEY = 'a'.repeat(64);
    delete process.env.ULTAURA_ENCRYPTION_KEY_PREVIOUS;
    const dek = crypto.randomBytes(32);
    const encrypted = wrapDEK(dek);
    const unwrapped = unwrapDEK(encrypted.wrapped, encrypted.iv, encrypted.tag);

    expect(unwrapped.equals(dek)).toBe(true);
  });

  it('falls back to previous key on auth failure with current key', () => {
    const previousKey = 'b'.repeat(64);
    process.env.ULTAURA_ENCRYPTION_KEY = 'c'.repeat(64);
    process.env.ULTAURA_ENCRYPTION_KEY_PREVIOUS = previousKey;
    const dek = crypto.randomBytes(32);
    const encrypted = wrapWithKey(previousKey, dek);
    const unwrapped = unwrapDEK(encrypted.wrapped, encrypted.iv, encrypted.tag);

    expect(unwrapped.equals(dek)).toBe(true);
  });
});
