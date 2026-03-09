import 'server-only';

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name} env variable.`);
  }

  return value;
}

export function getAccountsEmailSender() {
  return getRequiredEnv('EMAIL_SENDER_ACCOUNTS');
}

export function getNotificationsEmailSender() {
  return getRequiredEnv('EMAIL_SENDER_NOTIFICATIONS');
}

export function getSupportReplyToEmail() {
  return getRequiredEnv('EMAIL_REPLY_TO_SUPPORT');
}

export function getNewsletterEmailSender() {
  return getRequiredEnv('RESEND_FROM_EMAIL');
}
