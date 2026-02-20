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
vi.mock('../../../utils/supabase.js', () => ({
  getSupabaseClient: vi.fn(),
}));

import { pauseReminderRouter } from '../pause-reminder.js';
import { resumeReminderRouter } from '../resume-reminder.js';
import { snoozeReminderRouter } from '../snooze-reminder.js';
import { cancelReminderRouter } from '../cancel-reminder.js';
import { getCallSession, incrementToolInvocations } from '../../../services/call-session.js';
import { getSupabaseClient } from '../../../utils/supabase.js';
import { createMockRes, getPostHandler, createSupabaseMock } from './helpers/index.js';

const SESSION_ID = '11111111-1111-1111-1111-111111111111';
const LINE_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_LINE_ID = '33333333-3333-3333-3333-333333333333';
const REMINDER_ID = '44444444-4444-4444-4444-444444444444';

const pauseHandler = getPostHandler(pauseReminderRouter);
const resumeHandler = getPostHandler(resumeReminderRouter);
const snoozeHandler = getPostHandler(snoozeReminderRouter);
const cancelHandler = getPostHandler(cancelReminderRouter);

const baseSession = {
  id: SESSION_ID,
  account_id: 'acct-1',
  line_id: LINE_ID,
  status: 'in_progress',
};

const activeLine = {
  allow_voice_reminder_control: true,
  timezone: 'America/New_York',
};

const activeReminder = {
  id: REMINDER_ID,
  account_id: 'acct-1',
  line_id: LINE_ID,
  status: 'scheduled',
  is_paused: false,
  is_recurring: false,
  due_at: '2030-06-01T14:00:00.000Z',
  timezone: 'America/New_York',
  current_snooze_count: 0,
  original_due_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCallSession).mockResolvedValue(baseSession as any);
});

// ─── pause_reminder ───────────────────────────────────────────────────────────

describe('pause_reminder', () => {
  it('happy path: pauses reminder and logs event', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{ data: activeLine, error: null }],
      ultaura_reminders: [{ data: activeReminder, error: null }],
      // update returns no error
      ultaura_reminder_events: [{ data: null, error: null }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await pauseHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, reminderId: REMINDER_ID },
    } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("paused");
    expect(incrementToolInvocations).toHaveBeenCalledWith(SESSION_ID);
  });

  it('returns success:false when reminder is already paused', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{ data: activeLine, error: null }],
      ultaura_reminders: [{ data: { ...activeReminder, is_paused: true }, error: null }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await pauseHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, reminderId: REMINDER_ID },
    } as any, res);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('already paused');
  });

  it('returns success:false when reminder is not found', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{ data: activeLine, error: null }],
      ultaura_reminders: [{ data: null, error: { code: 'PGRST116', message: 'Not found' } }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await pauseHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, reminderId: REMINDER_ID },
    } as any, res);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("couldn't find");
  });

  it('returns 403 when lineId does not match session', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      ...baseSession,
      line_id: OTHER_LINE_ID,
    } as any);
    vi.mocked(getSupabaseClient).mockReturnValue(createSupabaseMock({}) as any);

    const res = createMockRes();
    await pauseHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, reminderId: REMINDER_ID },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.error).toBe('Unauthorized');
  });
});

// ─── resume_reminder ──────────────────────────────────────────────────────────

