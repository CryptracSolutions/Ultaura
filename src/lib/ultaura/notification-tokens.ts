import 'server-only';

import crypto from 'crypto';

function getTokenSecret(): string {
  const secret =
    process.env.ULTAURA_NOTIFICATION_TOKEN_SECRET || process.env.ULTAURA_INTERNAL_API_SECRET;

  if (!secret) {
    throw new Error('Missing notification token secret');
  }

  return secret;
}

export function buildNotificationRecipientToken(recipientId: string): string {
  return crypto
    .createHmac('sha256', getTokenSecret())
    .update(recipientId)
    .digest('hex');
}

export function hashNotificationToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
