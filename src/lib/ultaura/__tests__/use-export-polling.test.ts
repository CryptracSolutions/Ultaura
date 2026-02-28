import { describe, expect, it, vi } from 'vitest';

vi.mock('~/lib/ultaura/privacy', () => ({
  getDataExportRequests: vi.fn(),
}));

import {
  getNextPollingAttemptState,
  hasInProgressExport,
  shouldSkipPollingTick,
} from '~/app/dashboard/(app)/privacy/hooks/useExportPolling';
import type { DataExportRequest } from '~/lib/ultaura/types';

function makeExport(
  id: string,
  status: DataExportRequest['status'],
): DataExportRequest {
  return {
    id,
    accountId: 'acct_1',
    requestedBy: 'user_1',
    createdAt: '2026-01-01T00:00:00.000Z',
    format: 'json',
    includeMemories: true,
    includeCallMetadata: true,
    includeReminders: true,
    status,
    processedAt: null,
    expiresAt: null,
    downloadUrl: null,
    fileSizeBytes: null,
    errorMessage: null,
  };
}

describe('useExportPolling helpers', () => {
  it('detects in-progress exports', () => {
    expect(hasInProgressExport([makeExport('1', 'ready')])).toBe(false);
    expect(hasInProgressExport([makeExport('2', 'processing')])).toBe(true);
  });

  it('skips overlapping or timed-out ticks', () => {
    expect(shouldSkipPollingTick({ inFlight: true, timedOut: false })).toBe(true);
    expect(shouldSkipPollingTick({ inFlight: false, timedOut: true })).toBe(true);
    expect(shouldSkipPollingTick({ inFlight: false, timedOut: false })).toBe(false);
  });

  it('marks polling timeout at configured max attempts', () => {
    expect(getNextPollingAttemptState({ attempts: 0, maxAttempts: 3 })).toEqual({
      attempts: 1,
      timedOut: false,
    });
    expect(getNextPollingAttemptState({ attempts: 2, maxAttempts: 3 })).toEqual({
      attempts: 3,
      timedOut: true,
    });
  });
});
