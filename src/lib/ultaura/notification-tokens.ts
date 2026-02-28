import 'server-only';

import crypto from 'crypto';

type NotificationTokenState = {
  token: string;
  tokenHash: string;
  expiresAt: string;
};

function generateNotificationTokenState(options?: {
  ttlDays?: number;
}): NotificationTokenState {
  const ttlDays = options?.ttlDays ?? 7;
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashNotificationToken(token);
  const expiresAt = new Date(
    Date.now() + ttlDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  return {
    token,
    tokenHash,
    expiresAt,
  };
}

export function generateNotificationConfirmationToken(options?: {
  ttlDays?: number;
}): NotificationTokenState {
  return generateNotificationTokenState(options);
}

export function generateNotificationUnsubscribeToken(options?: {
  ttlDays?: number;
}): NotificationTokenState {
  return generateNotificationTokenState(options);
}

// Backward-compatible alias for existing callers.
export function generateNotificationRecipientToken(options?: {
  ttlDays?: number;
}): NotificationTokenState {
  return generateNotificationConfirmationToken(options);
}

// Backward-compatible helper for existing callers/tests.
// recipientId is intentionally ignored; tokens are random one-time secrets.
export function buildNotificationRecipientToken(_recipientId: string): string {
  return generateNotificationUnsubscribeToken().token;
}

export function hashNotificationToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
