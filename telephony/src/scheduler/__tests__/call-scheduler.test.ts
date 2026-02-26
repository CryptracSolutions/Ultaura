import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));
const recalculateBaselinesForAllLines = vi.hoisted(() => vi.fn());
const runPersonaAnalyzerForAllLines = vi.hoisted(() => vi.fn());
const getLineById = vi.hoisted(() => vi.fn());
const checkLineAccess = vi.hoisted(() => vi.fn());
const isInQuietHours = vi.hoisted(() => vi.fn());
const enforceRateLimit = vi.hoisted(() => vi.fn());
const sendSms = vi.hoisted(() => vi.fn());
const decryptReminderMessage = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());
const leaseAcquisitionsLabels = vi.hoisted(() =>
  vi.fn((..._args: [string, string, string]) => ({ inc: vi.fn() }))
);
const activeLeasesLabels = vi.hoisted(() =>
  vi.fn((..._args: [string]) => ({ set: vi.fn() }))
);
const leaseHoldDurationLabels = vi.hoisted(() =>
  vi.fn((..._args: [string]) => ({ observe: vi.fn() }))
);
const scheduleOutcomesTotalInc = vi.hoisted(() => vi.fn());
const reminderOutcomesTotalInc = vi.hoisted(() => vi.fn());

vi.mock('../../utils/supabase.js', () => ({
  getSupabaseClient: () => ({
    rpc: rpcMock,
    from: fromMock,
  }),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: loggerMock,
}));

vi.mock('../../services/baseline.js', () => ({
  recalculateBaselinesForAllLines,
}));

vi.mock('../../services/persona-analyzer.js', () => ({
  runPersonaAnalyzerForAllLines,
}));

vi.mock('../../utils/env.js', () => ({
  getBackendUrl: () => 'http://localhost:3001',
  getInternalApiSecret: () => 'test-secret',
}));

vi.mock('../../services/line-lookup.js', () => ({
  getLineById,
  checkLineAccess,
  isInQuietHours,
}));

vi.mock('../../services/rate-limiter.js', () => ({
  enforceRateLimit,
}));

vi.mock('../../utils/twilio.js', () => ({
  sendSms,
}));

vi.mock('../../utils/reminder-crypto.js', () => ({
  decryptReminderMessage,
}));

vi.mock('../../utils/metrics.js', () => ({
  activeLeases: { labels: activeLeasesLabels },
  leaseAcquisitions: { labels: leaseAcquisitionsLabels },
  leaseHoldDuration: { labels: leaseHoldDurationLabels },
  scheduleOutcomesTotal: { inc: scheduleOutcomesTotalInc },
  reminderOutcomesTotal: { inc: reminderOutcomesTotalInc },
}));

import { createQueryBuilder, rpcResponses } from '../../__tests__/helpers/supabase-mock.js';
import { __test__ } from '../call-scheduler.js';
import { logger } from '../../utils/logger.js';

const {
  runSchedulerCycle,
  processWithLease,
  processScheduledCalls,
  processSchedule,
  processReminder,
  completeScheduleWithResult,
  releaseReminderClaim,
  handleRecurringReminderSuccess,
  getReminderSmsBody,
  resetState,
  setShuttingDown,
  setIsRunning,
  clearLeaseExistenceCache,
  HEARTBEAT_INTERVAL_MS,
  WORKER_ID,
} = __test__;

function expectLeaseAcquisition(leaseId: string, result: string): void {
  const callIndex = leaseAcquisitionsLabels.mock.calls.findIndex(
    ([id, workerId, status]) => id === leaseId && workerId === WORKER_ID && status === result
  );
  expect(callIndex).toBeGreaterThan(-1);
  const labelResult = leaseAcquisitionsLabels.mock.results[callIndex];
  expect(labelResult?.value?.inc).toHaveBeenCalled();
}

