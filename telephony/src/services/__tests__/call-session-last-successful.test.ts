import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallSessionRow } from '../../utils/supabase.js';

const updateLineLastCall = vi.fn();

vi.mock('../line-lookup.js', () => ({
  updateLineLastCall,
}));

vi.mock('../../server.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../metering.js', () => ({
  recordUsage: vi.fn(async () => null),
}));

vi.mock('../insights.js', () => ({
  updateInsightsDuration: vi.fn(async () => {}),
}));

vi.mock('../weekly-summary.js', () => ({
  checkMissedCallAlert: vi.fn(async () => {}),
}));

vi.mock('../wellness-alerts.js', () => ({
  processWellnessAlertsForCall: vi.fn(async () => {}),
}));

vi.mock('../safety-state.js', () => ({
  clearSafetyState: vi.fn(),
  getSafetySummary: vi.fn(() => ({
    backstopTiersTriggered: [],
    modelTiersLogged: [],
    potentialFalsePositives: [],
  })),
  markSafetySummaryLogged: vi.fn(() => false),
}));

vi.mock('../insight-state.js', () => ({
  clearInsightState: vi.fn(),
}));

vi.mock('../../utils/supabase.js', () => ({
  getSupabaseClient: vi.fn(),
}));

type SupabaseMock = {
  from: ReturnType<typeof vi.fn>;
  __setSession: (session: CallSessionRow) => void;
};

function createSupabaseMock(initialSession: CallSessionRow): SupabaseMock {
  let session = initialSession;
  let table: string | null = null;
  let mode: 'select' | 'update' | null = null;

  const builder: any = {
    select: vi.fn(() => {
      mode = 'select';
      return builder;
    }),
    update: vi.fn(() => {
      mode = 'update';
      return builder;
    }),
    eq: vi.fn(() => {
      if (mode === 'select') {
        return builder;
      }
      return Promise.resolve({ data: null, error: null });
    }),
    single: vi.fn(async () => {
      if (table === 'ultaura_call_sessions') {
        return { data: session, error: null };
      }
      return { data: null, error: null };
    }),
  };

  return {
    from: vi.fn((name: string) => {
      table = name;
      return builder;
    }),
    __setSession(next: CallSessionRow) {
      session = next;
    },
  };
}

function buildSession(overrides: Partial<CallSessionRow> = {}): CallSessionRow {
  return {
    id: 'session-1',
    account_id: 'account-1',
    line_id: 'line-1',
    created_at: '2026-01-29T09:59:50.000Z',
    direction: 'inbound',
    status: 'in_progress',
    started_at: null,
    connected_at: '2026-01-29T10:00:00.000Z',
    ended_at: null,
    seconds_connected: null,
    twilio_call_sid: 'CA123',
    twilio_from: '+15550001111',
    twilio_to: '+15550002222',
    recording_sid: null,
    end_reason: null,
    answered_by: 'human',
    language_detected: null,
    tool_invocations: 0,
    cost_estimate_cents_twilio: null,
    cost_estimate_cents_model: null,
    is_reminder_call: false,
    reminder_id: null,
    scheduler_idempotency_key: null,
    is_test_call: false,
    is_preview_mode: false,
    ...overrides,
  };
}

let supabaseMock: SupabaseMock;

beforeEach(async () => {
  vi.clearAllMocks();
  updateLineLastCall.mockReset();

  supabaseMock = createSupabaseMock(buildSession());
  const { getSupabaseClient } = await import('../../utils/supabase.js');
  vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
});

describe('completeCallSession last_successful_call_at updates', () => {
  it('updates last successful call even when not billable', async () => {
    const session = buildSession();
    supabaseMock.__setSession(session);

    const endedAt = '2026-01-29T10:00:10.000Z';
    const { completeCallSession } = await import('../call-session.js');

    await completeCallSession(session.id, {
      endReason: 'hangup',
      endedAt,
    });

    expect(updateLineLastCall).toHaveBeenCalledTimes(1);
    expect(updateLineLastCall).toHaveBeenCalledWith(session.line_id, endedAt);
  });

  it('skips last successful call update for test calls', async () => {
    const session = buildSession({ is_test_call: true });
    supabaseMock.__setSession(session);

    const { completeCallSession } = await import('../call-session.js');

    await completeCallSession(session.id, {
      endReason: 'hangup',
      endedAt: '2026-01-29T10:00:10.000Z',
    });

    expect(updateLineLastCall).not.toHaveBeenCalled();
  });

  it('skips last successful call update for preview calls', async () => {
    const session = buildSession({ is_preview_mode: true });
    supabaseMock.__setSession(session);

    const { completeCallSession } = await import('../call-session.js');

    await completeCallSession(session.id, {
      endReason: 'hangup',
      endedAt: '2026-01-29T10:00:10.000Z',
    });

    expect(updateLineLastCall).not.toHaveBeenCalled();
  });
});
