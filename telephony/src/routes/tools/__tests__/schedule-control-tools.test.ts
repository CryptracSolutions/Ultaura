import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Router } from 'express';
import { ErrorCodes } from '@ultaura/schemas';

vi.mock('../../../server.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../utils/supabase.js', () => ({
  getSupabaseClient: vi.fn(),
}));

vi.mock('../../../services/call-session.js', () => ({
  getCallSession: vi.fn(),
  incrementToolInvocations: vi.fn(),
  recordCallEvent: vi.fn(),
}));

import { getSupabaseClient } from '../../../utils/supabase.js';
import {
  getCallSession,
  incrementToolInvocations,
  recordCallEvent,
} from '../../../services/call-session.js';
import { skipScheduleRouter } from '../skip-schedule.js';
import { snoozeScheduleRouter } from '../snooze-schedule.js';
import { rescheduleScheduleRouter } from '../reschedule-schedule.js';

type SupabaseResponse = {
  data?: any;
  error?: any;
  count?: number;
};

type SupabaseMock = {
  from: ReturnType<typeof vi.fn>;
};

const SESSION_ID = '11111111-1111-1111-1111-111111111111';
const LINE_ID = '22222222-2222-2222-2222-222222222222';
const SCHEDULE_ID = '33333333-3333-3333-3333-333333333333';

function createBuilder(response: SupabaseResponse) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    not: vi.fn(() => builder),
    order: vi.fn(() => builder),
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

function createSupabaseMock(responses: Record<string, SupabaseResponse[]>): SupabaseMock {
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

function getPostHandler(router: Router) {
  const layer = (router as any).stack.find((stackLayer: any) => (
    stackLayer.route?.path === '/' && stackLayer.route?.methods?.post
  ));
  if (!layer) {
    throw new Error('POST handler not found');
  }
  return layer.route.stack[0].handle;
}

function createMockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload: any) => {
    res.body = payload;
    return res;
  });
  return res;
}

