import crypto from 'crypto';

function getLogKey(): string {
  return (
    process.env.ULTAURA_LOG_PII_KEY ||
    process.env.ULTAURA_INTERNAL_API_SECRET ||
    ''
  );
}

export function hashPii(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = getLogKey();
  if (!key) return null;
  return crypto
    .createHmac('sha256', key)
    .update(value)
    .digest('hex')
    .slice(0, 16);
}

export function assertNewsletterEnv(): void {
  const required = [
    'RESEND_API_KEY',
    'RESEND_SEGMENT_ID',
    'RESEND_TOPIC_BLOG_DIGEST_ID',
    'RESEND_TOPIC_ELDER_CARE_TIPS_ID',
    'RESEND_TOPIC_PRODUCT_UPDATES_ID',
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing newsletter environment variables: ${missing.join(', ')}`);
  }
}