describe('resume_reminder', () => {
  it('happy path: resumes reminder and resets snooze count', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{ data: activeLine, error: null }],
      ultaura_reminders: [{ data: { ...activeReminder, is_paused: true, current_snooze_count: 2 }, error: null }],
      ultaura_reminder_events: [{ data: null, error: null }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await resumeHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, reminderId: REMINDER_ID },
    } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('resumed');
    expect(incrementToolInvocations).toHaveBeenCalledWith(SESSION_ID);
  });

  it('returns success:false when reminder is not paused', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{ data: activeLine, error: null }],
      ultaura_reminders: [{ data: { ...activeReminder, is_paused: false }, error: null }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await resumeHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, reminderId: REMINDER_ID },
    } as any, res);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("isn't paused");
  });

  it('returns success:false when reminder is not found', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{ data: activeLine, error: null }],
      ultaura_reminders: [{ data: null, error: { code: 'PGRST116', message: 'Not found' } }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await resumeHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, reminderId: REMINDER_ID },
    } as any, res);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("couldn't find");
  });

  it('returns 403 when lineId does not match session', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      ...baseSession,
      line_id: OTHER_LINE_ID,
    } as any);
    vi.mocked(getSupabaseClient).mockReturnValue(createSupabaseMock({}) as any);

    const res = createMockRes();
    await resumeHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, reminderId: REMINDER_ID },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.error).toBe('Unauthorized');
  });
});

// ─── snooze_reminder ──────────────────────────────────────────────────────────

describe('snooze_reminder', () => {
  it('happy path: snoozes reminder, updates due_at, increments snooze count', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T12:00:00.000Z'));

    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{ data: activeLine, error: null }],
      ultaura_reminders: [{ data: activeReminder, error: null }],
      ultaura_reminder_events: [{ data: null, error: null }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await snoozeHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, reminderId: REMINDER_ID, snoozeMinutes: 30 },
    } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.snoozeCount).toBe(1);
    expect(res.body.newDueAt).toBeDefined();
    expect(incrementToolInvocations).toHaveBeenCalledWith(SESSION_ID);
    vi.useRealTimers();
  });

  it('returns success:false when MAX_SNOOZE_COUNT is reached', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{ data: activeLine, error: null }],
      ultaura_reminders: [{ data: { ...activeReminder, current_snooze_count: 3 }, error: null }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await snoozeHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, reminderId: REMINDER_ID, snoozeMinutes: 30 },
    } as any, res);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('snoozed this reminder 3 times');
  });

  it('returns success:false when reminder is not found', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{ data: activeLine, error: null }],
      ultaura_reminders: [{ data: null, error: { code: 'PGRST116', message: 'Not found' } }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await snoozeHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, reminderId: REMINDER_ID, snoozeMinutes: 15 },
    } as any, res);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("couldn't find");
  });

  it('returns 403 when lineId does not match session', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      ...baseSession,
      line_id: OTHER_LINE_ID,
    } as any);
    vi.mocked(getSupabaseClient).mockReturnValue(createSupabaseMock({}) as any);

    const res = createMockRes();
    await snoozeHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, reminderId: REMINDER_ID, snoozeMinutes: 30 },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.error).toBe('Unauthorized');
  });
});

// ─── cancel_reminder ──────────────────────────────────────────────────────────

describe('cancel_reminder', () => {
  it('happy path: cancels reminder and logs event', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{ data: activeLine, error: null }],
      ultaura_reminders: [{ data: activeReminder, error: null }],
      ultaura_reminder_events: [{ data: null, error: null }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await cancelHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, reminderId: REMINDER_ID },
    } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("canceled");
    expect(incrementToolInvocations).toHaveBeenCalledWith(SESSION_ID);
  });

  it('returns success:false when reminder is not active (already canceled)', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{ data: activeLine, error: null }],
      ultaura_reminders: [{ data: { ...activeReminder, status: 'canceled' }, error: null }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await cancelHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, reminderId: REMINDER_ID },
    } as any, res);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('no longer active');
  });

  it('returns success:false when reminder is not found', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_lines: [{ data: activeLine, error: null }],
      ultaura_reminders: [{ data: null, error: { code: 'PGRST116', message: 'Not found' } }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await cancelHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, reminderId: REMINDER_ID },
    } as any, res);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("couldn't find");
  });

  it('returns 403 when lineId does not match session', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      ...baseSession,
      line_id: OTHER_LINE_ID,
    } as any);
    vi.mocked(getSupabaseClient).mockReturnValue(createSupabaseMock({}) as any);

    const res = createMockRes();
    await cancelHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, reminderId: REMINDER_ID },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.error).toBe('Unauthorized');
  });
});