const skipHandler = getPostHandler(skipScheduleRouter);
const snoozeHandler = getPostHandler(snoozeScheduleRouter);
const rescheduleHandler = getPostHandler(rescheduleScheduleRouter);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2030-01-10T15:00:00.000Z'));
  vi.mocked(getCallSession).mockResolvedValue({
    id: SESSION_ID,
    account_id: 'acct-1',
    line_id: LINE_ID,
  } as any);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('schedule control tools hardening', () => {
  it('rejects requests when call session line does not match provided lineId', async () => {
    vi.mocked(getCallSession).mockResolvedValueOnce({
      id: SESSION_ID,
      account_id: 'acct-1',
      line_id: 'different-line-id',
    } as any);
    vi.mocked(getSupabaseClient).mockReturnValue(createSupabaseMock({}) as any);

    const res = createMockRes();
    await skipHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, scheduleId: SCHEDULE_ID },
    } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(ErrorCodes.UNAUTHORIZED);
    expect(String(res.body.message)).toContain('not authorized');
    expect(recordCallEvent).toHaveBeenCalledWith(
      SESSION_ID,
      'tool_call',
      expect.objectContaining({ tool: 'skip_schedule', success: false, errorCode: 'sts_line_mismatch' }),
      expect.any(Object)
    );
  });

  it('rejects requests when fetched schedule does not belong to provided lineId', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{
        data: { account_id: 'acct-1', allow_voice_schedule_control: true, timezone: 'America/New_York' },
        error: null,
      }],
      ultaura_schedules: [{
        data: {
          id: SCHEDULE_ID,
          line_id: 'different-line-id',
          account_id: 'acct-1',
          next_run_at: '2030-01-12T14:00:00.000Z',
          time_of_day: '09:00:00',
          timezone: 'America/New_York',
          days_of_week: [1, 2, 3, 4, 5],
        },
        error: null,
      }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await snoozeHandler({
      body: {
        callSessionId: SESSION_ID,
        lineId: LINE_ID,
        scheduleId: SCHEDULE_ID,
        snoozeMinutes: 30,
      },
    } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(ErrorCodes.UNAUTHORIZED);
    expect(String(res.body.message)).toContain('not authorized');
    expect(recordCallEvent).toHaveBeenCalledWith(
      SESSION_ID,
      'tool_call',
      expect.objectContaining({ tool: 'snooze_schedule', success: false, errorCode: 'sts_schedule_line_mismatch' }),
      expect.any(Object)
    );
  });

  it('maps skip_schedule scope integrity violations to DATABASE_ERROR', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{
        data: { account_id: 'acct-1', allow_voice_schedule_control: true, timezone: 'America/New_York' },
        error: null,
      }],
      ultaura_schedules: [{
        data: {
          id: SCHEDULE_ID,
          line_id: LINE_ID,
          account_id: 'acct-1',
          next_run_at: '2030-01-12T14:00:00.000Z',
          time_of_day: '09:00:00',
          timezone: 'America/New_York',
          days_of_week: [1, 2, 3, 4, 5],
        },
        error: null,
      }],
      ultaura_schedule_exceptions: [{
        data: null,
        error: { code: '23514', message: 'Invalid schedule exception scope' },
      }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await skipHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, scheduleId: SCHEDULE_ID },
    } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(ErrorCodes.DATABASE_ERROR);
    expect(recordCallEvent).toHaveBeenCalledWith(
      SESSION_ID,
      'tool_call',
      expect.objectContaining({ tool: 'skip_schedule', success: false, errorCode: '23514' }),
      expect.any(Object)
    );
    expect(incrementToolInvocations).not.toHaveBeenCalled();
  });

  it('maps snooze_schedule scope integrity violations to DATABASE_ERROR', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{
        data: { account_id: 'acct-1', allow_voice_schedule_control: true, timezone: 'America/New_York' },
        error: null,
      }],
      ultaura_schedules: [{
        data: {
          id: SCHEDULE_ID,
          line_id: LINE_ID,
          account_id: 'acct-1',
          next_run_at: '2030-01-12T14:00:00.000Z',
          time_of_day: '09:00:00',
          timezone: 'America/New_York',
          days_of_week: [1, 2, 3, 4, 5],
        },
        error: null,
      }],
      ultaura_schedule_exceptions: [{
        data: null,
        error: { code: '23514', message: 'Invalid schedule exception scope' },
      }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await snoozeHandler({
      body: {
        callSessionId: SESSION_ID,
        lineId: LINE_ID,
        scheduleId: SCHEDULE_ID,
        snoozeMinutes: 30,
      },
    } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(ErrorCodes.DATABASE_ERROR);
    expect(recordCallEvent).toHaveBeenCalledWith(
      SESSION_ID,
      'tool_call',
      expect.objectContaining({ tool: 'snooze_schedule', success: false, errorCode: '23514' }),
      expect.any(Object)
    );
    expect(incrementToolInvocations).not.toHaveBeenCalled();
  });

  it('maps reschedule_schedule scope integrity violations to DATABASE_ERROR and cleans up one-time schedule', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{
        data: { account_id: 'acct-1', allow_voice_schedule_control: true, timezone: 'America/New_York' },
        error: null,
      }],
      ultaura_schedules: [
        {
          data: {
            id: SCHEDULE_ID,
            line_id: LINE_ID,
            account_id: 'acct-1',
            next_run_at: '2030-01-12T14:00:00.000Z',
            time_of_day: '09:00:00',
            timezone: 'America/New_York',
            days_of_week: [1, 2, 3, 4, 5],
            retry_policy: { max_retries: 2, retry_window_minutes: 30 },
          },
          error: null,
        },
        {
          data: { id: '44444444-4444-4444-4444-444444444444' },
          error: null,
        },
        { data: null, error: null },
      ],
      ultaura_schedule_exceptions: [{
        data: null,
        error: { code: '23514', message: 'Invalid schedule exception scope' },
      }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await rescheduleHandler({
      body: {
        callSessionId: SESSION_ID,
        lineId: LINE_ID,
        scheduleId: SCHEDULE_ID,
        newDatetime: '2030-01-13T10:00:00',
      },
    } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(ErrorCodes.DATABASE_ERROR);
    expect(recordCallEvent).toHaveBeenCalledWith(
      SESSION_ID,
      'tool_call',
      expect.objectContaining({ tool: 'reschedule_schedule', success: false, errorCode: '23514' }),
      expect.any(Object)
    );

    const scheduleTableCalls = supabaseMock.from.mock.calls.filter(
      (args: any[]) => args[0] === 'ultaura_schedules'
    );
    expect(scheduleTableCalls.length).toBeGreaterThanOrEqual(3);
    expect(incrementToolInvocations).not.toHaveBeenCalled();
  });
});
