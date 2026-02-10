import 'server-only';

import crypto from 'crypto';

/**
 * Generate a cryptographically random confirmation token and its SHA-256 hash.
 * The raw token is sent to the user via email; the hash is stored in the database.
 * This is non-deterministic — each call produces a unique token.
 */
export function generateConfirmationToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

/**
 * Hash a token using SHA-256 for comparison against stored hashes.
 * Used when a user clicks the confirmation link — hash the incoming token
 * and compare against confirmation_token_hash in the database.
 */
export function hashConfirmationToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Token expiry duration: 48 hours from now.
 */
export function getTokenExpiresAt(): Date {
  const expires = new Date();
  expires.setHours(expires.getHours() + 48);
  return expires;
}

function getNewsletterUnsubscribeSecret(): string {
  const secret =
    process.env.ULTAURA_INTERNAL_API_SECRET || process.env.RESEND_AUDIENCE_SECRET;

  if (!secret) {
    throw new Error('Missing newsletter unsubscribe token secret');
  }

  return secret;
}

export function buildNewsletterUnsubscribeToken(subscriberId: string): string {
  return crypto
    .createHmac('sha256', getNewsletterUnsubscribeSecret())
    .update(subscriberId)
    .digest('hex');
}

export function verifyNewsletterUnsubscribeToken(
  subscriberId: string,
  token: string,
): boolean {
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return false;
  }

  const expectedToken = buildNewsletterUnsubscribeToken(subscriberId);

  try {
    return crypto.timingSafeEqual(
      Buffer.from(token, 'hex'),
      Buffer.from(expectedToken, 'hex'),
    );
  } catch {
    return false;
  }
}
