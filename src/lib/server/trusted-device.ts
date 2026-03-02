import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface TrustedDevicePayload {
  userId: string;
  factorId: string;
  trustedAt: number;
  expiresAt: number;
  nonce: string;
}

export function generateTrustedDeviceToken(
  userId: string,
  factorId: string,
): string {
  const secret = getTrustedDeviceSecret();
  const now = Date.now();

  const payload: TrustedDevicePayload = {
    userId,
    factorId,
    trustedAt: now,
    expiresAt: now + THIRTY_DAYS_MS,
    nonce: randomBytes(16).toString('hex'),
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update(payloadStr)
    .digest('base64url');

  return `${payloadStr}.${signature}`;
}

export function verifyTrustedDeviceToken(
  token: string,
  expectedUserId: string,
): TrustedDevicePayload | null {
  try {
    const secret = getTrustedDeviceSecret();
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadStr, signature] = parts;

    const expectedSignature = createHmac('sha256', secret)
      .update(payloadStr)
      .digest('base64url');

    const expectedBuf = Buffer.from(expectedSignature, 'base64url');
    const actualBuf = Buffer.from(signature, 'base64url');
    if (
      expectedBuf.length !== actualBuf.length ||
      !timingSafeEqual(expectedBuf, actualBuf)
    ) {
      return null;
    }

    const payload: TrustedDevicePayload = JSON.parse(
      Buffer.from(payloadStr, 'base64url').toString(),
    );

    if (payload.userId !== expectedUserId) return null;
    if (Date.now() > payload.expiresAt) return null;

    return payload;
  } catch {
    return null;
  }
}

function getTrustedDeviceSecret(): string {
  const secret = process.env.TRUSTED_DEVICE_SECRET;
  if (!secret) {
    throw new Error(
      'TRUSTED_DEVICE_SECRET environment variable is not set. ' +
        'Generate one with: openssl rand -hex 32',
    );
  }
  return secret;
}
