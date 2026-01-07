import { logger } from '../server.js';
import { getSupabaseClient } from '../utils/supabase.js';

export interface RateLimitEventLog {
  eventType: 'allowed' | 'blocked' | 'anomaly';
  action: 'verify_send' | 'verify_check' | 'sms' | 'set_reminder';
  ipAddress?: string;
  phoneNumber?: string;
  accountId?: string;
  callSessionId?: string;
  limitType?: 'phone' | 'ip' | 'account' | 'session' | null;
  remaining?: number;
  wasAllowed: boolean;
  redisAvailable: boolean;
  metadata?: Record<string, unknown>;
}

export async function logRateLimitEvent(event: RateLimitEventLog): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.from('ultaura_rate_limit_events').insert({
    event_type: event.eventType,
    action: event.action,
    ip_address: event.ipAddress ?? null,
    phone_number: event.phoneNumber ?? null,
    account_id: event.accountId ?? null,
    call_session_id: event.callSessionId ?? null,
    limit_type: event.limitType ?? null,
    remaining: event.remaining ?? null,
    was_allowed: event.wasAllowed,
    redis_available: event.redisAvailable,
    metadata: event.metadata ?? null,
  });

  if (error) {
    logger.error({ error, event }, 'Failed to log rate limit event');
  }
}

