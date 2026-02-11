import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.hoisted(() => vi.fn());
const reserveFailureInc = vi.hoisted(() => vi.fn());
const releaseFailureInc = vi.hoisted(() => vi.fn());
const labelsMock = vi.hoisted(() =>
  vi.fn((operation: string) => ({
    inc: operation === 'reserve' ? reserveFailureInc : releaseFailureInc,
  }))
);

vi.mock('../../utils/supabase.js', () => ({
  getSupabaseClient: () => ({
    rpc: rpcMock,
  }),
}));

vi.mock('../../utils/metrics.js', () => ({
  trialReservationFailuresTotal: {
    labels: labelsMock,
  },
}));

vi.mock('../../utils/constants.js', () => ({
  TRIAL_DAILY_LIMIT_MINUTES: 20,
}));

vi.mock('../../server.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { reserveTrialDailyCap, releaseTrialDailyCap } from '../metering.js';

describe('metering trial reservation/release', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    labelsMock.mockClear();
    reserveFailureInc.mockReset();
    releaseFailureInc.mockReset();
  });

  it('normalizes reserve success payload from RPC array rows', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{
        allowed: 1,
        reason: null,
        reserved_minutes: 2,
        minutes_used_today: 7,
        minutes_reserved_today: 3,
        minutes_remaining_today: 11,
        day_start_utc: '2026-02-11T08:00:00.000Z',
        day_end_utc: '2026-02-12T07:59:59.999Z',
      }],
      error: null,
    });

    const result = await reserveTrialDailyCap({
      accountId: 'acct-1',
      lineTimezone: 'America/Los_Angeles',
      callSessionId: 'call-1',
    });

    expect(rpcMock).toHaveBeenCalledWith('reserve_trial_daily_cap', {
      p_account_id: 'acct-1',
      p_line_timezone: 'America/Los_Angeles',
      p_call_session_id: 'call-1',
    });
    expect(result).toEqual({
      allowed: true,
      reason: null,
      reservedMinutes: 2,
      minutesUsedToday: 7,
      minutesReservedToday: 3,
      minutesRemainingToday: 11,
      dayStartUtc: '2026-02-11T08:00:00.000Z',
      dayEndUtc: '2026-02-12T07:59:59.999Z',
    });
    expect(labelsMock).not.toHaveBeenCalled();
  });

  it('returns zero-defaulted reserve fields when RPC row has null values', async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        allowed: 0,
        reason: null,
        reserved_minutes: null,
        minutes_used_today: null,
        minutes_reserved_today: null,
        minutes_remaining_today: null,
        day_start_utc: null,
        day_end_utc: null,
      },
      error: null,
    });

    const result = await reserveTrialDailyCap({
      accountId: 'acct-1',
      lineTimezone: 'America/Chicago',
      callSessionId: 'call-2',
    });

    expect(result).toEqual({
      allowed: false,
      reason: null,
      reservedMinutes: 0,
      minutesUsedToday: 0,
      minutesReservedToday: 0,
      minutesRemainingToday: 0,
      dayStartUtc: null,
      dayEndUtc: null,
    });
  });

  it('increments reserve failure metric on reserve RPC error', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'rpc failed' },
    });

    const result = await reserveTrialDailyCap({
      accountId: 'acct-1',
      lineTimezone: 'America/New_York',
      callSessionId: 'call-3',
    });

    expect(result).toBeNull();
    expect(labelsMock).toHaveBeenCalledWith('reserve');
    expect(reserveFailureInc).toHaveBeenCalledTimes(1);
  });

  it('increments reserve failure metric on empty reserve RPC result', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const result = await reserveTrialDailyCap({
      accountId: 'acct-1',
      lineTimezone: 'America/New_York',
      callSessionId: 'call-4',
    });

    expect(result).toBeNull();
    expect(labelsMock).toHaveBeenCalledWith('reserve');
    expect(reserveFailureInc).toHaveBeenCalledTimes(1);
  });

  it('normalizes release success payload and clamps negative billable minutes', async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        released: 1,
        reserved_minutes: 4,
        actual_billable_minutes: 2,
        end_reason: 'hangup',
      },
      error: null,
    });

    const result = await releaseTrialDailyCap({
      callSessionId: 'call-5',
      endReason: 'hangup',
      actualBillableMinutes: -9,
    });

    expect(rpcMock).toHaveBeenCalledWith('release_trial_daily_cap', {
      p_call_session_id: 'call-5',
      p_end_reason: 'hangup',
      p_actual_billable_minutes: 0,
    });
    expect(result).toEqual({
      released: true,
      reservedMinutes: 4,
      actualBillableMinutes: 2,
      endReason: 'hangup',
    });
    expect(labelsMock).not.toHaveBeenCalled();
  });

  it('increments release failure metric on release RPC error', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'rpc failed' },
    });

    const result = await releaseTrialDailyCap({
      callSessionId: 'call-6',
      endReason: 'error',
      actualBillableMinutes: 1,
    });

    expect(result).toBeNull();
    expect(labelsMock).toHaveBeenCalledWith('release');
    expect(releaseFailureInc).toHaveBeenCalledTimes(1);
  });

  it('increments release failure metric on empty release RPC result', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const result = await releaseTrialDailyCap({
      callSessionId: 'call-7',
      endReason: 'busy',
      actualBillableMinutes: 1,
    });

    expect(result).toBeNull();
    expect(labelsMock).toHaveBeenCalledWith('release');
    expect(releaseFailureInc).toHaveBeenCalledTimes(1);
  });
});
