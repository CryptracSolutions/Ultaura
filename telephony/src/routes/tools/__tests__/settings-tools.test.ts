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
  updateCallSession: vi.fn(),
}));

vi.mock('../../../utils/supabase.js', () => ({
  getSupabaseClient: vi.fn(),
}));

vi.mock('../../../services/privacy.js', () => ({
  logConsentAuditEvent: vi.fn(),
  updateLineVoiceConsent: vi.fn(),
}));

vi.mock('../../../websocket/grok-bridge-registry.js', () => ({
  getGrokBridge: vi.fn(),
}));

vi.mock('../../../services/routing-alerts.js', () => ({
  sendRoutingAlert: vi.fn(),
}));

vi.mock('../../../services/language.js', () => ({
  persistLanguageToLine: vi.fn(),
}));

vi.mock('../../../utils/metrics.js', () => ({
  voiceRoutingIssuesTotal: { inc: vi.fn() },
}));

import { setPauseModeRouter } from '../set-pause-mode.js';
import { setVoicePreferenceRouter } from '../set-voice-preference.js';
import { reportConversationLanguageRouter } from '../report-conversation-language.js';
import { getCallSession, incrementToolInvocations, recordCallEvent, updateCallSession } from '../../../services/call-session.js';
import { getSupabaseClient } from '../../../utils/supabase.js';
import { logConsentAuditEvent } from '../../../services/privacy.js';
import { getGrokBridge } from '../../../websocket/grok-bridge-registry.js';
import { sendRoutingAlert } from '../../../services/routing-alerts.js';
import { persistLanguageToLine } from '../../../services/language.js';
import { voiceRoutingIssuesTotal } from '../../../utils/metrics.js';
import {
  createMockRes,
  getPostHandler,
  BASE_SESSION_ID,
  BASE_LINE_ID,
  BASE_ACCOUNT_ID,
  baseSession,
} from './helpers/index.js';

// set-pause-mode and set-voice-preference use Zod UUID validation — use proper UUIDs
const UUID_SESSION = 'aaaaaaaa-1111-0000-0000-000000000001';
const UUID_LINE = 'bbbbbbbb-1111-0000-0000-000000000001';
const UUID_OTHER_LINE = 'cccccccc-1111-0000-0000-000000000099';

const pauseModeHandler = getPostHandler(setPauseModeRouter);
const voicePreferenceHandler = getPostHandler(setVoicePreferenceRouter);
const reportLanguageHandler = getPostHandler(reportConversationLanguageRouter);

function makeUpsertBuilder(upsertError: any = null, selectData: any = null) {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => ({ data: selectData, error: null }));
  builder.upsert = vi.fn(async () => ({ data: null, error: upsertError }));
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCallSession).mockResolvedValue({
    ...baseSession,
    id: UUID_SESSION,
    line_id: UUID_LINE,
    account_id: BASE_ACCOUNT_ID,
  });
  vi.mocked(incrementToolInvocations).mockResolvedValue(undefined);
  vi.mocked(recordCallEvent).mockResolvedValue(undefined);
  vi.mocked(updateCallSession).mockResolvedValue(undefined);
  vi.mocked(logConsentAuditEvent).mockResolvedValue(undefined);
  vi.mocked(persistLanguageToLine).mockResolvedValue(true);

  const builder = makeUpsertBuilder();
  vi.mocked(getSupabaseClient).mockReturnValue({ from: vi.fn(() => builder) } as any);
});

// ---------------------------------------------------------------------------
// set_pause_mode
// ---------------------------------------------------------------------------

