import { beforeEach, describe, expect, it, vi } from 'vitest';
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
vi.mock('../../../utils/reminder-crypto.js', () => ({
  encryptReminderMessage: vi.fn(),
}));

import { listRemindersRouter } from '../list-reminders.js';
import { setReminderRouter } from '../set-reminder.js';
import { editReminderRouter } from '../edit-reminder.js';
import { getCallSession } from '../../../services/call-session.js';
import { getLineById } from '../../../services/line-lookup.js';
import { getSupabaseClient } from '../../../utils/supabase.js';
import { encryptReminderMessage } from '../../../utils/reminder-crypto.js';

type SupabaseResponse = {
  data?: any;
  error?: any;
  count?: number;
};

type SupabaseMock = {
  from: any;
  rpc: any;
};

const SESSION_ID = '11111111-1111-1111-1111-111111111111';
const LINE_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_LINE_ID = '33333333-3333-3333-3333-333333333333';
const REMINDER_ID = '44444444-4444-4444-4444-444444444444';
const MOCK_ENCRYPTED_MESSAGE = {
  ciphertext: Buffer.from('cipher'),
  iv: Buffer.from('iv'),
  tag: Buffer.from('tag'),
  alg: 'AES-256-GCM',
  kid: 'kek_v1',
};

function createBuilder(response: SupabaseResponse) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    single: vi.fn(async () => response),
  };
  builder.then = (resolve: (value: any) => any, reject: (reason: any) => any) => (
    Promise.resolve(response).then(resolve, reject)
  );
  return builder;
}

function createSupabaseMock(
  responses: Record<string, SupabaseResponse[]>,
  rpcResponses: Record<string, SupabaseResponse[]> = {}
): SupabaseMock {
  const counters = new Map<string, number>();
  const rpcCounters = new Map<string, number>();

  return {
    from: vi.fn((table: string) => {
      const count = counters.get(table) ?? 0;
      counters.set(table, count + 1);
      const response = responses[table]?.[count] ?? { data: null, error: null };
      return createBuilder(response);
    }),
    rpc: vi.fn(async (fnName: string) => {
      const count = rpcCounters.get(fnName) ?? 0;
      rpcCounters.set(fnName, count + 1);
      return rpcResponses[fnName]?.[count] ?? { data: null, error: null };
    }),
  };
}

function getPostHandler(router: Router, path = '/') {
  const layer = (router as any).stack.find((stackLayer: any) => (
    stackLayer.route?.path === path && stackLayer.route?.methods?.post
  ));
  if (!layer) {
    throw new Error(`POST handler not found for ${path}`);
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

const listHandler = getPostHandler(listRemindersRouter);
const setHandler = getPostHandler(setReminderRouter);
const editHandler = getPostHandler(editReminderRouter);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reminder tool guards', () => {
  it('rejects list_reminders when lineId mismatches session', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{
        data: { allow_voice_reminder_control: true, display_name: 'Test', timezone: 'America/New_York' },
        error: null,
      }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID,
      account_id: 'acct-1',
      line_id: LINE_ID,
    } as any);

    const res = createMockRes();

    await listHandler({
      body: { callSessionId: SESSION_ID, lineId: OTHER_LINE_ID },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('blocks list_reminders when voice control is disabled', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{
        data: { allow_voice_reminder_control: false, display_name: 'Test', timezone: 'America/New_York' },
        error: null,
      }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID,
      account_id: 'acct-1',
      line_id: LINE_ID,
    } as any);

    const res = createMockRes();

    await listHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID },
    } as any, res);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('disabled reminder management by phone');
  });

  it('blocks set_reminder when voice control is disabled', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID,
      account_id: 'acct-1',
      line_id: LINE_ID,
      status: 'in_progress',
    } as any);
    vi.mocked(getLineById).mockResolvedValue({
      line: {
        id: LINE_ID,
        account_id: 'acct-1',
        timezone: 'America/New_York',
        allow_voice_reminder_control: false,
      },
      account: { id: 'acct-1' },
    } as any);

    const res = createMockRes();

    await setHandler({
      body: {
        callSessionId: SESSION_ID,
        lineId: LINE_ID,
        dueAtLocal: '2030-01-02T09:00:00',
        timezone: 'America/New_York',
        message: 'Take medication',
      },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('disabled reminder management by phone');
  });

  it('rejects set_reminder when lineId mismatches session', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID,
      account_id: 'acct-1',
      line_id: LINE_ID,
      status: 'in_progress',
    } as any);

    const res = createMockRes();

    await setHandler({
      body: {
        callSessionId: SESSION_ID,
        lineId: OTHER_LINE_ID,
        dueAtLocal: '2030-01-02T09:00:00',
        timezone: 'America/New_York',
        message: 'Take medication',
      },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('rejects set_reminder when call session is not in_progress', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID,
      account_id: 'acct-1',
      line_id: LINE_ID,
      status: 'completed',
    } as any);

    const res = createMockRes();

    await setHandler({
      body: {
        callSessionId: SESSION_ID,
        lineId: LINE_ID,
        dueAtLocal: '2030-01-02T09:00:00',
        timezone: 'America/New_York',
        message: 'Take medication',
      },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(ErrorCodes.FORBIDDEN);
    expect(res.body.message).toContain('in progress');
  });
});

