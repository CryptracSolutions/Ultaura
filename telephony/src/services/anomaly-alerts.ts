import { logger } from '../server.js';
import { getInternalApiSecret } from '../utils/env.js';
import { getRedisClient } from './redis.js';
import { ANOMALY_THRESHOLDS } from './rate-limit-config.js';
import { logRateLimitEvent } from './rate-limit-events.js';

type AnomalyType = 'repeated_hits' | 'cost_threshold' | 'ip_blocked' | 'enumeration';

export interface AnomalyEvent {
  type: AnomalyType;
  source: string;
  sourceType: 'phone' | 'ip' | 'account' | 'session' | 'system';
  details: Record<string, unknown>;
  timestamp: Date;
  accountIds?: string[];
}

export interface RateLimitAnomalyContext {
  action: 'verify_send' | 'verify_check';
  wasAllowed: boolean;
  limitType?: 'phone' | 'ip' | 'account' | 'session' | null;
  ipAddress?: string;
  phoneNumber?: string;
  accountId?: string;
  callSessionId?: string;
  retryAfter?: number;
}

function getUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getUtcHourBucket(date: Date): string {
  return date.toISOString().slice(0, 13).replace(/[-:T]/g, '');
}

function getFiveMinuteBucket(timestampMs: number): number {
  return Math.floor(timestampMs / 1000 / 300);
}

function getSecondsUntilEndOfUtcDay(date: Date): number {
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
  return Math.max(1, Math.floor((end.getTime() - date.getTime()) / 1000));
}

function buildAccountIds(accountId?: string): string[] {
  return accountId ? [accountId] : [];
}

async function sendAnomalyAlert(anomaly: AnomalyEvent): Promise<void> {
  const appBaseUrl =
    process.env.ULTAURA_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000';
  const alertsUrl = `${appBaseUrl.replace(/\/$/, '')}/api/telephony/alerts`;

  try {
    const response = await fetch(alertsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': getInternalApiSecret(),
      },
      body: JSON.stringify({
        anomalyType: anomaly.type,
        source: anomaly.source,
        sourceType: anomaly.sourceType,
        accountIds: Array.from(new Set(anomaly.accountIds || [])),
        details: anomaly.details,
        timestamp: anomaly.timestamp.toISOString(),
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      logger.error({ status: response.status, body }, 'Failed to send anomaly alert');
    }
  } catch (error) {
    logger.error({ error }, 'Error sending anomaly alert');
  }
}

async function recordAnomalyEvent(
  context: RateLimitAnomalyContext,
  anomaly: AnomalyEvent
): Promise<void> {
  await logRateLimitEvent({
    eventType: 'anomaly',
    action: context.action,
    ipAddress: context.ipAddress,
    phoneNumber: context.phoneNumber,
    accountId: context.accountId,
    callSessionId: context.callSessionId,
    limitType: context.limitType ?? null,
    wasAllowed: context.wasAllowed,
    redisAvailable: true,
    metadata: {
      anomalyType: anomaly.type,
      details: anomaly.details,
      source: anomaly.source,
      sourceType: anomaly.sourceType,
    },
  });
}

export async function checkAnomalyThresholds(context: RateLimitAnomalyContext): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    logger.warn({ event: 'anomaly_bypass', reason: 'redis_unavailable', context }, 'Anomaly checks skipped');
    return;
  }

  const now = new Date();

  if (context.action === 'verify_send' && context.ipAddress && context.phoneNumber) {
    const hourBucket = getUtcHourBucket(now);
    const key = `anomaly:ip_phones:${context.ipAddress}:${hourBucket}`;
    const added = await redis.sadd(key, context.phoneNumber);
    const count = await redis.scard(key);
    await redis.expire(key, 2 * 60 * 60);

    if (added === 1 && count >= ANOMALY_THRESHOLDS.enumeration) {
      const anomaly: AnomalyEvent = {
        type: 'enumeration',
        source: context.ipAddress,
        sourceType: 'ip',
        details: {
          uniquePhones: count,
          windowHours: 1,
        },
        timestamp: now,
        accountIds: buildAccountIds(context.accountId),
      };

      await recordAnomalyEvent(context, anomaly);
      await sendAnomalyAlert(anomaly);
    }
  }

  if (!context.wasAllowed) {
    if (context.limitType) {
      const bucket = getFiveMinuteBucket(now.getTime());
      const source =
        context.limitType === 'phone'
          ? context.phoneNumber
          : context.limitType === 'ip'
            ? context.ipAddress
            : context.limitType === 'account'
              ? context.accountId
              : context.callSessionId;

      if (source) {
        const key = `anomaly:hits:${context.limitType}:${source}:${bucket}`;
        const count = await redis.incr(key);
        await redis.expire(key, 10 * 60);

        if (count === ANOMALY_THRESHOLDS.repeatedHits) {
          const anomaly: AnomalyEvent = {
            type: 'repeated_hits',
            source,
            sourceType: context.limitType,
            details: {
              hitCount: count,
              windowMinutes: 5,
            },
            timestamp: now,
            accountIds: buildAccountIds(context.accountId),
          };

          await recordAnomalyEvent(context, anomaly);
          await sendAnomalyAlert(anomaly);
        }
      }
    }

    if (context.limitType === 'ip' && context.ipAddress) {
      const hourBucket = getUtcHourBucket(now);
      const key = `anomaly:alerted:ip:${context.ipAddress}:${hourBucket}`;
      const alreadyAlerted = await redis.get(key);

      if (!alreadyAlerted) {
        await redis.set(key, '1', { ex: 60 * 60 });

        const anomaly: AnomalyEvent = {
          type: 'ip_blocked',
          source: context.ipAddress,
          sourceType: 'ip',
          details: {
            retryAfter: context.retryAfter ?? null,
          },
          timestamp: now,
          accountIds: buildAccountIds(context.accountId),
        };

        await recordAnomalyEvent(context, anomaly);
        await sendAnomalyAlert(anomaly);
      }
    }
  }
}