describe('set_pause_mode', () => {
  it('enable - happy path, upserts ultaura_insight_privacy', async () => {
    const builder = makeUpsertBuilder(null, { is_paused: false });
    vi.mocked(getSupabaseClient).mockReturnValue({ from: vi.fn(() => builder) } as any);

    const res = createMockRes();
    await pauseModeHandler(
      { body: { callSessionId: UUID_SESSION, lineId: UUID_LINE, enabled: true, reason: 'vacation' } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Pause mode enabled');
    expect(vi.mocked(logConsentAuditEvent)).toHaveBeenCalled();
  });

  it('disable - happy path', async () => {
    const builder = makeUpsertBuilder(null, { is_paused: true });
    vi.mocked(getSupabaseClient).mockReturnValue({ from: vi.fn(() => builder) } as any);

    const res = createMockRes();
    await pauseModeHandler(
      { body: { callSessionId: UUID_SESSION, lineId: UUID_LINE, enabled: false } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('disabled');
  });

  it('test call (skipPersist) - skips upsert and audit', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      ...baseSession,
      id: UUID_SESSION,
      line_id: UUID_LINE,
      account_id: BASE_ACCOUNT_ID,
      is_test_call: true,
    });

    const res = createMockRes();
    await pauseModeHandler(
      { body: { callSessionId: UUID_SESSION, lineId: UUID_LINE, enabled: true } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(vi.mocked(logConsentAuditEvent)).not.toHaveBeenCalled();
    expect(vi.mocked(getSupabaseClient)).not.toHaveBeenCalled();
  });

  it('missing fields returns 400', async () => {
    const res = createMockRes();
    await pauseModeHandler(
      { body: { callSessionId: UUID_SESSION, lineId: UUID_LINE } } as any,
      res,
    );

    expect(res.statusCode).toBe(400);
  });

  it('line mismatch returns 403', async () => {
    const res = createMockRes();
    await pauseModeHandler(
      { body: { callSessionId: UUID_SESSION, lineId: UUID_OTHER_LINE, enabled: true } } as any,
      res,
    );

    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// set_voice_preference
// ---------------------------------------------------------------------------

describe('set_voice_preference', () => {
  it('valid voice - happy path, updates ultaura_lines', async () => {
    const builder: any = {};
    builder.update = vi.fn(() => builder);
    builder.eq = vi.fn(async () => ({ data: null, error: null }));
    vi.mocked(getSupabaseClient).mockReturnValue({ from: vi.fn(() => builder) } as any);

    const res = createMockRes();
    await voicePreferenceHandler(
      { body: { callSessionId: UUID_SESSION, lineId: UUID_LINE, voice: 'Ara' } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.voice).toBe('Ara');
  });

  it('missing fields returns 400', async () => {
    const res = createMockRes();
    await voicePreferenceHandler(
      { body: { callSessionId: UUID_SESSION, lineId: UUID_LINE } } as any,
      res,
    );

    expect(res.statusCode).toBe(400);
  });

  it('session not found returns 404', async () => {
    vi.mocked(getCallSession).mockResolvedValue(null as any);

    const res = createMockRes();
    await voicePreferenceHandler(
      { body: { callSessionId: UUID_SESSION, lineId: UUID_LINE, voice: 'Eve' } } as any,
      res,
    );

    expect(res.statusCode).toBe(404);
  });

  it('line mismatch returns 403', async () => {
    const res = createMockRes();
    await voicePreferenceHandler(
      { body: { callSessionId: UUID_SESSION, lineId: UUID_OTHER_LINE, voice: 'Leo' } } as any,
      res,
    );

    expect(res.statusCode).toBe(403);
  });

  it('update failure returns 500', async () => {
    const builder: any = {};
    builder.update = vi.fn(() => builder);
    builder.eq = vi.fn(async () => ({ data: null, error: { message: 'DB error' } }));
    vi.mocked(getSupabaseClient).mockReturnValue({ from: vi.fn(() => builder) } as any);

    const res = createMockRes();
    await voicePreferenceHandler(
      { body: { callSessionId: UUID_SESSION, lineId: UUID_LINE, voice: 'Rex' } } as any,
      res,
    );

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// report_conversation_language
// report_conversation_language does NOT use Zod, so BASE_SESSION_ID works
// ---------------------------------------------------------------------------

describe('report_conversation_language', () => {
  beforeEach(() => {
    // Override to use base session with BASE_SESSION_ID for this group
    vi.mocked(getCallSession).mockResolvedValue(baseSession);
    const mockBridge = { setDetectedLanguage: vi.fn() };
    vi.mocked(getGrokBridge).mockReturnValue(mockBridge as any);
  });

  it('happy path - sets language on bridge, persists to line, updates session', async () => {
    const res = createMockRes();
    await reportLanguageHandler(
      { body: { callSessionId: BASE_SESSION_ID, languageCode: 'es' } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.languageCode).toBeDefined();
    expect(vi.mocked(persistLanguageToLine)).toHaveBeenCalledWith(BASE_LINE_ID, 'es');
    expect(vi.mocked(updateCallSession)).toHaveBeenCalled();
  });

  it('missing callSessionId returns 400', async () => {
    const res = createMockRes();
    await reportLanguageHandler(
      { body: { languageCode: 'en' } } as any,
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('missing languageCode returns 400', async () => {
    const res = createMockRes();
    await reportLanguageHandler(
      { body: { callSessionId: BASE_SESSION_ID } } as any,
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('session not found returns 404', async () => {
    vi.mocked(getCallSession).mockResolvedValue(null as any);

    const res = createMockRes();
    await reportLanguageHandler(
      { body: { callSessionId: BASE_SESSION_ID, languageCode: 'fr' } } as any,
      res,
    );

    expect(res.statusCode).toBe(404);
  });

  it('GrokBridge missing - sends routing alert and increments metric', async () => {
    vi.mocked(getGrokBridge).mockReturnValue(null as any);

    const res = createMockRes();
    await reportLanguageHandler(
      { body: { callSessionId: BASE_SESSION_ID, languageCode: 'de' } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(vi.mocked(voiceRoutingIssuesTotal).inc).toHaveBeenCalledWith({ issue: 'bridge_missing_for_tool' });
    expect(vi.mocked(sendRoutingAlert)).toHaveBeenCalled();
  });

  it('accepts language_code key as alias for languageCode', async () => {
    const res = createMockRes();
    await reportLanguageHandler(
      { body: { callSessionId: BASE_SESSION_ID, language_code: 'ja' } } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(vi.mocked(persistLanguageToLine)).toHaveBeenCalledWith(BASE_LINE_ID, 'ja');
  });
});