describe('set_reminder reminder limit handling', () => {
  it('returns 429 with structured metadata when session cap is reached', async () => {
    const supabaseMock = createSupabaseMock({}, {
      create_ultaura_call_reminder: [{
        data: {
          success: false,
          block_reason: 'session_cap',
          message: 'Session reminder limit reached for this call.',
          current_count: 2,
          limit: 2,
          remaining_allowance: 0,
          next_action: {
            reason: 'session_cap',
            guidance: 'You can set more reminders in your next call.',
          },
        },
        error: null,
      }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID,
      account_id: 'acct-1',
      line_id: LINE_ID,
      status: 'in_progress',
    } as any);
    vi.mocked(getLineById).mockResolvedValue({
      line: {
        id: LINE_ID,
        account_id: 'acct-1',
        timezone: 'America/New_York',
        allow_voice_reminder_control: true,
      },
      account: { id: 'acct-1' },
    } as any);
    vi.mocked(encryptReminderMessage).mockResolvedValue(MOCK_ENCRYPTED_MESSAGE);

    const res = createMockRes();

    await setHandler({
      body: {
        callSessionId: SESSION_ID,
        lineId: LINE_ID,
        dueAtLocal: '2030-01-02T09:00:00',
        timezone: 'America/New_York',
        message: 'Take medication',
      },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(ErrorCodes.REMINDER_LIMIT_REACHED);
    expect(res.body.message).toBe('Session reminder limit reached for this call.');
    expect(res.body.current_count).toBe(2);
    expect(res.body.limit).toBe(2);
    expect(res.body.remaining_allowance).toBe(0);
    expect(res.body.next_action).toEqual({
      reason: 'session_cap',
      guidance: 'You can set more reminders in your next call.',
    });
  });

  it('returns 403 with structured metadata when line cap is reached', async () => {
    const supabaseMock = createSupabaseMock({}, {
      create_ultaura_call_reminder: [{
        data: {
          success: false,
          block_reason: 'line_cap',
          message: "You've reached the reminder limit for this line.",
          current_count: 20,
          limit: 20,
          remaining_allowance: 0,
          next_action: {
            reason: 'line_cap',
            guidance: 'Ask your caregiver to cancel existing reminders or upgrade the plan.',
          },
        },
        error: null,
      }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID,
      account_id: 'acct-1',
      line_id: LINE_ID,
      status: 'in_progress',
    } as any);
    vi.mocked(getLineById).mockResolvedValue({
      line: {
        id: LINE_ID,
        account_id: 'acct-1',
        timezone: 'America/New_York',
        allow_voice_reminder_control: true,
      },
      account: { id: 'acct-1' },
    } as any);
    vi.mocked(encryptReminderMessage).mockResolvedValue(MOCK_ENCRYPTED_MESSAGE);

    const res = createMockRes();

    await setHandler({
      body: {
        callSessionId: SESSION_ID,
        lineId: LINE_ID,
        dueAtLocal: '2030-01-02T09:00:00',
        timezone: 'America/New_York',
        message: 'Take medication',
      },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(ErrorCodes.REMINDER_LIMIT_REACHED);
    expect(res.body.message).toBe("You've reached the reminder limit for this line.");
    expect(res.body.current_count).toBe(20);
    expect(res.body.limit).toBe(20);
    expect(res.body.remaining_allowance).toBe(0);
    expect(res.body.next_action).toEqual({
      reason: 'line_cap',
      guidance: 'Ask your caregiver to cancel existing reminders or upgrade the plan.',
    });
  });
});

describe('set_reminder additional cases', () => {
  it('creates a recurring daily RRULE reminder', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));

    const supabaseMock = createSupabaseMock({}, {
      create_ultaura_call_reminder: [{
        data: { success: true, reminder_id: REMINDER_ID, due_at: '2030-01-02T14:00:00.000Z' },
        error: null,
      }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID, account_id: 'acct-1', line_id: LINE_ID, status: 'in_progress',
    } as any);
    vi.mocked(getLineById).mockResolvedValue({
      line: { id: LINE_ID, account_id: 'acct-1', timezone: 'America/New_York', allow_voice_reminder_control: true },
      account: { id: 'acct-1' },
    } as any);
    vi.mocked(encryptReminderMessage).mockResolvedValue(MOCK_ENCRYPTED_MESSAGE);

    const res = createMockRes();
    await setHandler({
      body: {
        callSessionId: SESSION_ID, lineId: LINE_ID,
        dueAtLocal: '2030-01-02T09:00:00', timezone: 'America/New_York',
        message: 'Take medication', isRecurring: true, frequency: 'daily',
      },
    } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.rrule).toContain('FREQ=DAILY');
    expect(res.body.isRecurring).toBe(true);
    vi.useRealTimers();
  });

  it('creates a recurring weekly RRULE reminder with daysOfWeek', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));

    const supabaseMock = createSupabaseMock({}, {
      create_ultaura_call_reminder: [{
        data: { success: true, reminder_id: REMINDER_ID, due_at: '2030-01-06T14:00:00.000Z' },
        error: null,
      }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID, account_id: 'acct-1', line_id: LINE_ID, status: 'in_progress',
    } as any);
    vi.mocked(getLineById).mockResolvedValue({
      line: { id: LINE_ID, account_id: 'acct-1', timezone: 'America/New_York', allow_voice_reminder_control: true },
      account: { id: 'acct-1' },
    } as any);
    vi.mocked(encryptReminderMessage).mockResolvedValue(MOCK_ENCRYPTED_MESSAGE);

    const res = createMockRes();
    await setHandler({
      body: {
        callSessionId: SESSION_ID, lineId: LINE_ID,
        dueAtLocal: '2030-01-06T09:00:00', timezone: 'America/New_York',
        message: 'Weekly check', isRecurring: true, frequency: 'weekly', daysOfWeek: [1, 3, 5],
      },
    } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.rrule).toContain('FREQ=WEEKLY');
    expect(res.body.rrule).toContain('BYDAY=MO,WE,FR');
    vi.useRealTimers();
  });

  it('creates a recurring monthly RRULE reminder with dayOfMonth', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));

    const supabaseMock = createSupabaseMock({}, {
      create_ultaura_call_reminder: [{
        data: { success: true, reminder_id: REMINDER_ID, due_at: '2030-01-15T14:00:00.000Z' },
        error: null,
      }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID, account_id: 'acct-1', line_id: LINE_ID, status: 'in_progress',
    } as any);
    vi.mocked(getLineById).mockResolvedValue({
      line: { id: LINE_ID, account_id: 'acct-1', timezone: 'America/New_York', allow_voice_reminder_control: true },
      account: { id: 'acct-1' },
    } as any);
    vi.mocked(encryptReminderMessage).mockResolvedValue(MOCK_ENCRYPTED_MESSAGE);

    const res = createMockRes();
    await setHandler({
      body: {
        callSessionId: SESSION_ID, lineId: LINE_ID,
        dueAtLocal: '2030-01-15T09:00:00', timezone: 'America/New_York',
        message: 'Monthly billing', isRecurring: true, frequency: 'monthly', dayOfMonth: 15,
      },
    } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.rrule).toContain('FREQ=MONTHLY');
    expect(res.body.rrule).toContain('BYMONTHDAY=15');
    vi.useRealTimers();
  });

  it('calls encryptReminderMessage with correct arguments', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));

    const supabaseMock = createSupabaseMock({}, {
      create_ultaura_call_reminder: [{
        data: { success: true, reminder_id: REMINDER_ID, due_at: '2030-01-02T14:00:00.000Z' },
        error: null,
      }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID, account_id: 'acct-1', line_id: LINE_ID, status: 'in_progress',
    } as any);
    vi.mocked(getLineById).mockResolvedValue({
      line: { id: LINE_ID, account_id: 'acct-1', timezone: 'America/New_York', allow_voice_reminder_control: true },
      account: { id: 'acct-1' },
    } as any);
    vi.mocked(encryptReminderMessage).mockResolvedValue(MOCK_ENCRYPTED_MESSAGE);

    const res = createMockRes();
    await setHandler({
      body: {
        callSessionId: SESSION_ID, lineId: LINE_ID,
        dueAtLocal: '2030-01-02T09:00:00', timezone: 'America/New_York',
        message: 'Take your pill',
      },
    } as any, res);

    expect(encryptReminderMessage).toHaveBeenCalledWith(
      'acct-1',
      LINE_ID,
      expect.any(String),
      'Take your pill'
    );
    vi.useRealTimers();
  });

  it('rejects set_reminder when dueAtLocal is in the past', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-06-01T12:00:00.000Z'));

    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID, account_id: 'acct-1', line_id: LINE_ID, status: 'in_progress',
    } as any);
    vi.mocked(getLineById).mockResolvedValue({
      line: { id: LINE_ID, account_id: 'acct-1', timezone: 'America/New_York', allow_voice_reminder_control: true },
      account: { id: 'acct-1' },
    } as any);
    vi.mocked(encryptReminderMessage).mockResolvedValue(MOCK_ENCRYPTED_MESSAGE);

    const res = createMockRes();
    await setHandler({
      body: {
        callSessionId: SESSION_ID, lineId: LINE_ID,
        dueAtLocal: '2030-01-01T09:00:00', timezone: 'America/New_York',
        message: 'Old reminder',
      },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toContain('past');
    vi.useRealTimers();
  });

  it('rejects set_reminder when dueAtLocal is within 5-minute buffer', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-02T13:58:00.000Z')); // 2 min before

    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID, account_id: 'acct-1', line_id: LINE_ID, status: 'in_progress',
    } as any);
    vi.mocked(getLineById).mockResolvedValue({
      line: { id: LINE_ID, account_id: 'acct-1', timezone: 'America/New_York', allow_voice_reminder_control: true },
      account: { id: 'acct-1' },
    } as any);
    vi.mocked(encryptReminderMessage).mockResolvedValue(MOCK_ENCRYPTED_MESSAGE);

    const res = createMockRes();
    await setHandler({
      body: {
        callSessionId: SESSION_ID, lineId: LINE_ID,
        dueAtLocal: '2030-01-02T09:00:00', timezone: 'America/New_York', // 9am ET = 14:00 UTC, but 2 min away
        message: 'Too soon',
      },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toContain('5 minutes');
    vi.useRealTimers();
  });

  it('defaults message to Check-in call when no message provided', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));

    const supabaseMock = createSupabaseMock({}, {
      create_ultaura_call_reminder: [{
        data: { success: true, reminder_id: REMINDER_ID, due_at: '2030-01-02T14:00:00.000Z' },
        error: null,
      }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID, account_id: 'acct-1', line_id: LINE_ID, status: 'in_progress',
    } as any);
    vi.mocked(getLineById).mockResolvedValue({
      line: { id: LINE_ID, account_id: 'acct-1', timezone: 'America/New_York', allow_voice_reminder_control: true },
      account: { id: 'acct-1' },
    } as any);
    vi.mocked(encryptReminderMessage).mockResolvedValue(MOCK_ENCRYPTED_MESSAGE);

    const res = createMockRes();
    await setHandler({
      body: {
        callSessionId: SESSION_ID, lineId: LINE_ID,
        dueAtLocal: '2030-01-02T09:00:00', timezone: 'America/New_York',
        // no message field
      },
    } as any, res);

    expect(encryptReminderMessage).toHaveBeenCalledWith(
      expect.any(String), expect.any(String), expect.any(String), 'Check-in call'
    );
    vi.useRealTimers();
  });

  it('returns 409 when session status is completed', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID, account_id: 'acct-1', line_id: LINE_ID, status: 'completed',
    } as any);
    vi.mocked(getLineById).mockResolvedValue({
      line: { id: LINE_ID, account_id: 'acct-1', timezone: 'America/New_York', allow_voice_reminder_control: true },
      account: { id: 'acct-1' },
    } as any);

    const res = createMockRes();
    await setHandler({
      body: {
        callSessionId: SESSION_ID, lineId: LINE_ID,
        dueAtLocal: '2030-01-02T09:00:00', timezone: 'America/New_York',
        message: 'Test',
      },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 on Zod validation failure for missing required fields', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID, account_id: 'acct-1', line_id: LINE_ID, status: 'in_progress',
    } as any);

    const res = createMockRes();
    await setHandler({
      body: {
        // missing callSessionId, lineId, dueAtLocal, timezone
      },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('edit_reminder additional cases', () => {
  it('returns success:false when reminder is not found', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID, account_id: 'acct-1', line_id: LINE_ID,
    } as any);
    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{
        data: { allow_voice_reminder_control: true, timezone: 'America/New_York' },
        error: null,
      }],
      ultaura_reminders: [{ data: null, error: { code: 'PGRST116', message: 'Not found' } }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await editHandler({
      body: {
        callSessionId: SESSION_ID, lineId: LINE_ID,
        reminderId: REMINDER_ID, newTimeLocal: '2030-01-03T10:00:00', timezone: 'America/New_York',
      },
    } as any, res);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("couldn't find");
  });

  it('returns success:false when reminder status is canceled', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID, account_id: 'acct-1', line_id: LINE_ID,
    } as any);
    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{
        data: { allow_voice_reminder_control: true, timezone: 'America/New_York' },
        error: null,
      }],
      ultaura_reminders: [{
        data: { id: REMINDER_ID, account_id: 'acct-1', line_id: LINE_ID, status: 'canceled', is_recurring: false },
        error: null,
      }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await editHandler({
      body: {
        callSessionId: SESSION_ID, lineId: LINE_ID,
        reminderId: REMINDER_ID, newTimeLocal: '2030-01-03T10:00:00', timezone: 'America/New_York',
      },
    } as any, res);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('no longer active');
  });

  it('returns success:false when voice control is disabled', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID, account_id: 'acct-1', line_id: LINE_ID,
    } as any);
    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{
        data: { allow_voice_reminder_control: false, timezone: 'America/New_York' },
        error: null,
      }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await editHandler({
      body: {
        callSessionId: SESSION_ID, lineId: LINE_ID,
        reminderId: REMINDER_ID, newTimeLocal: '2030-01-03T10:00:00', timezone: 'America/New_York',
      },
    } as any, res);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('disabled reminder management by phone');
  });

  it('returns success:false when new time is in the past', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-06-01T12:00:00.000Z'));

    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID, account_id: 'acct-1', line_id: LINE_ID,
    } as any);
    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{
        data: { allow_voice_reminder_control: true, timezone: 'America/New_York' },
        error: null,
      }],
      ultaura_reminders: [{
        data: { id: REMINDER_ID, account_id: 'acct-1', line_id: LINE_ID, status: 'scheduled', is_recurring: false },
        error: null,
      }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await editHandler({
      body: {
        callSessionId: SESSION_ID, lineId: LINE_ID,
        reminderId: REMINDER_ID, newTimeLocal: '2030-01-01T09:00:00', timezone: 'America/New_York',
      },
    } as any, res);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('past');
    vi.useRealTimers();
  });

  it('returns success:false when no changes are provided', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID, account_id: 'acct-1', line_id: LINE_ID,
    } as any);
    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{
        data: { allow_voice_reminder_control: true, timezone: 'America/New_York' },
        error: null,
      }],
      ultaura_reminders: [{
        data: { id: REMINDER_ID, account_id: 'acct-1', line_id: LINE_ID, status: 'scheduled', is_recurring: false },
        error: null,
      }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await editHandler({
      body: {
        callSessionId: SESSION_ID, lineId: LINE_ID,
        reminderId: REMINDER_ID,
        // no newMessage, no newTimeLocal
      },
    } as any, res);

    // Should fail with missing update (no newMessage or newTimeLocal provided fails Zod)
    expect(res.body.success).toBe(false);
  });
});

