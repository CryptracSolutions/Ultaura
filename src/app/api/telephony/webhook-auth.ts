import crypto from 'crypto';
import { NextResponse } from 'next/server';

/**
 * Validates the X-Webhook-Secret header against ULTAURA_INTERNAL_API_SECRET
 * using a constant-time comparison to prevent timing attacks.
 * Returns a 401/500 response if invalid, or null if valid.
 */
export function validateWebhookSecret(request: Request): NextResponse | null {
  const expectedSecret = process.env.ULTAURA_INTERNAL_API_SECRET;
  const providedSecret = request.headers.get('x-webhook-secret');

  if (!expectedSecret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (!providedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const providedBuffer = Buffer.from(providedSecret, 'utf8');
  const expectedBuffer = Buffer.from(expectedSecret, 'utf8');

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(Uint8Array.from(providedBuffer), Uint8Array.from(expectedBuffer))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
