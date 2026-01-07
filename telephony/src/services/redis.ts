import { Redis } from '@upstash/redis';
import type { RatelimitConfig } from '@upstash/ratelimit';

let redisClient: Redis | null = null;

type RatelimitRedis = RatelimitConfig['redis'];

export function getRedisClient(): RatelimitRedis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis({ url, token });
  }

  return redisClient as unknown as RatelimitRedis;
}

/**
 * Returns the full Redis client with all available methods.
 * Use this for operations beyond rate limiting (e.g., anomaly detection).
 */
export function getRawRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis({ url, token });
  }

  return redisClient;
}

export function isRedisAvailable(): boolean {
  return redisClient !== null;
}
