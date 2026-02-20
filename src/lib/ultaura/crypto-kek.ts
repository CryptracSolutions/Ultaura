import crypto from 'crypto';

export type DecryptionErrorCode =
  | 'DEK_AUTH_FAILED'
  | 'DEK_PAYLOAD_INVALID'
  | 'KEK_CONFIG_INVALID';

export type UnwrapMode = 'current_or_previous' | 'current_only';

const DEFAULT_ALGORITHM: crypto.CipherGCMTypes = 'aes-256-gcm';
const DEFAULT_TAG_LENGTH = 16;
const DEFAULT_IV_LENGTH = 12;
const AUTH_FAILURE_MESSAGE =
  'Failed to authenticate DEK. The Key Encryption Key may be incorrect or corrupted.';

type KeyCandidate = {
  label: 'current' | 'previous';
  value: Buffer;
};

export class DecryptionError extends Error {
  readonly code: DecryptionErrorCode;
  declare readonly cause?: unknown;

  constructor(code: DecryptionErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'DecryptionError';
    this.code = code;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export function isDecryptionError(error: unknown): error is DecryptionError {
  return error instanceof DecryptionError;
}

function loadHexKeyOrThrow(envName: string, required: boolean): Buffer | null {
  const value = process.env[envName];

  if (!value) {
    if (required) {
      throw new DecryptionError(
        'KEK_CONFIG_INVALID',
        `Missing ${envName} environment variable`
      );
    }
    return null;
  }

  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new DecryptionError(
      'KEK_CONFIG_INVALID',
      `${envName} must be exactly 64 hexadecimal characters`
    );
  }

  return Buffer.from(value, 'hex');
}

function loadRequiredHexKeyOrThrow(envName: string): Buffer {
  const key = loadHexKeyOrThrow(envName, true);
  if (!key) {
    throw new DecryptionError(
      'KEK_CONFIG_INVALID',
      `Missing ${envName} environment variable`
    );
  }
  return key;
}

function getKeyCandidates(mode: UnwrapMode): KeyCandidate[] {
  const current = loadRequiredHexKeyOrThrow('ULTAURA_ENCRYPTION_KEY');
  const candidates: KeyCandidate[] = [{ label: 'current', value: current }];

  if (mode === 'current_only') {
    return candidates;
  }

  const previous = loadHexKeyOrThrow('ULTAURA_ENCRYPTION_KEY_PREVIOUS', false);
  if (previous) {
    candidates.push({ label: 'previous', value: previous });
  }

  return candidates;
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

function mapUnknownFailure(error: unknown): DecryptionError {
  if (isDecryptionError(error)) {
    return error;
  }

  if (isAuthFailure(error)) {
    return new DecryptionError('DEK_AUTH_FAILED', AUTH_FAILURE_MESSAGE, { cause: error });
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (
      message.includes('invalid key length') ||
      message.includes('invalid key') ||
      message.includes('unknown cipher') ||
      message.includes('unknown digest')
    ) {
      return new DecryptionError('KEK_CONFIG_INVALID', error.message, { cause: error });
    }

    if (
      message.includes('invalid initialization vector') ||
      message.includes('invalid iv length') ||
      message.includes('invalid authentication tag length')
    ) {
      return new DecryptionError(
        'DEK_PAYLOAD_INVALID',
        'Failed to unwrap DEK due to invalid encrypted payload.',
        { cause: error }
      );
    }
  }

  return new DecryptionError(
    'DEK_PAYLOAD_INVALID',
    'Failed to unwrap DEK due to invalid encrypted payload.',
    { cause: error }
  );
}

function attemptUnwrap(params: {
  wrapped: Buffer;
  iv: Buffer;
  tag: Buffer;
  key: Buffer;
  algorithm: crypto.CipherGCMTypes;
  authTagLength: number;
}): Buffer {
  const decipher = crypto.createDecipheriv(
    params.algorithm,
    params.key,
    params.iv,
    { authTagLength: params.authTagLength }
  );
  decipher.setAuthTag(params.tag);
  return Buffer.concat([decipher.update(params.wrapped), decipher.final()]);
}

export function unwrapDEK(
  wrapped: Buffer,
  iv: Buffer,
  tag: Buffer,
  options?: {
    algorithm?: crypto.CipherGCMTypes;
    authTagLength?: number;
    mode?: UnwrapMode;
  }
): Buffer {
  const mode = options?.mode ?? 'current_or_previous';
  const algorithm = options?.algorithm ?? DEFAULT_ALGORITHM;
  const authTagLength = options?.authTagLength ?? DEFAULT_TAG_LENGTH;
  const candidates = getKeyCandidates(mode);

  let authFailures = 0;
  let lastFailure: unknown = null;

  for (const candidate of candidates) {
    try {
      return attemptUnwrap({
        wrapped,
        iv,
        tag,
        key: candidate.value,
        algorithm,
        authTagLength,
      });
    } catch (error) {
      if (isAuthFailure(error)) {
        authFailures += 1;
        lastFailure = error;
        continue;
      }

      throw mapUnknownFailure(error);
    }
  }

  if (authFailures > 0) {
    throw new DecryptionError('DEK_AUTH_FAILED', AUTH_FAILURE_MESSAGE, {
      cause: lastFailure,
    });
  }

  throw new DecryptionError(
    'DEK_PAYLOAD_INVALID',
    'Failed to unwrap DEK due to invalid encrypted payload.',
    { cause: lastFailure }
  );
}

export function wrapDEKWithCurrentKey(
  dek: Buffer,
  options?: {
    algorithm?: crypto.CipherGCMTypes;
    authTagLength?: number;
    ivLength?: number;
  }
): { wrapped: Buffer; iv: Buffer; tag: Buffer } {
  const algorithm = options?.algorithm ?? DEFAULT_ALGORITHM;
  const authTagLength = options?.authTagLength ?? DEFAULT_TAG_LENGTH;
  const ivLength = options?.ivLength ?? DEFAULT_IV_LENGTH;

  const current = loadRequiredHexKeyOrThrow('ULTAURA_ENCRYPTION_KEY');
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, current, iv, { authTagLength });

  const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();

  return { wrapped, iv, tag };
}
