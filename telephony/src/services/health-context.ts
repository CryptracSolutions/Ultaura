import type { TelephonyHealthContext } from '@ultaura/types';
import { getBackendUrl, getInternalApiSecret } from '../utils/env.js';
import { logger } from '../utils/logger.js';

const HEALTH_CONTEXT_TIMEOUT_MS = 3000;

export async function fetchHealthContext(
  lineId: string,
  callSessionId: string,
): Promise<TelephonyHealthContext | null> {
  const url = `${getBackendUrl()}/api/telephony/health/context?lineId=${encodeURIComponent(lineId)}&callSessionId=${encodeURIComponent(callSessionId)}`;
  const headers: Record<string, string> = {
    'x-webhook-secret': getInternalApiSecret(),
    'x-ultaura-health-contract-version': 'v1',
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        HEALTH_CONTEXT_TIMEOUT_MS,
      );

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn(
          { status: response.status, lineId, attempt },
          'Health context fetch failed with non-200 status',
        );
        if (attempt === 0) continue;
        return null;
      }

      const data = (await response.json()) as TelephonyHealthContext;
      return data;
    } catch (error) {
      const isAbort =
        error instanceof Error && error.name === 'AbortError';
      logger.warn(
        { error, lineId, attempt, isTimeout: isAbort },
        'Health context fetch error',
      );
      if (attempt === 0) continue;
      return null;
    }
  }

  return null;
}