describe('call-scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    rpcMock.mockReset();
    fromMock.mockReset();
    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
    loggerMock.debug.mockReset();
    recalculateBaselinesForAllLines.mockReset();
    runPersonaAnalyzerForAllLines.mockReset();
    getLineById.mockReset();
    checkLineAccess.mockReset();
    isInQuietHours.mockReset();
    fetchMock.mockReset();
    enforceRateLimit.mockReset();
    sendSms.mockReset();
    decryptReminderMessage.mockReset();
    leaseAcquisitionsLabels.mockClear();
    activeLeasesLabels.mockClear();
    leaseHoldDurationLabels.mockClear();
    scheduleOutcomesTotalInc.mockReset();
    reminderOutcomesTotalInc.mockReset();
    resetState();
    clearLeaseExistenceCache();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('LEASE: global lease coordination', () => {
    it('LEASE: held by another worker skips processing', async () => {
      rpcMock.mockResolvedValueOnce(rpcResponses.leaseHeld);
      fromMock.mockReturnValueOnce(
        createQueryBuilder({ data: { id: 'schedules' }, error: null })
      );
      const processor = vi.fn().mockResolvedValue(undefined);

      await processWithLease('schedules', processor);

      expect(processor).not.toHaveBeenCalled();
      expect(rpcMock).toHaveBeenCalledWith(
        'try_acquire_scheduler_lease',
        expect.objectContaining({ p_lease_id: 'schedules' })
      );
      expectLeaseAcquisition('schedules', 'held');
    });

    it('LEASE: heartbeat RPC called during long processing', async () => {
      rpcMock.mockResolvedValueOnce(rpcResponses.leaseAcquired);
      rpcMock.mockResolvedValue({ data: true, error: null });

      let processorResolved = false;
      const slowProcessor = async () => {
        await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS + 5000);
        processorResolved = true;
      };

      await processWithLease('schedules', slowProcessor);

      expect(processorResolved).toBe(true);
      expect(rpcMock).toHaveBeenCalledWith(
        'heartbeat_scheduler_lease',
        expect.objectContaining({ p_lease_id: 'schedules' })
      );
    });

    it('LEASE: release always called in finally block', async () => {
      rpcMock.mockResolvedValueOnce(rpcResponses.leaseAcquired);
      rpcMock.mockResolvedValue({ data: true, error: null });

      await expect(processWithLease('schedules', async () => {
        throw new Error('boom');
      })).rejects.toThrow('boom');

      expect(rpcMock).toHaveBeenCalledWith(
        'release_scheduler_lease',
        expect.objectContaining({ p_lease_id: 'schedules' })
      );
    });

    it('LEASE: RPC error logs and returns early', async () => {
      rpcMock.mockResolvedValueOnce(rpcResponses.error('db error'));
      const processor = vi.fn().mockResolvedValue(undefined);

      await processWithLease('schedules', processor);

      expect(processor).not.toHaveBeenCalled();
      expect(loggerMock.error).toHaveBeenCalled();
      expectLeaseAcquisition('schedules', 'error');
    });

    it('LEASE: missing lease row logs explicit error', async () => {
      rpcMock.mockResolvedValueOnce(rpcResponses.leaseHeld);
      fromMock.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: null })
      );

      await processWithLease('schedules', async () => {});

      expect(loggerMock.error).toHaveBeenCalledWith(
        expect.objectContaining({ leaseId: 'schedules' }),
        expect.stringContaining('Lease row missing')
      );
      expectLeaseAcquisition('schedules', 'missing');
    });

    it('LEASE: existing lease row logs debug for held', async () => {
      rpcMock.mockResolvedValueOnce(rpcResponses.leaseHeld);
      fromMock.mockReturnValueOnce(
        createQueryBuilder({ data: { id: 'schedules' }, error: null })
      );

      await processWithLease('schedules', async () => {});

      expect(loggerMock.debug).toHaveBeenCalledWith(
        expect.objectContaining({ leaseId: 'schedules', workerId: WORKER_ID }),
        expect.stringContaining('Lease held by another worker')
      );
      expectLeaseAcquisition('schedules', 'held');
    });

    it('LEASE: existence check cached after first query', async () => {
      rpcMock.mockResolvedValueOnce(rpcResponses.leaseHeld);
      fromMock.mockReturnValueOnce(
        createQueryBuilder({ data: { id: 'schedules' }, error: null })
      );
      await processWithLease('schedules', async () => {});

      rpcMock.mockResolvedValueOnce(rpcResponses.leaseHeld);
      await processWithLease('schedules', async () => {});

      expect(fromMock).toHaveBeenCalledTimes(1);
    });

    it('LEASE: existence check error logs warning and assumes held', async () => {
      rpcMock.mockResolvedValueOnce(rpcResponses.leaseHeld);
      fromMock.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: new Error('fail') })
      );

      await processWithLease('schedules', async () => {});

      expect(loggerMock.warn).toHaveBeenCalledWith(
        expect.objectContaining({ leaseId: 'schedules' }),
        expect.stringContaining('Lease existence check failed')
      );
      expectLeaseAcquisition('schedules', 'held');
    });
  });

  describe('LEASE: concurrent run guards', () => {
    it('LEASE: concurrent cycle skipped when already running', async () => {
      setIsRunning(true);

      await runSchedulerCycle();

      expect(rpcMock).not.toHaveBeenCalled();
      expect(loggerMock.debug).toHaveBeenCalledWith(
        expect.stringContaining('Scheduler cycle skipped')
      );
    });

    it('LEASE: cycle skipped when shutting down', async () => {
      setShuttingDown(true);

      await runSchedulerCycle();

      expect(rpcMock).not.toHaveBeenCalled();
      expect(loggerMock.debug).toHaveBeenCalledWith(
        expect.stringContaining('Scheduler cycle skipped')
      );
    });
  });

  describe('CLAIM: completion ownership', () => {
    it('CLAIM: completion returns false when claim lost', async () => {
      rpcMock.mockResolvedValueOnce(rpcResponses.completionClaimLost);

      const schedule = {
        id: 'sched-123',
        line_id: 'line-456',
      };

      const result = await completeScheduleWithResult(
        schedule as any,
        'success',
        '2025-01-10T15:00:00.000Z',
        true
      );

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ scheduleId: 'sched-123' }),
        expect.stringContaining('Claim lost')
      );
    });

    it('CLAIM: completion returns true on success', async () => {
      rpcMock.mockResolvedValueOnce(rpcResponses.completionSuccess);

      const schedule = {
        id: 'sched-123',
        line_id: 'line-456',
      };

      const result = await completeScheduleWithResult(
        schedule as any,
        'success',
        '2025-01-10T15:00:00.000Z',
        true
      );

      expect(result).toBe(true);
    });

    it('CLAIM: completion failure prevents side effects for schedules', async () => {
      getLineById.mockResolvedValueOnce({
        line: { id: 'line-456', do_not_call: false, vacation_ranges: [] },
        account: { id: 'acc-789' },
      });
      checkLineAccess.mockResolvedValueOnce({ allowed: true });
      isInQuietHours.mockReturnValueOnce(false);
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessionId: 'sess-123' }),
      });

      rpcMock.mockResolvedValueOnce({ data: false, error: null });

      fromMock.mockImplementation((table: string) => {
        if (table === 'ultaura_schedule_exceptions') {
          return createQueryBuilder({ data: null, error: null });
        }
        return createQueryBuilder({ data: null, error: null });
      });

      const schedule = {
        id: 'sched-123',
        line_id: 'line-456',
        next_run_at: '2025-01-10T14:00:00.000Z',
        days_of_week: [1, 2, 3, 4, 5],
        time_of_day: '09:00',
        timezone: 'America/New_York',
        retry_count: 0,
        retry_policy: { max_retries: 2, retry_window_minutes: 30 },
      };

      await processSchedule(schedule as any);

      const lineUpdateCalls = fromMock.mock.calls.filter(
        ([table]: [string]) => table === 'ultaura_lines'
      );
      expect(lineUpdateCalls).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ scheduleId: 'sched-123' }),
        expect.stringContaining('Claim lost')
      );
    });
  });

  describe('CLAIM: reminder completion', () => {
    it('CLAIM: reminder completion returns false when claim lost', async () => {
      rpcMock.mockResolvedValueOnce(rpcResponses.completionClaimLost);

      const result = await releaseReminderClaim('rem-123');

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ reminderId: 'rem-123' }),
        expect.stringContaining('claim already released')
      );
    });
  });

  describe('CLAIM: reminder guarded updates', () => {
    it('CLAIM: reminder guarded update returns null when claim lost', async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === 'ultaura_reminders') {
          return createQueryBuilder({ data: null, error: null });
        }
        return createQueryBuilder({ data: { id: 'evt-1' }, error: null });
      });

      const reminder = {
        id: 'rem-123',
        account_id: 'acc-456',
        line_id: 'line-789',
        is_recurring: true,
        rrule: 'FREQ=DAILY;INTERVAL=1',
        time_of_day: '09:00',
        timezone: 'America/New_York',
        due_at: '2025-01-10T14:00:00.000Z',
        occurrence_count: 5,
        ends_at: null,
      };

      const updated = await handleRecurringReminderSuccess(
        { rpc: rpcMock, from: fromMock } as any,
        reminder as any,
        'America/New_York'
      );

      expect(updated).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ reminderId: 'rem-123' }),
        expect.stringContaining('claim lost')
      );
      const eventInsertCalls = fromMock.mock.calls.filter(
        ([table]: [string]) => table === 'ultaura_reminder_events'
      );
      expect(eventInsertCalls).toHaveLength(0);
    });

    it('CLAIM: reminder guarded update proceeds when claim held', async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === 'ultaura_reminders') {
          return createQueryBuilder({ data: { id: 'rem-123' }, error: null });
        }
        return createQueryBuilder({ data: { id: 'evt-1' }, error: null });
      });

      const reminder = {
        id: 'rem-123',
        account_id: 'acc-456',
        line_id: 'line-789',
        is_recurring: true,
        rrule: 'FREQ=DAILY;INTERVAL=1',
        time_of_day: '09:00',
        timezone: 'America/New_York',
        due_at: '2025-01-10T14:00:00.000Z',
        occurrence_count: 5,
        ends_at: null,
      };

      const updated = await handleRecurringReminderSuccess(
        { rpc: rpcMock, from: fromMock } as any,
        reminder as any,
        'America/New_York'
      );

      expect(updated).toBe(true);
      const eventInsertCalls = fromMock.mock.calls.filter(
        ([table]: [string]) => table === 'ultaura_reminder_events'
      );
      expect(eventInsertCalls).toHaveLength(1);
    });

    it('CLAIM: recurring reminder advances on guarded success', async () => {
      const reminderBuilder = createQueryBuilder({ data: { id: 'rem-123' }, error: null });
      fromMock.mockImplementation((table: string) => {
        if (table === 'ultaura_reminders') {
          return reminderBuilder;
        }
        return createQueryBuilder({ data: { id: 'evt-1' }, error: null });
      });

      const reminder = {
        id: 'rem-123',
        account_id: 'acc-456',
        line_id: 'line-789',
        is_recurring: true,
        rrule: 'FREQ=DAILY;INTERVAL=1',
        time_of_day: '09:00',
        timezone: 'America/New_York',
        due_at: '2025-01-10T14:00:00.000Z',
        occurrence_count: 5,
        ends_at: null,
      };

      const updated = await handleRecurringReminderSuccess(
        { rpc: rpcMock, from: fromMock } as any,
        reminder as any,
        'America/New_York'
      );

      expect(updated).toBe(true);
      expect(reminderBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ due_at: '2025-01-11T14:00:00.000Z', status: 'scheduled' })
      );
    });
  });

  describe('CLAIM: daily jobs', () => {
    it('CLAIM: empty batch triggers daily jobs when past cutoff', async () => {
      vi.setSystemTime(new Date('2025-01-01T11:30:00.000Z'));
      rpcMock.mockResolvedValueOnce(rpcResponses.emptyArray);

      await processScheduledCalls();

      expect(recalculateBaselinesForAllLines).toHaveBeenCalled();
      expect(runPersonaAnalyzerForAllLines).toHaveBeenCalled();
    });

    it('CLAIM: empty batch skips daily jobs when before cutoff', async () => {
      vi.setSystemTime(new Date('2025-01-01T08:00:00.000Z'));
      rpcMock.mockResolvedValueOnce(rpcResponses.emptyArray);

      await processScheduledCalls();

      expect(recalculateBaselinesForAllLines).not.toHaveBeenCalled();
      expect(runPersonaAnalyzerForAllLines).not.toHaveBeenCalled();
    });
  });

  describe('REMINDERS: sms delivery path', () => {
    function buildReminder(overrides: Record<string, unknown> = {}) {
      return {
        id: 'rem-sms-1',
        account_id: 'acc-1',
        line_id: 'line-1',
        due_at: '2025-01-10T14:00:00.000Z',
        timezone: 'America/New_York',
        is_recurring: false,
        rrule: null,
        interval_days: null,
        days_of_week: null,
        day_of_month: null,
        time_of_day: '09:00',
        ends_at: null,
        occurrence_count: 0,
        message: null,
        message_ciphertext: new Uint8Array([1]),
        message_iv: new Uint8Array([2]),
        message_tag: new Uint8Array([3]),
        message_alg: 'AES-256-GCM',
        message_kid: 'kek_v1',
        delivery_method: 'sms',
        status: 'scheduled',
        privacy_scope: 'line_only',
        created_by_call_session_id: null,
        is_paused: false,
        paused_at: null,
        snoozed_until: null,
        original_due_at: null,
        current_snooze_count: 0,
        last_delivery_status: null,
        processing_claimed_at: null,
        processing_claimed_by: WORKER_ID,
        created_at: '2025-01-10T13:00:00.000Z',
        ...overrides,
      };
    }

    function mockReminderDbSuccess(): void {
      rpcMock.mockResolvedValueOnce(rpcResponses.completionSuccess);
      fromMock.mockImplementation((table: string) => {
        if (table === 'ultaura_reminders') {
          return createQueryBuilder({ data: { id: 'rem-sms-1' }, error: null });
        }
        if (table === 'ultaura_reminder_events') {
          return createQueryBuilder({ data: { id: 'evt-1' }, error: null });
        }
        return createQueryBuilder({ data: null, error: null });
      });
    }

    it('labels successful SMS reminder outcome with method=sms', async () => {
      getLineById.mockResolvedValueOnce({
        line: {
          id: 'line-1',
          phone_e164: '+15551234567',
          do_not_call: true,
          vacation_ranges: [],
          timezone: 'America/New_York',
        },
        account: { id: 'acc-1' },
      });
      enforceRateLimit.mockResolvedValueOnce({ allowed: true });
      decryptReminderMessage.mockResolvedValueOnce('Take your medication');
      sendSms.mockResolvedValueOnce('SM123');
      mockReminderDbSuccess();

      await processReminder(buildReminder() as any);

      expect(enforceRateLimit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'sms', accountId: 'acc-1', phoneNumber: '+15551234567' })
      );
      expect(sendSms).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '+15551234567',
          body: 'Hi there, this is a reminder to Take your medication. - Ultaura',
        })
      );
      expect(checkLineAccess).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(reminderOutcomesTotalInc).toHaveBeenCalledWith({ outcome: 'success', method: 'sms' });
    });

    it('marks SMS reminder missed when rate limited and labels method=sms', async () => {
      getLineById.mockResolvedValueOnce({
        line: {
          id: 'line-1',
          phone_e164: '+15551234567',
          do_not_call: false,
          vacation_ranges: [],
          timezone: 'America/New_York',
        },
        account: { id: 'acc-1' },
      });
      enforceRateLimit.mockResolvedValueOnce({
        allowed: false,
        retryAfter: 60,
        limitType: 'account',
        redisAvailable: true,
      });
      mockReminderDbSuccess();

      await processReminder(buildReminder() as any);

      expect(sendSms).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(reminderOutcomesTotalInc).toHaveBeenCalledWith({
        outcome: 'rate_limited',
        method: 'sms',
      });
      expect(reminderOutcomesTotalInc).not.toHaveBeenCalledWith({ outcome: 'missed', method: 'sms' });
    });

    it('falls back to call on SMS opt-out and labels success with method=call', async () => {
      getLineById.mockResolvedValueOnce({
        line: {
          id: 'line-1',
          phone_e164: '+15551234567',
          do_not_call: false,
          vacation_ranges: [],
          timezone: 'America/New_York',
        },
        account: { id: 'acc-1' },
      });
      enforceRateLimit.mockResolvedValueOnce({ allowed: true });
      decryptReminderMessage.mockResolvedValueOnce('Time for your walk');
      sendSms.mockRejectedValueOnce(new Error('Recipient has opted out of SMS'));
      checkLineAccess.mockResolvedValueOnce({ allowed: true });
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessionId: 'sess-1' }),
      });
      mockReminderDbSuccess();

      await processReminder(buildReminder() as any);

      expect(sendSms).toHaveBeenCalled();
      expect(checkLineAccess).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3001/calls/outbound',
        expect.any(Object)
      );
      expect(reminderOutcomesTotalInc).toHaveBeenCalledWith({ outcome: 'success', method: 'call' });
      expect(reminderOutcomesTotalInc).not.toHaveBeenCalledWith({ outcome: 'success', method: 'sms' });
    });

    it('does not fall back to call on generic SMS send failure and records missed/sms outcome', async () => {
      getLineById.mockResolvedValueOnce({
        line: {
          id: 'line-1',
          phone_e164: '+15551234567',
          do_not_call: false,
          vacation_ranges: [],
          timezone: 'America/New_York',
        },
        account: { id: 'acc-1' },
      });
      enforceRateLimit.mockResolvedValueOnce({ allowed: true });
      decryptReminderMessage.mockResolvedValueOnce('Take vitamins');
      sendSms.mockRejectedValueOnce(new Error('Twilio request failed'));
      mockReminderDbSuccess();

      await processReminder(buildReminder() as any);

      expect(sendSms).toHaveBeenCalled();
      expect(checkLineAccess).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(reminderOutcomesTotalInc).toHaveBeenCalledWith({ outcome: 'missed', method: 'sms' });
      expect(reminderOutcomesTotalInc).not.toHaveBeenCalledWith({ outcome: 'success', method: 'call' });
    });
  });

  describe('REMINDERS: getReminderSmsBody edge cases', () => {
    function buildSmsBodyReminder(overrides: Record<string, unknown> = {}) {
      return {
        id: 'rem-body-1',
        account_id: 'acc-1',
        line_id: 'line-1',
        message: null,
        message_ciphertext: new Uint8Array([1]),
        message_iv: new Uint8Array([2]),
        message_tag: new Uint8Array([3]),
        ...overrides,
      } as any;
    }

    it('throws when decryption fails', async () => {
      decryptReminderMessage.mockRejectedValueOnce(new Error('decrypt failed'));

      await expect(getReminderSmsBody(buildSmsBodyReminder(), 'Pat'))
        .rejects.toThrow('decrypt failed');
    });

    it('falls back to plaintext when decrypted message is whitespace', async () => {
      decryptReminderMessage.mockResolvedValueOnce('   ');

      await expect(getReminderSmsBody(
        buildSmsBodyReminder({ message: '  Call your daughter  ' }),
        ' Pat '
      )).resolves.toBe('Hi Pat, this is a reminder to Call your daughter. - Ultaura');
    });

    it('throws when no decrypted or plaintext reminder message is available', async () => {
      decryptReminderMessage.mockResolvedValueOnce('   ');

      await expect(getReminderSmsBody(
        buildSmsBodyReminder({ message: '   ' }),
        null
      )).rejects.toThrow('No message for SMS reminder');
    });
  });

  describe('CLAIM: batch processing', () => {
    it('CLAIM: stale claim cleared by RPC returns fresh item', async () => {
      rpcMock.mockResolvedValueOnce({
        data: [
          { id: 'sched-1', line_id: 'line-1', next_run_at: '2025-01-10T14:00:00.000Z' },
        ],
        error: null,
      });
      rpcMock.mockResolvedValueOnce(rpcResponses.completionSuccess);
      getLineById.mockResolvedValueOnce(null);

      await processScheduledCalls();

      expect(getLineById).toHaveBeenCalledWith('line-1');
    });
  });

  describe('SCHEDULE EXCEPTIONS: processing branches', () => {
    it('SCHEDULE EXCEPTIONS: future snooze updates next_run_at and skips outbound call', async () => {
      vi.setSystemTime(new Date('2025-01-10T12:00:00.000Z'));
      getLineById.mockResolvedValueOnce({
        line: { id: 'line-456', do_not_call: false, vacation_ranges: [], timezone: 'America/New_York' },
        account: { id: 'acc-789' },
      });
      checkLineAccess.mockResolvedValueOnce({ allowed: true });
      isInQuietHours.mockReturnValueOnce(false);

      fromMock.mockImplementation((table: string) => {
        if (table === 'ultaura_schedule_exceptions') {
          return createQueryBuilder({
            data: { exception_type: 'snooze', new_datetime: '2025-01-10T16:00:00.000Z' },
            error: null,
          });
        }
        if (table === 'ultaura_schedules') {
          return createQueryBuilder({ data: { id: 'sched-123' }, error: null });
        }
        if (table === 'ultaura_lines') {
          return createQueryBuilder({ data: null, error: null });
        }
        return createQueryBuilder({ data: null, error: null });
      });

      const schedule = {
        id: 'sched-123',
        line_id: 'line-456',
        next_run_at: '2025-01-10T14:00:00.000Z',
        days_of_week: [1, 2, 3, 4, 5],
        time_of_day: '09:00',
        timezone: 'America/New_York',
        retry_count: 0,
        retry_policy: { max_retries: 2, retry_window_minutes: 30 },
      };

      await processSchedule(schedule as any);

      expect(fetchMock).not.toHaveBeenCalled();
      const scheduleTableCalls = fromMock.mock.calls.filter(
        ([table]: [string]) => table === 'ultaura_schedules'
      );
      expect(scheduleTableCalls.length).toBeGreaterThan(0);
    });

    it('SCHEDULE EXCEPTIONS: skip/reschedule block call and complete as skipped', async () => {
      getLineById.mockResolvedValueOnce({
        line: { id: 'line-456', do_not_call: false, vacation_ranges: [], timezone: 'America/New_York' },
        account: { id: 'acc-789' },
      });
      checkLineAccess.mockResolvedValueOnce({ allowed: true });
      isInQuietHours.mockReturnValueOnce(false);
      rpcMock.mockResolvedValueOnce(rpcResponses.completionSuccess);

      let exceptionLookupCount = 0;
      fromMock.mockImplementation((table: string) => {
        if (table === 'ultaura_schedule_exceptions') {
          exceptionLookupCount += 1;
          if (exceptionLookupCount === 1) {
            return createQueryBuilder({ data: null, error: null });
          }
          return createQueryBuilder({ data: { exception_type: 'skip' }, error: null });
        }
        if (table === 'ultaura_lines') {
          return createQueryBuilder({ data: null, error: null });
        }
        return createQueryBuilder({ data: null, error: null });
      });

      const schedule = {
        id: 'sched-123',
        line_id: 'line-456',
        next_run_at: '2025-01-10T14:00:00.000Z',
        days_of_week: [1, 2, 3, 4, 5],
        time_of_day: '09:00',
        timezone: 'America/New_York',
        retry_count: 0,
        retry_policy: { max_retries: 2, retry_window_minutes: 30 },
      };

      await processSchedule(schedule as any);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(rpcMock).toHaveBeenCalledWith(
        'complete_schedule_processing',
        expect.objectContaining({
          p_schedule_id: 'sched-123',
          p_result: 'skipped',
        })
      );
    });
  });
});
