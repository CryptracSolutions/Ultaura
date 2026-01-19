import crypto from 'crypto';
import { logger } from '../utils/logger.js';

interface TokenValidationResult {
  valid: boolean;
  reason: 'valid' | 'expired' | 'invalid_signature' | 'malformed' | 'missing';
  callSessionId?: string;
}

const TOKEN_LIFETIME_SECONDS = 300;

function getSecrets(): { current: string; previous: string | null } {
  const current = process.env.ULTAURA_STREAM_TOKEN_SECRET;
  const previous = process.env.ULTAURA_STREAM_TOKEN_SECRET_PREVIOUS || null;

  if (!current) {
    throw new Error('ULTAURA_STREAM_TOKEN_SECRET is required');
  }

  return { current, previous };
}

function createHmac(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
}

function safeTimingEqual(a: string, b: string): boolean {
  try {
    const aBuffer = Buffer.from(a, 'base64url');
    const bBuffer = Buffer.from(b, 'base64url');

    if (aBuffer.length !== bBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(aBuffer, bBuffer);
  } catch {
    return false;
  }
}

export function generateStreamToken(callSessionId: string): string {
  const { current } = getSecrets();
  const exp = Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS;
  const payload = `${callSessionId}.${exp}`;
  const signature = createHmac(payload, current);
  return `${payload}.${signature}`;
}

export function validateStreamToken(
  token: string | null,
  expectedCallSessionId: string
): TokenValidationResult {
  if (!token) {
    return { valid: false, reason: 'missing' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'malformed' };
  }

  const [callSessionId, expStr, signature] = parts;
  const exp = Number.parseInt(expStr, 10);

  if (!callSessionId || !expStr || !signature || Number.isNaN(exp)) {
    return { valid: false, reason: 'malformed' };
  }

  if (callSessionId !== expectedCallSessionId) {
    return { valid: false, reason: 'invalid_signature' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (now > exp) {
    return { valid: false, reason: 'expired', callSessionId };
  }

  const { current, previous } = getSecrets();
  const payload = `${callSessionId}.${expStr}`;
  const expectedSig = createHmac(payload, current);

  if (safeTimingEqual(signature, expectedSig)) {
    return { valid: true, reason: 'valid', callSessionId };
  }

  if (previous) {
    const previousSig = createHmac(payload, previous);
    if (safeTimingEqual(signature, previousSig)) {
      logger.info({ callSessionId }, 'Token validated with previous secret');
      return { valid: true, reason: 'valid', callSessionId };
    }
  }

  return { valid: false, reason: 'invalid_signature', callSessionId };
}
