import { summarizeArgs } from './redact.js';

/**
 * Build a payload summary that preserves debugging detail.
 * If payload already has argsSummary (from summarizeArgs()), preserve it.
 * Otherwise, summarize the raw payload.
 */
export function buildPayloadSummary(payload: Record<string, unknown>): Record<string, unknown> {
  if (isArgsSummary(payload.argsSummary)) {
    return {
      tool: payload.tool,
      argsSummary: payload.argsSummary,
    };
  }

  return summarizeArgs(payload);
}

function isArgsSummary(value: unknown): value is Record<string, { type: string; size?: number }> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  for (const entry of Object.values(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return false;
    }

    const summary = entry as Record<string, unknown>;
    if (typeof summary.type !== 'string') {
      return false;
    }

    if ('size' in summary && typeof summary.size !== 'number') {
      return false;
    }

    const keys = Object.keys(summary);
    for (const key of keys) {
      if (key !== 'type' && key !== 'size') {
        return false;
      }
    }
  }

  return true;
}
