import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const storageFromMock = vi.hoisted(() => vi.fn());
const removeMock = vi.hoisted(() => vi.fn());
const processExportRequestMock = vi.hoisted(() => vi.fn());

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../utils/supabase.js', () => ({
  getSupabaseClient: () => ({
    rpc: rpcMock,
    from: fromMock,
    storage: {
      from: storageFromMock,
    },
  }),
}));

vi.mock('../../services/exports.js', () => ({
  processExportRequest: processExportRequestMock,
}));

vi.mock('../../utils/twilio.js', () => ({
  getTwilioClient: () => ({
    recordings: () => ({
      remove: vi.fn(),
    }),
  }),
}));

import { logger } from '../../utils/logger.js';
import { canAttempt, getBackoffMs, processPendingRecordingDeletions } from '../recording-deletion.js';

function createBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    is: vi.fn(() => builder),
    then: (resolve: (value: unknown) => void) => resolve(result),
  };
  return builder;
}

describe('recording-deletion scheduler', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    storageFromMock.mockReset();
    removeMock.mockReset();
    processExportRequestMock.mockReset();
    removeMock.mockResolvedValue({ error: null });
    storageFromMock.mockReturnValue({ remove: removeMock });
    processExportRequestMock.mockResolvedValue({ success: true, status: 200 });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips processing when lease is held by another worker', async () => {
    rpcMock.mockResolvedValueOnce({ data: false, error: null });

    await processPendingRecordingDeletions();

    expect(fromMock).not.toHaveBeenCalled();
  });

  it('calculates backoff windows correctly', () => {
    expect(getBackoffMs(0)).toBe(0);
    expect(getBackoffMs(1)).toBe(15 * 60 * 1000);
    expect(getBackoffMs(2)).toBe(60 * 60 * 1000);
    expect(getBackoffMs(3)).toBe(Number.POSITIVE_INFINITY);
  });

  it('evaluates attempt eligibility using backoff rules', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    expect(canAttempt({ attempts: 0, last_attempt_at: null })).toBe(true);
    expect(canAttempt({ attempts: 1, last_attempt_at: '2025-12-31T23:50:00Z' })).toBe(false);
    expect(canAttempt({ attempts: 1, last_attempt_at: '2025-12-31T23:40:00Z' })).toBe(true);
    expect(canAttempt({ attempts: 2, last_attempt_at: '2025-12-31T23:10:00Z' })).toBe(false);
    expect(canAttempt({ attempts: 2, last_attempt_at: '2025-12-31T22:50:00Z' })).toBe(true);
  });

  it('handles pending deletion query errors gracefully', async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === 'ultaura_pending_recording_deletions') {
        return createBuilder({ data: null, error: new Error('load-failed') });
      }
      return createBuilder({ data: [], error: null });
    });

    await expect(processPendingRecordingDeletions()).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalled();
  });
});
