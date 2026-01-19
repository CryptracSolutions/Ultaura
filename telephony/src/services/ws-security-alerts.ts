import { logger } from '../utils/logger.js';
import { getInternalApiSecret } from '../utils/env.js';

export type SecurityEventType =
  | 'non_twilio_ip'
  | 'duplicate_connection'
  | 'invalid_token'
  | 'expired_token';

interface SecurityAlertPayload {
  eventType: SecurityEventType;
  callSessionId: string;
  details: Record<string, unknown>;
  timestamp: string;
  severity: 'high' | 'medium' | 'low';
}

export async function sendSecurityAlert(
  callSessionId: string,
  result: {
    ipCheck: { allowed: boolean; reason: string; ip: string };
    tokenCheck: { valid: boolean; reason: string };
    connectionCapCheck: { allowed: boolean; reason: string };
    mode: string;
  }
): Promise<void> {
  const events: SecurityAlertPayload[] = [];

  if (!result.ipCheck.allowed) {
    events.push({
      eventType: 'non_twilio_ip',
      callSessionId,
      details: {
        ip: result.ipCheck.ip,
        reason: result.ipCheck.reason,
      },
      timestamp: new Date().toISOString(),
      severity: 'high',
    });
  }

  if (result.connectionCapCheck.reason === 'duplicate') {
    events.push({
      eventType: 'duplicate_connection',
      callSessionId,
      details: {},
      timestamp: new Date().toISOString(),
      severity: 'high',
    });
  }

  const tokenReason = result.tokenCheck.reason;
  const tokenInvalid = !result.tokenCheck.valid &&
    tokenReason !== 'missing' &&
    tokenReason !== 'expired';

  if (result.ipCheck.allowed && tokenInvalid) {
    events.push({
      eventType: 'invalid_token',
      callSessionId,
      details: { reason: tokenReason },
      timestamp: new Date().toISOString(),
      severity: 'high',
    });
  }

  if (events.length === 0) {
    return;
  }

  const appBaseUrl = process.env.ULTAURA_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000';
  const alertsUrl = `${appBaseUrl.replace(/\/$/, '')}/api/telephony/alerts`;

  for (const event of events) {
    try {
      const response = await fetch(alertsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': getInternalApiSecret(),
        },
        body: JSON.stringify({
          anomalyType: `ws_security_${event.eventType}`,
          source: callSessionId,
          sourceType: 'session',
          details: {
            ...event.details,
            mode: result.mode,
          },
          timestamp: event.timestamp,
          severity: event.severity,
        }),
      });

      if (!response.ok) {
        logger.error({
          status: response.status,
          eventType: event.eventType,
        }, 'Failed to send WS security alert');
      }
    } catch (error) {
      logger.error({ error, eventType: event.eventType }, 'Error sending WS security alert');
    }
  }
}
