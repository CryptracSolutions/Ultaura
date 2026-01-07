import { Ratelimit } from '@upstash/ratelimit';
import { logger } from '../server.js';
import { getSupabaseClient } from '../utils/supabase.js';
import { getRedisClient } from './redis.js';
import { RATE_LIMITS } from './rate-limit-config.js';
import { logRateLimitEvent } from './rate-limit-events.js';

export interface RateLimitResult {
  allowed: boolean;
  remaining?: number;
  resetAt?: number;
  retryAfter: number;
  limitType: 'phone' | 'ip' | 'account' | 'session' | null;
  redisAvailable: boolean;
  metadata?: Record<string, unknown>;
}

export interface RateLimitCheck {
  phoneNumber?: string;
  ipAddress?: string;
  accountId?: string;
  callSessionId?: string;
  action: 'verify_send' | 'verify_check' | 'sms' | 'set_reminder';
}

const limiterCache = new Map<string, Ratelimit>();
const HOURLY_WINDOW = '1 h' as const;
const DAILY_WINDOW = '24 h' as const;

type RatelimitResponse = Awaited<ReturnType<Ratelimit['limit']>>;

function getLimiter(
  name: string,
  limit: number,
  window: `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`
): Ratelimit | null {
  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  const existing = limiterCache.get(name);
  if (existing) {
    return existing;
  }

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: 'ratelimit',
  });

  limiterCache.set(name, limiter);
  return limiter;
}

function normalizeReset(reset: number | Date): number {
  if (reset instanceof Date) {
    return reset.getTime();
  }

  if (reset < 1_000_000_000_000) {
    return reset * 1000;
  }

  return reset;
}

function toBlockedResult(
  limitType: RateLimitResult['limitType'],
  response: RatelimitResponse,
  redisAvailable: boolean
): RateLimitResult {
  const resetAt = normalizeReset(response.reset);
  const retryAfter = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));

  return {
    allowed: response.success,
    remaining: response.remaining,
    resetAt,
    retryAfter,
    limitType,
    redisAvailable,
  };
}

function shouldBypassRateLimit(ipAddress?: string): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  if (!ipAddress) {
    return false;
  }

  const normalized = ipAddress.replace(/^::ffff:/, '');

  return (
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized.startsWith('10.') ||
    normalized.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(normalized)
  );
}

async function checkVerificationDisabled(): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('ultaura_system_settings')
    .select('value')
    .eq('key', 'verification_disabled')
    .single();

  if (error) {
    logger.error({ error }, 'Failed to read verification kill switch');
    return false;
  }

  return data?.value?.enabled === true;
}

export async function isVerificationDisabled(): Promise<boolean> {
  return checkVerificationDisabled();
}

