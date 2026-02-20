import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
vi.mock('../../../services/insights.js', () => ({
  storeCallInsights: vi.fn(),
  DuplicateInsightError: class DuplicateInsightError extends Error {
    constructor() {
      super('duplicate');
      this.name = 'DuplicateInsightError';
    }
  },
}));
vi.mock('../../../services/privacy.js', () => ({
  logConsentAuditEvent: vi.fn(),
  updateLineVoiceConsent: vi.fn(),
}));

import { logCallInsightsRouter } from '../log-call-insights.js';
import { logMoodSnapshotRouter } from '../log-mood-snapshot.js';
import { setInsightsEnabledRouter } from '../set-insights-enabled.js';
import { getCallSession, incrementToolInvocations } from '../../../services/call-session.js';
import { getSupabaseClient } from '../../../utils/supabase.js';
import { storeCallInsights, DuplicateInsightError } from '../../../services/insights.js';
import { logConsentAuditEvent, updateLineVoiceConsent } from '../../../services/privacy.js';
import { createMockRes, getPostHandler, createSupabaseMock } from './helpers/index.js';

const SESSION_ID = '11111111-1111-1111-1111-111111111111';
const LINE_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_LINE_ID = '33333333-3333-3333-3333-333333333333';
const INSIGHT_ID = '55555555-5555-5555-5555-555555555555';

const insightsHandler = getPostHandler(logCallInsightsRouter);
const moodHandler = getPostHandler(logMoodSnapshotRouter);
const insightsEnabledHandler = getPostHandler(setInsightsEnabledRouter);

const baseSession = {
  id: SESSION_ID,
  account_id: 'acct-1',
  line_id: LINE_ID,
  status: 'in_progress',
  seconds_connected: 300,
  connected_at: null,
  is_test_call: false,
  is_preview_mode: false,
};

const insightBody = {
  callSessionId: SESSION_ID,
  lineId: LINE_ID,
  mood_overall: 'positive',
  mood_intensity: 2,
  engagement_score: 8,
  social_need_level: 1,
  topics: [{ code: 'family', weight: 0.8 }],
  needs_follow_up: false,
  confidence_overall: 0.9,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCallSession).mockResolvedValue(baseSession as any);
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── log_call_insights ────────────────────────────────────────────────────────

