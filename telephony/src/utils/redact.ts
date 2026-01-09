const PHONE_MASK = '*';

export function redactPhone(phone: string | null | undefined): string {
  if (!phone) return '****';

  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';

  const lastFour = digits.slice(-4);
  const hasPlus = phone.trim().startsWith('+');

  if (hasPlus) {
    const countryCode = digits[0] || '';
    const masked = PHONE_MASK.repeat(Math.max(0, digits.length - 5));
    return `+${countryCode}${masked}${lastFour}`;
  }

  const masked = PHONE_MASK.repeat(Math.max(0, digits.length - 4));
  return `${masked}${lastFour}`;
}

export function redactEmail(email: string | null | undefined): string {
  if (!email) return '***@****.***';

  const [localPart, domainPart] = email.split('@');
  if (!domainPart) return '***@****.***';

  const local = localPart ? `${localPart[0]}***` : '***';
  const domainSections = domainPart.split('.');
  const tld = domainSections.length > 1 ? domainSections.pop() : '***';
  const domain = domainSections.length ? '****' : '***';

  return `${local}@${domain}.${tld || '***'}`;
}

export function redactApiKey(value: string | null | undefined): string {
  if (!value) return '****';

  if (value.startsWith('xai-')) {
    return 'xai-****';
  }

  const prefix = value.slice(0, 4);
  return `${prefix}****`;
}

const SENSITIVE_KEYS = new Set([
  'transcript',
  'transcripts',
  'memory',
  'memories',
  'value',
  'new_value',
  'what_to_forget',
  'what_to_keep_private',
  'mood_overall',
  'mood_intensity',
  'engagement_score',
  'social_need_level',
  'topics',
  'concerns',
  'needs_follow_up',
  'follow_up_reasons',
  'private_topics',
  'confidence_overall',
  'topic_code',
]);

const PHONE_KEYS = new Set([
  'phone',
  'phone_number',
  'phonenumber',
  'to',
  'from',
  'twiliofrom',
  'twilioto',
]);

const API_KEY_KEYS = new Set([
  'authorization',
  'api_key',
  'apikey',
  'token',
  'secret',
]);

export function redactSensitive<T>(value: T): T {
  return redactValue(value, new WeakSet()) as T;
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, seen));
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (seen.has(obj)) {
      return '[Circular]';
    }

    seen.add(obj);
    const result: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(obj)) {
      result[key] = redactEntry(key, entry, seen);
    }

    return result;
  }

  return value;
}

function redactEntry(key: string, value: unknown, seen: WeakSet<object>): unknown {
  const normalizedKey = key.toLowerCase();

  if (SENSITIVE_KEYS.has(normalizedKey)) {
    return '[REDACTED]';
  }

  if (normalizedKey.includes('email')) {
    return typeof value === 'string' ? redactEmail(value) : '[REDACTED]';
  }

  if (PHONE_KEYS.has(normalizedKey) || normalizedKey.includes('phone')) {
    return typeof value === 'string' ? redactPhone(value) : '[REDACTED]';
  }

  if (API_KEY_KEYS.has(normalizedKey) || normalizedKey.includes('secret') || normalizedKey.includes('token')) {
    return typeof value === 'string' ? redactApiKey(value) : '[REDACTED]';
  }

  return redactValue(value, seen);
}
