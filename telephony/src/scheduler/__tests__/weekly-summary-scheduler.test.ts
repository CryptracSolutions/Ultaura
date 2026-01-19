import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const generateWeeklySummaryForLine = vi.hoisted(() => vi.fn());

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
  }),
}));

vi.mock('../../services/weekly-summary.js', () => ({
  generateWeeklySummaryForLine,
}));

import { runWeeklySummaryCycle } from '../weekly-summary-scheduler.js';

describe('weekly-summary-scheduler', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    generateWeeklySummaryForLine.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips processing when lease is held by another worker', async () => {
    rpcMock.mockResolvedValueOnce({ data: false, error: null });

    await runWeeklySummaryCycle();

    expect(generateWeeklySummaryForLine).not.toHaveBeenCalled();
  });

  it('processes lines when lease is acquired', async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });
    const selectMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'line-1',
          account_id: 'account-1',
          display_name: 'Test',
          timezone: 'America/New_York',
          short_id: 'line-1',
          last_weekly_summary_at: null,
        },
      ],
      error: null,
    });
    fromMock.mockReturnValue({ select: selectMock });

    await runWeeklySummaryCycle();

    expect(generateWeeklySummaryForLine).toHaveBeenCalledTimes(1);
  });

  it('handles lease acquisition errors gracefully', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('fail') });

    await expect(runWeeklySummaryCycle()).resolves.toBeUndefined();
    expect(generateWeeklySummaryForLine).not.toHaveBeenCalled();
  });
});
