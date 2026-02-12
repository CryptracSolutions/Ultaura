import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCodes } from '@ultaura/schemas';

const revalidatePathMock = vi.hoisted(() => vi.fn());
const getSupabaseServerComponentClientMock = vi.hoisted(() => vi.fn());
const getLineMock = vi.hoisted(() => vi.fn());
const getUltauraAccountByIdMock = vi.hoisted(() => vi.fn());
const logScheduleEventMock = vi.hoisted(() => vi.fn());
const getNextOccurrenceMock = vi.hoisted(() => vi.fn());
const localToUtcMock = vi.hoisted(() => vi.fn());

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock('~/core/supabase/server-component-client', () => ({
  default: getSupabaseServerComponentClientMock,
}));

vi.mock('~/core/logger', () => ({
  default: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('../lines', () => ({
  getLine: getLineMock,
}));

vi.mock('../helpers', () => ({
  getUltauraAccountById: getUltauraAccountByIdMock,
  withTrialCheck: (fn: any) => fn,
}));

vi.mock('../schedule-events', () => ({
  logScheduleEvent: logScheduleEventMock,
}));

vi.mock('../timezone', () => ({
  getNextOccurrence: getNextOccurrenceMock,
  localToUtc: localToUtcMock,
}));

import {
  createScheduleException,
  deleteScheduleException,
  getUpcomingExceptions,
} from '../schedule-exceptions';

type SupabaseResponse = { data?: any; error?: any };
type TableResponses = Record<string, SupabaseResponse[]>;

function createBuilder(response: SupabaseResponse) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    not: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => response),
    maybeSingle: vi.fn(async () => response),
  };
  builder.then = (resolve: (value: any) => any, reject: (reason: any) => any) => (
    Promise.resolve(response).then(resolve, reject)
  );
  return builder;
}

function createSupabaseMock(responses: TableResponses) {
  const counters = new Map<string, number>();
  return {
    from: vi.fn((table: string) => {
      const count = counters.get(table) ?? 0;
      counters.set(table, count + 1);
      const response = responses[table]?.[count] ?? { data: null, error: null };
      return createBuilder(response);
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('schedule-exceptions action hardening', () => {
  it('returns DATABASE_ERROR when schedule exception insert fails integrity trigger', async () => {
    const schedule = {
      id: '33333333-3333-3333-3333-333333333333',
      account_id: '11111111-1111-1111-1111-111111111111',
      line_id: '22222222-2222-2222-2222-222222222222',
      time_of_day: '09:00:00',
      days_of_week: [1, 2, 3, 4, 5],
      timezone: 'America/New_York',
      next_run_at: '2030-01-16T14:00:00.000Z',
      retry_policy: { max_retries: 2, retry_window_minutes: 30 },
      enabled: true,
      is_one_time: false,
    };

    const supabase = createSupabaseMock({
      ultaura_schedules: [
        { data: schedule, error: null },
        { data: schedule, error: null },
      ],
      ultaura_schedule_exceptions: [
        { data: null, error: null },
        { data: null, error: { code: '23514', message: 'Invalid schedule exception scope' } },
      ],
    });
    getSupabaseServerComponentClientMock.mockReturnValue(supabase as any);
    getLineMock.mockResolvedValue({
      id: '22222222-2222-2222-2222-222222222222',
      short_id: 'line-1',
      account_id: '11111111-1111-1111-1111-111111111111',
      timezone: 'America/New_York',
    });
    getUltauraAccountByIdMock.mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      status: 'active',
    });

    const result = await createScheduleException({
      scheduleId: '33333333-3333-3333-3333-333333333333',
      exceptionDate: '2030-01-17',
      exceptionType: 'skip',
    }, 'line-1');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCodes.DATABASE_ERROR);
    }
    expect(logScheduleEventMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('returns empty array for getUpcomingExceptions when lookup fails', async () => {
    const supabase = createSupabaseMock({
      ultaura_schedule_exceptions: [
        { data: null, error: { code: '57014', message: 'canceling statement due to timeout' } },
      ],
    });
    getSupabaseServerComponentClientMock.mockReturnValue(supabase as any);
    getLineMock.mockResolvedValue({
      id: 'line-1',
      account_id: 'acct-1',
      timezone: 'America/New_York',
    });

    const upcoming = await getUpcomingExceptions('line-1');
    expect(upcoming).toEqual([]);
  });

  it('restores next_run_at for future snooze exception removals', async () => {
    const snoozedAt = '2030-01-17T16:00:00.000Z';
    const restoredAt = '2030-01-17T14:00:00.000Z';
    localToUtcMock.mockReturnValueOnce(new Date(restoredAt));

    const exceptionRow = {
      id: 'exc-1',
      account_id: 'acct-1',
      schedule_id: 'sched-1',
      line_id: 'line-1',
      exception_date: '2030-01-17',
      exception_type: 'snooze',
      new_datetime: snoozedAt,
      reschedule_schedule_id: null,
      metadata: { original_time_of_day: '09:00' },
    };

    const supabase = createSupabaseMock({
      ultaura_schedule_exceptions: [
        { data: { account_id: 'acct-1' }, error: null },
        { data: exceptionRow, error: null },
        { data: null, error: null },
      ],
      ultaura_schedules: [
        {
          data: {
            id: 'sched-1',
            account_id: 'acct-1',
            line_id: 'line-1',
            time_of_day: '09:00:00',
            days_of_week: [1, 2, 3, 4, 5],
            timezone: 'America/New_York',
            next_run_at: snoozedAt,
            retry_policy: { max_retries: 2, retry_window_minutes: 30 },
            enabled: true,
            is_one_time: false,
          },
          error: null,
        },
        { data: null, error: null },
        { data: { next_run_at: restoredAt }, error: null },
      ],
      ultaura_lines: [{ data: null, error: null }],
    });
    getSupabaseServerComponentClientMock.mockReturnValue(supabase as any);
    getLineMock.mockResolvedValue({
      id: 'line-1',
      account_id: 'acct-1',
      short_id: 'line-short',
      timezone: 'America/New_York',
    });
    getUltauraAccountByIdMock.mockResolvedValue({ id: 'acct-1', status: 'active' });

    const result = await deleteScheduleException('exc-1', 'line-short');

    expect(result.success).toBe(true);
    expect(logScheduleEventMock).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'exception_removed',
      metadata: expect.objectContaining({
        restored_next_run_at: restoredAt,
      }),
    }));
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/calls', 'page');
  });
});
