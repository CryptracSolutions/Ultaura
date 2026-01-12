import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getKEK(): Buffer {
  const kekHex = process.env.ULTAURA_ENCRYPTION_KEY;

  if (!kekHex) {
    throw new Error('Missing ULTAURA_ENCRYPTION_KEY environment variable');
  }

  if (kekHex.length !== 64) {
    throw new Error('ULTAURA_ENCRYPTION_KEY must be 64 hex characters (256 bits)');
  }

  return Buffer.from(kekHex, 'hex');
}

export function generateDEK(): Buffer {
  return crypto.randomBytes(KEY_LENGTH);
}

export function wrapDEK(dek: Buffer): {
  wrapped: Buffer;
  iv: Buffer;
  tag: Buffer;
} {
  const kek = getKEK();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, kek, iv, {
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
  const kek = getKEK();

  const decipher = crypto.createDecipheriv(ALGORITHM, kek, iv, {
    authTagLength: TAG_LENGTH,
  });

  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(wrapped), decipher.final()]);
}
