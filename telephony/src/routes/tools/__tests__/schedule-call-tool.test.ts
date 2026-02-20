import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock('../../../services/call-session.js', () => ({
  getCallSession: vi.fn(),
  incrementToolInvocations: vi.fn(),
  recordCallEvent: vi.fn(),
}));
vi.mock('../../../services/line-lookup.js', () => ({
  getLineById: vi.fn(),
}));
vi.mock('../../../utils/supabase.js', () => ({
  getSupabaseClient: vi.fn(),
}));
vi.mock('../../../utils/timezone.js', () => ({
  getNextOccurrence: vi.fn(() => new Date('2030-01-06T14:00:00.000Z')),
  validateTimezone: vi.fn(),
}));

import { scheduleCallRouter } from '../schedule-call.js';
import { getCallSession, incrementToolInvocations } from '../../../services/call-session.js';
import { getLineById } from '../../../services/line-lookup.js';
import { getSupabaseClient } from '../../../utils/supabase.js';
import { createMockRes, getPostHandler, createSupabaseMock } from './helpers/index.js';

const SESSION_ID = '11111111-1111-1111-1111-111111111111';
const LINE_ID = '22222222-2222-2222-2222-222222222222';
const SCHEDULE_ID = '55555555-5555-5555-5555-555555555555';

const scheduleHandler = getPostHandler(scheduleCallRouter);

const baseSession = {
  id: SESSION_ID,
  account_id: 'acct-1',
  line_id: LINE_ID,
  status: 'in_progress',
};

const baseLine = {
  id: LINE_ID,
  account_id: 'acct-1',
  timezone: 'America/New_York',
  allow_voice_schedule_control: true,
  do_not_call: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCallSession).mockResolvedValue(baseSession as any);
  vi.mocked(getLineById).mockResolvedValue({ line: baseLine, account: { id: 'acct-1' } } as any);
});

describe('schedule_call', () => {
  it('update_recurring happy path: creates schedule and logs event', async () => {
    const supabaseMock = createSupabaseMock({
      // No existing schedule
      ultaura_schedules: [
        { data: null, error: { code: 'PGRST116', message: 'No rows found' } }, // existing query
        { data: { id: SCHEDULE_ID }, error: null }, // insert
      ],
      ultaura_schedule_events: [{ data: null, error: null }],
      ultaura_lines: [{ data: null, error: null }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await scheduleHandler({
      body: {
        callSessionId: SESSION_ID, lineId: LINE_ID,
        mode: 'update_recurring',
        daysOfWeek: [1, 3, 5],
        timeLocal: '09:00',
        timezone: 'America/New_York',
      },
    } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.scheduleId).toBeDefined();
    expect(incrementToolInvocations).toHaveBeenCalledWith(SESSION_ID);
  });

  it('rejects one_off mode with 400 redirect to set_reminder', async () => {
    const res = createMockRes();
    await scheduleHandler({
      body: {
        callSessionId: SESSION_ID, lineId: LINE_ID,
        mode: 'one_off',
        timeLocal: '09:00',
      },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toContain('set_reminder');
  });

  it('rejects invalid time format', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_schedules: [{ data: null, error: null }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await scheduleHandler({
      body: {
        callSessionId: SESSION_ID, lineId: LINE_ID,
        mode: 'update_recurring',
        daysOfWeek: [1, 3],
        timeLocal: '9am', // invalid format
        timezone: 'America/New_York',
      },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toContain('Invalid time format');
  });

  it('rejects empty daysOfWeek array', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_schedules: [{ data: null, error: null }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await scheduleHandler({
      body: {
        callSessionId: SESSION_ID, lineId: LINE_ID,
        mode: 'update_recurring',
        daysOfWeek: [],
        timeLocal: '09:00',
        timezone: 'America/New_York',
      },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns success:false when voice schedule control is disabled', async () => {
    vi.mocked(getLineById).mockResolvedValue({
      line: { ...baseLine, allow_voice_schedule_control: false },
      account: { id: 'acct-1' },
    } as any);

    const res = createMockRes();
    await scheduleHandler({
      body: {
        callSessionId: SESSION_ID, lineId: LINE_ID,
        mode: 'update_recurring',
        daysOfWeek: [1],
        timeLocal: '09:00',
        timezone: 'America/New_York',
      },
    } as any, res);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('disabled schedule changes by phone');
  });

  it('returns 400 for do_not_call line', async () => {
    vi.mocked(getLineById).mockResolvedValue({
      line: { ...baseLine, do_not_call: true },
      account: { id: 'acct-1' },
    } as any);

    const res = createMockRes();
    await scheduleHandler({
      body: {
        callSessionId: SESSION_ID, lineId: LINE_ID,
        mode: 'update_recurring',
        daysOfWeek: [1],
        timeLocal: '09:00',
        timezone: 'America/New_York',
      },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toContain('opted out');
  });

  it('returns 400 on timezone validation failure', async () => {
    const { validateTimezone } = await import('../../../utils/timezone.js');
    vi.mocked(validateTimezone).mockImplementationOnce(() => {
      throw new Error('Invalid timezone: BadZone');
    });
    vi.mocked(getSupabaseClient).mockReturnValue(createSupabaseMock({}) as any);

    const res = createMockRes();
    await scheduleHandler({
      body: {
        callSessionId: SESSION_ID, lineId: LINE_ID,
        mode: 'update_recurring',
        daysOfWeek: [1],
        timeLocal: '09:00',
        timezone: 'BadZone',
      },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toContain('Invalid timezone');
  });

  it('returns 404 when line is not found', async () => {
    vi.mocked(getLineById).mockResolvedValue(null as any);

    const res = createMockRes();
    await scheduleHandler({
      body: {
        callSessionId: SESSION_ID, lineId: LINE_ID,
        mode: 'update_recurring',
        daysOfWeek: [1],
        timeLocal: '09:00',
        timezone: 'America/New_York',
      },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body.error).toContain('Line not found');
  });

  it('returns 404 when session is not found', async () => {
    vi.mocked(getCallSession).mockResolvedValue(null as any);

    const res = createMockRes();
    await scheduleHandler({
      body: {
        callSessionId: SESSION_ID, lineId: LINE_ID,
        mode: 'update_recurring',
        daysOfWeek: [1],
        timeLocal: '09:00',
        timezone: 'America/New_York',
      },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body.error).toContain('session not found');
  });

  it('returns 500 on DB error during schedule update', async () => {
    const existingSchedule = {
      id: SCHEDULE_ID,
      days_of_week: [1, 2, 3],
      time_of_day: '08:00',
      timezone: 'America/New_York',
    };
    const supabaseMock = createSupabaseMock({
      ultaura_schedules: [
        { data: existingSchedule, error: null }, // existing
        { data: null, error: { code: '23514', message: 'DB constraint' } }, // update fails
      ],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await scheduleHandler({
      body: {
        callSessionId: SESSION_ID, lineId: LINE_ID,
        mode: 'update_recurring',
        daysOfWeek: [1, 3, 5],
        timeLocal: '09:00',
        timezone: 'America/New_York',
      },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body.error).toContain('Failed to update schedule');
  });
});