describe('reminder tool timezone formatting', () => {
  it('uses line timezone for list_reminders output', async () => {
    const dateSpy = vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('DATE');
    const timeSpy = vi.spyOn(Date.prototype, 'toLocaleTimeString').mockReturnValue('TIME');

    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{
        data: { allow_voice_reminder_control: true, display_name: 'Test', timezone: 'America/Chicago' },
        error: null,
      }],
      ultaura_reminders: [{
        data: [{
          id: REMINDER_ID,
          message: 'Test reminder',
          message_ciphertext: null,
          message_iv: null,
          message_tag: null,
          due_at: '2030-01-02T12:00:00.000Z',
          timezone: 'America/New_York',
          is_recurring: false,
          is_paused: false,
          current_snooze_count: 0,
        }],
        error: null,
      }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID,
      account_id: 'acct-1',
      line_id: LINE_ID,
      status: 'in_progress',
    } as any);

    const res = createMockRes();

    await listHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID },
    } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.reminders[0].dateTime).toBe('DATE at TIME');
    expect(dateSpy).toHaveBeenCalledWith('en-US', expect.objectContaining({
      timeZone: 'America/Chicago',
    }));
    expect(timeSpy).toHaveBeenCalledWith('en-US', expect.objectContaining({
      timeZone: 'America/Chicago',
    }));
    dateSpy.mockRestore();
    timeSpy.mockRestore();
  });

  it('uses line timezone for set_reminder response', async () => {
    const dateSpy = vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('DATE');
    const timeSpy = vi.spyOn(Date.prototype, 'toLocaleTimeString').mockReturnValue('TIME');

    const supabaseMock = createSupabaseMock({}, {
      create_ultaura_call_reminder: [{
        data: { success: true, reminder_id: REMINDER_ID, due_at: '2030-01-02T14:00:00.000Z' },
        error: null,
      }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID,
      account_id: 'acct-1',
      line_id: LINE_ID,
      status: 'in_progress',
    } as any);
    vi.mocked(getLineById).mockResolvedValue({
      line: {
        id: LINE_ID,
        account_id: 'acct-1',
        timezone: 'America/Chicago',
        allow_voice_reminder_control: true,
      },
      account: { id: 'acct-1' },
    } as any);
    vi.mocked(encryptReminderMessage).mockResolvedValue(MOCK_ENCRYPTED_MESSAGE);

    const res = createMockRes();

    await setHandler({
      body: {
        callSessionId: SESSION_ID,
        lineId: LINE_ID,
        dueAtLocal: '2030-01-02T09:00:00',
        timezone: 'America/New_York',
        message: 'Take medication',
      },
    } as any, res);

    expect(res.body.message).toContain('DATE at TIME');
    expect(dateSpy).toHaveBeenCalledWith('en-US', expect.objectContaining({
      timeZone: 'America/Chicago',
    }));
    expect(timeSpy).toHaveBeenCalledWith('en-US', expect.objectContaining({
      timeZone: 'America/Chicago',
    }));
    dateSpy.mockRestore();
    timeSpy.mockRestore();
  });

  it('uses line timezone for edit_reminder response', async () => {
    const dateSpy = vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('DATE');
    const timeSpy = vi.spyOn(Date.prototype, 'toLocaleTimeString').mockReturnValue('TIME');

    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{
        data: { allow_voice_reminder_control: true, timezone: 'America/Denver' },
        error: null,
      }],
      ultaura_reminders: [
        { data: {
          id: REMINDER_ID,
          account_id: 'acct-1',
          line_id: LINE_ID,
          message: 'Test reminder',
          message_ciphertext: null,
          message_iv: null,
          message_tag: null,
          due_at: '2030-01-02T12:00:00.000Z',
          timezone: 'America/Denver',
          status: 'scheduled',
          is_recurring: false,
        }, error: null },
        { error: null },
      ],
      ultaura_reminder_events: [{
        error: null,
      }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
    vi.mocked(getCallSession).mockResolvedValue({
      id: SESSION_ID,
      account_id: 'acct-1',
      line_id: LINE_ID,
    } as any);

    const res = createMockRes();

    await editHandler({
      body: {
        callSessionId: SESSION_ID,
        lineId: LINE_ID,
        reminderId: REMINDER_ID,
        newTimeLocal: '2030-01-03T10:00:00',
        timezone: 'America/New_York',
      },
    } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('DATE at TIME');
    expect(dateSpy).toHaveBeenCalledWith('en-US', expect.objectContaining({
      timeZone: 'America/Denver',
    }));
    expect(timeSpy).toHaveBeenCalledWith('en-US', expect.objectContaining({
      timeZone: 'America/Denver',
    }));
    dateSpy.mockRestore();
    timeSpy.mockRestore();
  });
});