export async function checkRateLimit(check: RateLimitCheck): Promise<RateLimitResult> {
  const redisAvailable = !!getRedisClient();

  if (shouldBypassRateLimit(check.ipAddress)) {
    return {
      allowed: true,
      retryAfter: 0,
      limitType: null,
      redisAvailable,
      metadata: { bypassed: true },
    };
  }

  if (!redisAvailable) {
    logger.warn({ event: 'rate_limit_bypass', reason: 'redis_unavailable', ...check }, 'Rate limiter bypassed');
    return {
      allowed: true,
      retryAfter: 0,
      limitType: null,
      redisAvailable: false,
      metadata: { reason: 'redis_unavailable' },
    };
  }

  try {
    if (check.action === 'verify_send' || check.action === 'verify_check') {
      const phoneNumber = check.phoneNumber;
      const ipAddress = check.ipAddress;
      const accountId = check.accountId;

      if (!phoneNumber || !ipAddress || !accountId) {
        return {
          allowed: true,
          retryAfter: 0,
          limitType: null,
          redisAvailable: true,
          metadata: { reason: 'missing_identifier' },
        };
      }

      const phoneLimit = check.action === 'verify_send'
        ? RATE_LIMITS.verifySendPerPhone
        : RATE_LIMITS.verifyCheckPerPhone;

      const phoneLimiter = getLimiter('verify-phone', phoneLimit, HOURLY_WINDOW);
      const ipLimiter = getLimiter('verify-ip', RATE_LIMITS.perIp, HOURLY_WINDOW);
      const accountLimiter = getLimiter('verify-account', RATE_LIMITS.perAccount, HOURLY_WINDOW);

      if (!phoneLimiter || !ipLimiter || !accountLimiter) {
        logger.warn(
          { event: 'rate_limit_bypass', reason: 'redis_unavailable', ...check },
          'Rate limiter bypassed'
        );
        return {
          allowed: true,
          retryAfter: 0,
          limitType: null,
          redisAvailable: false,
          metadata: { reason: 'redis_unavailable' },
        };
      }

      const phoneKey = `verify:phone:${phoneNumber}:${check.action === 'verify_send' ? 'send' : 'check'}`;
      const phoneResult = await phoneLimiter.limit(phoneKey);
      if (!phoneResult.success) {
        return toBlockedResult('phone', phoneResult, true);
      }

      const ipKey = `verify:ip:${ipAddress}`;
      const ipResult = await ipLimiter.limit(ipKey);
      if (!ipResult.success) {
        return toBlockedResult('ip', ipResult, true);
      }

      const accountKey = `verify:account:${accountId}`;
      const accountResult = await accountLimiter.limit(accountKey);
      if (!accountResult.success) {
        return toBlockedResult('account', accountResult, true);
      }

      const mostRestrictive = [phoneResult, ipResult, accountResult].reduce((min, current) => {
        return current.remaining < min.remaining ? current : min;
      });

      return {
        allowed: true,
        remaining: mostRestrictive.remaining,
        resetAt: normalizeReset(mostRestrictive.reset),
        retryAfter: 0,
        limitType: null,
        redisAvailable: true,
      };
    }

    if (check.action === 'sms') {
      const accountId = check.accountId;
      if (!accountId) {
        return {
          allowed: true,
          retryAfter: 0,
          limitType: null,
          redisAvailable: true,
          metadata: { reason: 'missing_identifier' },
        };
      }

      const smsLimiter = getLimiter('sms-account', RATE_LIMITS.smsPerAccount, DAILY_WINDOW);
      if (!smsLimiter) {
        logger.warn(
          { event: 'rate_limit_bypass', reason: 'redis_unavailable', ...check },
          'Rate limiter bypassed'
        );
        return {
          allowed: true,
          retryAfter: 0,
          limitType: null,
          redisAvailable: false,
          metadata: { reason: 'redis_unavailable' },
        };
      }

      const smsKey = `sms:account:${accountId}`;
      const smsResult = await smsLimiter.limit(smsKey);
      if (!smsResult.success) {
        return toBlockedResult('account', smsResult, true);
      }

      return {
        allowed: true,
        remaining: smsResult.remaining,
        resetAt: normalizeReset(smsResult.reset),
        retryAfter: 0,
        limitType: null,
        redisAvailable: true,
      };
    }

    if (check.action === 'set_reminder') {
      const callSessionId = check.callSessionId;
      if (!callSessionId) {
        return {
          allowed: true,
          retryAfter: 0,
          limitType: null,
          redisAvailable: true,
          metadata: { reason: 'missing_identifier' },
        };
      }

      const reminderLimiter = getLimiter('reminder-session', RATE_LIMITS.remindersPerSession, DAILY_WINDOW);
      if (!reminderLimiter) {
        logger.warn(
          { event: 'rate_limit_bypass', reason: 'redis_unavailable', ...check },
          'Rate limiter bypassed'
        );
        return {
          allowed: true,
          retryAfter: 0,
          limitType: null,
          redisAvailable: false,
          metadata: { reason: 'redis_unavailable' },
        };
      }

      const reminderKey = `reminders:session:${callSessionId}`;
      const reminderResult = await reminderLimiter.limit(reminderKey);
      if (!reminderResult.success) {
        return toBlockedResult('session', reminderResult, true);
      }

      return {
        allowed: true,
        remaining: reminderResult.remaining,
        resetAt: normalizeReset(reminderResult.reset),
        retryAfter: 0,
        limitType: null,
        redisAvailable: true,
      };
    }
  } catch (error) {
    logger.warn({ event: 'rate_limit_bypass', reason: 'redis_error', error, ...check }, 'Rate limiter error');
    return {
      allowed: true,
      retryAfter: 0,
      limitType: null,
      redisAvailable: false,
      metadata: { reason: 'redis_error' },
    };
  }

  return {
    allowed: true,
    retryAfter: 0,
    limitType: null,
    redisAvailable: true,
  };
}

export async function enforceRateLimit(check: RateLimitCheck): Promise<RateLimitResult> {
  const result = await checkRateLimit(check);

  await logRateLimitEvent({
    eventType: result.allowed ? 'allowed' : 'blocked',
    action: check.action,
    ipAddress: check.ipAddress,
    phoneNumber: check.phoneNumber,
    accountId: check.accountId,
    callSessionId: check.callSessionId,
    limitType: result.allowed ? null : result.limitType,
    remaining: result.remaining,
    wasAllowed: result.allowed,
    redisAvailable: result.redisAvailable,
    metadata: result.metadata,
  });

  return result;
}
