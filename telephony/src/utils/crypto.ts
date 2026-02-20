import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const AUTH_FAILURE_MESSAGE =
  'Failed to authenticate DEK. The Key Encryption Key may be incorrect or corrupted.';

function parseHexKeyOrThrow(envName: string, required: boolean): Buffer | null {
  const value = process.env[envName];

  if (!value) {
    if (required) {
      throw new Error(`Missing ${envName} environment variable`);
    }
    return null;
  }

  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${envName} must be 64 hex characters (256 bits)`);
  }

  return Buffer.from(value, 'hex');
}

function getKEKs(): { current: Buffer; previous: Buffer | null } {
  return {
    current: parseHexKeyOrThrow('ULTAURA_ENCRYPTION_KEY', true) as Buffer,
    previous: parseHexKeyOrThrow('ULTAURA_ENCRYPTION_KEY_PREVIOUS', false),
  };
}

function isAuthFailure(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('unable to authenticate data') ||
    message.includes('bad decrypt') ||
    message.includes('auth tag') ||
    message.includes('unsupported state')
  );
}

function attemptUnwrap(wrapped: Buffer, iv: Buffer, tag: Buffer, key: Buffer): Buffer {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(wrapped), decipher.final()]);
}

export function generateDEK(): Buffer {
  return crypto.randomBytes(KEY_LENGTH);
}

export function wrapDEK(dek: Buffer): {
  wrapped: Buffer;
  iv: Buffer;
  tag: Buffer;
} {
  const { current } = getKEKs();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, current, iv, {
    authTagLength: TAG_LENGTH,
  });

  const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();

  return { wrapped, iv, tag };
}

export function unwrapDEK(
  wrapped: Buffer,
  iv: Buffer,
  tag: Buffer
): Buffer {
  const { current, previous } = getKEKs();

  try {
    return attemptUnwrap(wrapped, iv, tag, current);
  } catch (error) {
    if (!isAuthFailure(error)) {
      throw error;
    }

    if (previous) {
      try {
        return attemptUnwrap(wrapped, iv, tag, previous);
      } catch (fallbackError) {
        if (!isAuthFailure(fallbackError)) {
          throw fallbackError;
        }
      }
    }

    throw new Error(AUTH_FAILURE_MESSAGE);
  }
}