export async function recordVerificationSpend(options: {
  accountId?: string;
  amountUsd?: number;
  ipAddress?: string;
  phoneNumber?: string;
}): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    logger.warn({ event: 'anomaly_bypass', reason: 'redis_unavailable', options }, 'Spend tracking skipped');
    return;
  }

  const now = new Date();
  const dateKey = getUtcDateKey(now);
  const amount = options.amountUsd ?? 0.05;
  const spendKey = `anomaly:daily_spend:${dateKey}`;

  const totalValue = await redis.incrbyfloat(spendKey, amount);
  const total = typeof totalValue === 'number' ? totalValue : Number.parseFloat(totalValue);
  if (!Number.isFinite(total)) {
    logger.warn({ totalValue }, 'Invalid daily spend value from Redis');
    return;
  }
  await redis.expire(spendKey, getSecondsUntilEndOfUtcDay(now));

  if (total < ANOMALY_THRESHOLDS.costThreshold) {
    return;
  }

  const alertKey = `anomaly:alerted:cost:${dateKey}`;
  const alreadyAlerted = await redis.get(alertKey);
  if (alreadyAlerted) {
    return;
  }

  await redis.set(alertKey, '1', { ex: getSecondsUntilEndOfUtcDay(now) });

  const anomaly: AnomalyEvent = {
    type: 'cost_threshold',
    source: options.accountId || 'system',
    sourceType: options.accountId ? 'account' : 'system',
    details: {
      totalSpendUsd: total,
      thresholdUsd: ANOMALY_THRESHOLDS.costThreshold,
      date: dateKey,
    },
    timestamp: now,
    accountIds: buildAccountIds(options.accountId),
  };

  await recordAnomalyEvent(
    {
      action: 'verify_send',
      wasAllowed: true,
      limitType: null,
      ipAddress: options.ipAddress,
      phoneNumber: options.phoneNumber,
      accountId: options.accountId,
    },
    anomaly
  );

  await sendAnomalyAlert(anomaly);
}