describe('log_call_insights', () => {
  it('happy path: returns insightId on success', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_insight_privacy: [{ data: { insights_enabled: true }, error: null }],
      ultaura_call_insights: [{ data: null, error: null }], // no existing
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
    vi.mocked(storeCallInsights).mockResolvedValue({ id: INSIGHT_ID, hasConcerns: false } as any);

    const res = createMockRes();
    await insightsHandler({ body: insightBody } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.insightId).toBe(INSIGHT_ID);
    expect(incrementToolInvocations).toHaveBeenCalledWith(SESSION_ID);
  });

  it('returns 400 on missing required fields', async () => {
    const res = createMockRes();
    await insightsHandler({ body: { callSessionId: SESSION_ID } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('skips when insights are disabled', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_insight_privacy: [{ data: { insights_enabled: false }, error: null }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await insightsHandler({ body: insightBody } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.skipped).toBe(true);
    expect(res.body.reason).toBe('insights_disabled');
    expect(storeCallInsights).not.toHaveBeenCalled();
  });

  it('skips when call is too short (< 180s)', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      ...baseSession, seconds_connected: 60,
    } as any);
    const supabaseMock = createSupabaseMock({
      ultaura_insight_privacy: [{ data: { insights_enabled: true }, error: null }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await insightsHandler({ body: insightBody } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.skipped).toBe(true);
    expect(res.body.reason).toBe('call_too_short');
  });

  it('skips test call', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      ...baseSession, is_test_call: true,
    } as any);
    const supabaseMock = createSupabaseMock({
      ultaura_insight_privacy: [{ data: { insights_enabled: true }, error: null }],
      ultaura_call_insights: [{ data: null, error: null }], // no existing
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await insightsHandler({ body: insightBody } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.skipped).toBe(true);
    expect(res.body.reason).toBe('test_call');
  });

  it('skips when insights already recorded for session (already_recorded)', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_insight_privacy: [{ data: { insights_enabled: true }, error: null }],
      ultaura_call_insights: [{ data: { id: INSIGHT_ID }, error: null }], // existing
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await insightsHandler({ body: insightBody } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.skipped).toBe(true);
    expect(res.body.reason).toBe('already_recorded');
    expect(storeCallInsights).not.toHaveBeenCalled();
  });

  it('returns 403 on line mismatch', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      ...baseSession, line_id: OTHER_LINE_ID,
    } as any);

    const res = createMockRes();
    await insightsHandler({ body: insightBody } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('skips when storeCallInsights throws DuplicateInsightError', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_insight_privacy: [{ data: { insights_enabled: true }, error: null }],
      ultaura_call_insights: [{ data: null, error: null }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
    vi.mocked(storeCallInsights).mockRejectedValue(new DuplicateInsightError());

    const res = createMockRes();
    await insightsHandler({ body: insightBody } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.skipped).toBe(true);
    expect(res.body.reason).toBe('already_recorded');
  });
});

// ─── log_mood_snapshot ────────────────────────────────────────────────────────

describe('log_mood_snapshot', () => {
  const moodBody = {
    callSessionId: SESSION_ID,
    lineId: LINE_ID,
    mood_start: 'positive',
    mood_end: 'neutral',
    mood_trajectory: 'stable',
    energy_level: 'normal',
  };

  it('happy path: upserts mood snapshot successfully', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_mood_snapshots: [{ data: null, error: null }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await moodHandler({ body: moodBody } as any, res);

    expect(res.body.success).toBe(true);
    expect(incrementToolInvocations).toHaveBeenCalledWith(SESSION_ID);
  });

  it('returns 400 on Zod validation failure', async () => {
    const res = createMockRes();
    await moodHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID }, // missing mood fields
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 on line mismatch', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      ...baseSession, line_id: OTHER_LINE_ID,
    } as any);

    const res = createMockRes();
    await moodHandler({ body: moodBody } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('returns 500 on upsert error', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_mood_snapshots: [{ data: null, error: { code: '23514', message: 'DB error' } }],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await moodHandler({ body: moodBody } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body.success).toBe(false);
  });
});

// ─── set_insights_enabled ─────────────────────────────────────────────────────

describe('set_insights_enabled', () => {
  it('enable: happy path', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_insight_privacy: [
        { data: { insights_enabled: false }, error: null }, // existing
        { data: null, error: null }, // upsert
      ],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
    vi.mocked(updateLineVoiceConsent).mockResolvedValue(true as any);
    vi.mocked(logConsentAuditEvent).mockResolvedValue(undefined);

    const res = createMockRes();
    await insightsEnabledHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, enabled: true },
    } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('enabled');
    expect(logConsentAuditEvent).toHaveBeenCalled();
    expect(updateLineVoiceConsent).toHaveBeenCalled();
  });

  it('disable: happy path', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_insight_privacy: [
        { data: { insights_enabled: true }, error: null }, // existing
        { data: null, error: null }, // upsert
      ],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
    vi.mocked(updateLineVoiceConsent).mockResolvedValue(true as any);
    vi.mocked(logConsentAuditEvent).mockResolvedValue(undefined);

    const res = createMockRes();
    await insightsEnabledHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, enabled: false },
    } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('disabled');
  });

  it('returns 400 on missing enabled field', async () => {
    const res = createMockRes();
    await insightsEnabledHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 403 on line mismatch', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      ...baseSession, line_id: OTHER_LINE_ID,
    } as any);

    const res = createMockRes();
    await insightsEnabledHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, enabled: true },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('test call: skips persist but still returns success', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      ...baseSession, is_test_call: true,
    } as any);

    const res = createMockRes();
    await insightsEnabledHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, enabled: true },
    } as any, res);

    expect(res.body.success).toBe(true);
    // No DB calls should be made
    expect(getSupabaseClient).not.toHaveBeenCalled();
    expect(logConsentAuditEvent).not.toHaveBeenCalled();
  });

  it('returns 500 on DB update failure', async () => {
    const supabaseMock = createSupabaseMock({
      ultaura_insight_privacy: [
        { data: null, error: null }, // existing (no row found)
        { data: null, error: { code: '23514', message: 'DB error' } }, // upsert fails
      ],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);

    const res = createMockRes();
    await insightsEnabledHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, enabled: false },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body.error).toContain('Failed to update');
  });
});
