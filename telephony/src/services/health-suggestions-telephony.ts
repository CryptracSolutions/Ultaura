import type { QueueHealthSuggestionCandidateResult } from '@ultaura/types';
import { getBackendUrl, getInternalApiSecret } from '../utils/env.js';
import { logger } from '../server.js';

export async function submitHealthSuggestionCandidate(payload: {
  lineId: string;
  callSessionId: string;
  suggestionType: 'condition' | 'medication';
  suggestionMode: 'new' | 'update';
  normalizedName: string;
  confidenceLabel: 'high' | 'medium';
  summaryParaphrase: string;
  proposedFields: Record<string, unknown>;
}): Promise<QueueHealthSuggestionCandidateResult | null> {
  const url = `${getBackendUrl()}/api/telephony/health/suggestions`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': getInternalApiSecret(),
        'x-ultaura-health-contract-version': 'v1',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logger.warn({ status: response.status, lineId: payload.lineId }, 'Health suggestion submission failed');
      return null;
    }

    return (await response.json()) as QueueHealthSuggestionCandidateResult;
  } catch (error) {
    logger.error({ error, lineId: payload.lineId }, 'Health suggestion submission error');
    return null;
  }
}
