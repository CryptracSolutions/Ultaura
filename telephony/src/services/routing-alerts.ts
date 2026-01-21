import { logger } from '../utils/logger.js';
import { getInternalApiSecret } from '../utils/env.js';

const ROUTING_ALERT_TTL_MS = 30 * 60 * 1000;
const routingAlertRegistry = new Map<string, number>();

function pruneRegistry(now: number): void {
  for (const [key, timestamp] of routingAlertRegistry.entries()) {
    if (now - timestamp > ROUTING_ALERT_TTL_MS) {
      routingAlertRegistry.delete(key);
    }
  }
}

function shouldSendAlert(key: string): boolean {
  const now = Date.now();
  pruneRegistry(now);
  if (routingAlertRegistry.has(key)) {
    return false;
  }
  routingAlertRegistry.set(key, now);
  return true;
}

export async function sendRoutingAlert(options: {
  callSessionId: string;
  issue: string;
  details: Record<string, unknown>;
  severity?: 'high' | 'medium' | 'low';
}): Promise<void> {
  const anomalyType = `routing_${options.issue}`;
  const key = `${anomalyType}:${options.callSessionId}`;

  if (!shouldSendAlert(key)) {
    return;
  }

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
        anomalyType,
        source: options.callSessionId,
        sourceType: 'session',
        details: {
          ...options.details,
          severity: options.severity ?? 'high',
        },
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      logger.error({
        status: response.status,
        anomalyType,
        callSessionId: options.callSessionId,
      }, 'Failed to send routing alert');
    }
  } catch (error) {
    logger.error({ error, anomalyType, callSessionId: options.callSessionId }, 'Error sending routing alert');
  }
}

