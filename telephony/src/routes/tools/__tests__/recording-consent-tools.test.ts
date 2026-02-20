import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../services/call-session.js', () => ({
  getCallSession: vi.fn(),
  incrementToolInvocations: vi.fn(),
  recordCallEvent: vi.fn(),
  updateCallSessionRecording: vi.fn(),
}));
vi.mock('../../../services/privacy.js', () => ({
  getAccountPrivacySettings: vi.fn(),
  updateLineVoiceConsent: vi.fn(),
}));
vi.mock('../../../utils/supabase.js', () => ({
  getSupabaseClient: vi.fn(),
}));
vi.mock('../../../utils/env.js', () => ({
  getPublicUrl: vi.fn(() => 'http://localhost:3000'),
}));
vi.mock('../../../utils/twilio.js', () => ({
  startRecordingForCall: vi.fn(),
  stopRecordingForCall: vi.fn(),
}));

import { recordingConsentRouter } from '../recording-consent.js';
import {
  getCallSession,
  incrementToolInvocations,
  recordCallEvent,
  updateCallSessionRecording,
} from '../../../services/call-session.js';
import { getAccountPrivacySettings, updateLineVoiceConsent } from '../../../services/privacy.js';
import { getSupabaseClient } from '../../../utils/supabase.js';
import { startRecordingForCall, stopRecordingForCall } from '../../../utils/twilio.js';
import {
  createMockRes,
  getPostHandler,
  BASE_ACCOUNT_ID,
  baseSession,
  createSupabaseMock,
} from './helpers/index.js';

const SESSION_UUID = '00000000-0000-0000-0000-000000000001';
const LINE_UUID = baseSession.line_id;

const grantHandler = getPostHandler(recordingConsentRouter, '/grant_recording_consent');
const denyHandler = getPostHandler(recordingConsentRouter, '/deny_recording_consent');
const revokeHandler = getPostHandler(recordingConsentRouter, '/revoke_recording_consent');
const preferenceHandler = getPostHandler(recordingConsentRouter, '/set_recording_preference_permanent');

const baseBody = {
  callSessionId: SESSION_UUID,
  lineId: LINE_UUID,
};

const sessionWithRecording = {
  ...baseSession,
  twilio_call_sid: 'CA-test-sid',
  recording_sid: 'RE-test-recording-sid',
};

let supabaseMock: ReturnType<typeof createSupabaseMock>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCallSession).mockResolvedValue(baseSession);
  vi.mocked(updateLineVoiceConsent).mockResolvedValue(true as any);
  vi.mocked(incrementToolInvocations).mockResolvedValue(undefined);
  vi.mocked(recordCallEvent).mockResolvedValue(undefined);
  vi.mocked(updateCallSessionRecording).mockResolvedValue(undefined);
  vi.mocked(getAccountPrivacySettings).mockResolvedValue({ recordingEnabled: true } as any);
  vi.mocked(startRecordingForCall).mockResolvedValue('RE-new-recording-sid');
  vi.mocked(stopRecordingForCall).mockResolvedValue(true);
  supabaseMock = createSupabaseMock();
  vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
  process.env.ULTAURA_ENABLE_RECORDING = 'true';
});

afterEach(() => {
  process.env.ULTAURA_ENABLE_RECORDING = 'false';
});

describe('grant_recording_consent', () => {
  it('test 1: happy path — recording started, returns success', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      ...baseSession,
      twilio_call_sid: 'CA-test-sid',
      recording_sid: null,
    });
    const res = createMockRes();
    await grantHandler({ body: baseBody } as any, res);

    expect(updateLineVoiceConsent).toHaveBeenCalledWith(
      LINE_UUID,
      BASE_ACCOUNT_ID,
      SESSION_UUID,
      expect.objectContaining({ recordingConsent: 'granted' }),
      expect.objectContaining({ skipPersist: false })
    );
    expect(startRecordingForCall).toHaveBeenCalledWith(expect.objectContaining({
      callSid: 'CA-test-sid',
    }));
    expect(updateCallSessionRecording).toHaveBeenCalledWith(baseSession.id, 'RE-new-recording-sid');
    expect(res.body).toEqual({ success: true, message: 'Recording consent granted.' });
  });

  it('test 2: missing fields — 400', async () => {
    const res = createMockRes();
    await grantHandler({ body: { callSessionId: SESSION_UUID } } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ success: false, error: 'Missing required fields' });
  });

  it('test 3: session not found — 404', async () => {
    vi.mocked(getCallSession).mockResolvedValue(null as any);
    const res = createMockRes();
    await grantHandler({ body: baseBody } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ success: false, error: 'Call session not found' });
  });

  it('test 4: line mismatch — 403', async () => {
    const res = createMockRes();
    await grantHandler({
      body: { callSessionId: SESSION_UUID, lineId: 'wrong-line-id' },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({ success: false, error: 'Unauthorized' });
    expect(recordCallEvent).toHaveBeenCalledWith(
      SESSION_UUID, 'tool_call',
      expect.objectContaining({ errorCode: 'unauthorized' }),
      expect.anything()
    );
  });

  it('test 5: recording disabled (env) — returns RECORDING_DISABLED_RESPONSE', async () => {
    process.env.ULTAURA_ENABLE_RECORDING = 'false';
    const res = createMockRes();
    await grantHandler({ body: baseBody } as any, res);

    expect(res.body).toEqual({
      success: false,
      error: 'Recording is disabled for this account.',
    });
    expect(startRecordingForCall).not.toHaveBeenCalled();
  });

  it('test 6: recording disabled (account setting) — returns RECORDING_DISABLED_RESPONSE', async () => {
    vi.mocked(getAccountPrivacySettings).mockResolvedValue({ recordingEnabled: false } as any);
    const res = createMockRes();
    await grantHandler({ body: baseBody } as any, res);

    expect(res.body).toEqual({
      success: false,
      error: 'Recording is disabled for this account.',
    });
    expect(startRecordingForCall).not.toHaveBeenCalled();
  });

  it('test 7: test call (is_test_call=true) — no Twilio recording, skipPersist=true, returns success', async () => {
    vi.mocked(getCallSession).mockResolvedValue({ ...baseSession, is_test_call: true, twilio_call_sid: 'CA-test-sid', recording_sid: null });
    const res = createMockRes();
    await grantHandler({ body: baseBody } as any, res);

    expect(updateLineVoiceConsent).toHaveBeenCalledWith(
      LINE_UUID, BASE_ACCOUNT_ID, SESSION_UUID,
      expect.anything(),
      expect.objectContaining({ skipPersist: true })
    );
    expect(startRecordingForCall).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ success: true });
  });

  it('test 8: already has recording_sid — startRecordingForCall NOT called', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      ...baseSession,
      twilio_call_sid: 'CA-test-sid',
      recording_sid: 'RE-existing-sid',
    });
    const res = createMockRes();
    await grantHandler({ body: baseBody } as any, res);

    expect(startRecordingForCall).not.toHaveBeenCalled();
    expect(res.body).toEqual({ success: true, message: 'Recording consent granted.' });
  });
});

describe('deny_recording_consent', () => {
  it('test 9: happy path (no active recording) — consent denied, no stop called', async () => {
    const res = createMockRes();
    await denyHandler({ body: baseBody } as any, res);

    expect(updateLineVoiceConsent).toHaveBeenCalledWith(
      LINE_UUID, BASE_ACCOUNT_ID, SESSION_UUID,
      expect.objectContaining({ recordingConsent: 'denied' }),
      expect.objectContaining({ skipPersist: false })
    );
    expect(stopRecordingForCall).not.toHaveBeenCalled();
    expect(res.body).toEqual({ success: true, message: 'Recording consent denied.' });
  });

  it('test 10: active recording + has call_sid — stopRecordingForCall called', async () => {
    vi.mocked(getCallSession).mockResolvedValue(sessionWithRecording);
    const res = createMockRes();
    await denyHandler({ body: baseBody } as any, res);

    expect(stopRecordingForCall).toHaveBeenCalledWith({
      callSid: 'CA-test-sid',
      recordingSid: 'RE-test-recording-sid',
    });
    expect(res.body).toEqual({ success: true, message: 'Recording consent denied.' });
  });

  it('test 11: active recording + stop fails — queues deletion', async () => {
    vi.mocked(getCallSession).mockResolvedValue(sessionWithRecording);
    vi.mocked(stopRecordingForCall).mockResolvedValue(false);
    const res = createMockRes();
    await denyHandler({ body: baseBody } as any, res);

    expect(supabaseMock.__state.inserts.some(i => i.table === 'ultaura_pending_recording_deletions')).toBe(true);
    expect(res.body).toEqual({ success: true, message: 'Recording consent denied.' });
  });

  it('test 12: active recording + no call_sid — queues deletion directly', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      ...baseSession,
      twilio_call_sid: null,
      recording_sid: 'RE-test-recording-sid',
    });
    const res = createMockRes();
    await denyHandler({ body: baseBody } as any, res);

    expect(stopRecordingForCall).not.toHaveBeenCalled();
    expect(supabaseMock.__state.inserts.some(i => i.table === 'ultaura_pending_recording_deletions')).toBe(true);
    expect(res.body).toEqual({ success: true, message: 'Recording consent denied.' });
  });

  it('test 13: recording disabled — returns RECORDING_DISABLED_RESPONSE', async () => {
    process.env.ULTAURA_ENABLE_RECORDING = 'false';
    const res = createMockRes();
    await denyHandler({ body: baseBody } as any, res);

    expect(res.body).toEqual({ success: false, error: 'Recording is disabled for this account.' });
  });

  it('test 14: test call — skipPersist=true', async () => {
    vi.mocked(getCallSession).mockResolvedValue({ ...baseSession, is_test_call: true });
    const res = createMockRes();
    await denyHandler({ body: baseBody } as any, res);

    expect(updateLineVoiceConsent).toHaveBeenCalledWith(
      LINE_UUID, BASE_ACCOUNT_ID, SESSION_UUID,
      expect.anything(),
      expect.objectContaining({ skipPersist: true })
    );
    expect(res.body).toMatchObject({ success: true });
  });

  it('test 15: DB write failure — 500', async () => {
    vi.mocked(updateLineVoiceConsent).mockResolvedValue(false as any);
    const res = createMockRes();
    await denyHandler({ body: baseBody } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ success: false, error: 'Failed to record consent' });
    expect(recordCallEvent).toHaveBeenCalledWith(
      SESSION_UUID, 'tool_call',
      expect.objectContaining({ errorCode: 'db_write_failed' }),
      expect.anything()
    );
  });
});

describe('revoke_recording_consent', () => {
  it('test 16: happy path — recording stopped, consent updated', async () => {
    vi.mocked(getCallSession).mockResolvedValue(sessionWithRecording);
    const res = createMockRes();
    await revokeHandler({ body: baseBody } as any, res);

    expect(stopRecordingForCall).toHaveBeenCalled();
    expect(updateLineVoiceConsent).toHaveBeenCalledWith(
      LINE_UUID, BASE_ACCOUNT_ID, SESSION_UUID,
      expect.objectContaining({ recordingConsent: 'denied' }),
      expect.anything()
    );
    expect(res.body).toEqual({ success: true, message: 'Recording stopped for this call.' });
  });

  it('test 17: active recording + stop fails — queues deletion', async () => {
    vi.mocked(getCallSession).mockResolvedValue(sessionWithRecording);
    vi.mocked(stopRecordingForCall).mockResolvedValue(false);
    const res = createMockRes();
    await revokeHandler({ body: baseBody } as any, res);

    expect(supabaseMock.__state.inserts.some(i => i.table === 'ultaura_pending_recording_deletions')).toBe(true);
    expect(res.body).toEqual({ success: true, message: 'Recording stopped for this call.' });
  });

  it('test 18: active recording + no call_sid — queues deletion directly', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      ...baseSession,
      twilio_call_sid: null,
      recording_sid: 'RE-test-recording-sid',
    });
    const res = createMockRes();
    await revokeHandler({ body: baseBody } as any, res);

    expect(stopRecordingForCall).not.toHaveBeenCalled();
    expect(supabaseMock.__state.inserts.some(i => i.table === 'ultaura_pending_recording_deletions')).toBe(true);
  });

  it('test 19: recording disabled — returns RECORDING_DISABLED_RESPONSE', async () => {
    process.env.ULTAURA_ENABLE_RECORDING = 'false';
    const res = createMockRes();
    await revokeHandler({ body: baseBody } as any, res);

    expect(res.body).toEqual({ success: false, error: 'Recording is disabled for this account.' });
  });

  it('test 20: line mismatch — 403', async () => {
    const res = createMockRes();
    await revokeHandler({
      body: { callSessionId: SESSION_UUID, lineId: 'wrong-line-id' },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({ success: false, error: 'Unauthorized' });
  });
});

describe('set_recording_preference_permanent', () => {
  const prefBody = { ...baseBody, never_ask: true };

  beforeEach(() => {
    // Default: no existing reenable request
    supabaseMock.__state.maybeSingleResult = {
      data: { recording_reenable_requested_at: null, recording_reenable_decline_count: 0, recording_reenable_blocked_at: null },
      error: null,
    };
  });

  it('test 21: happy path never_ask=true — returns success with "will not ask again"', async () => {
    const res = createMockRes();
    await preferenceHandler({ body: prefBody } as any, res);

    expect(updateLineVoiceConsent).toHaveBeenCalledWith(
      LINE_UUID, BASE_ACCOUNT_ID, SESSION_UUID,
      expect.objectContaining({ recordingPreferencePermanent: true }),
      expect.anything()
    );
    expect(res.body).toEqual({
      success: true,
      message: 'Recording preference updated. Will not ask again.',
    });
  });

  it('test 22: happy path never_ask=false — returns success with "will ask each call"', async () => {
    const res = createMockRes();
    await preferenceHandler({ body: { ...baseBody, never_ask: false } } as any, res);

    expect(updateLineVoiceConsent).toHaveBeenCalledWith(
      LINE_UUID, BASE_ACCOUNT_ID, SESSION_UUID,
      expect.objectContaining({ recordingPreferencePermanent: false }),
      expect.anything()
    );
    expect(res.body).toEqual({
      success: true,
      message: 'Recording preference updated. Will ask each call.',
    });
  });

  it('test 23: missing never_ask — 400', async () => {
    const res = createMockRes();
    await preferenceHandler({ body: { callSessionId: SESSION_UUID, lineId: LINE_UUID } } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ success: false, error: 'Missing required fields' });
  });

  it('test 24: line mismatch — 403', async () => {
    const res = createMockRes();
    await preferenceHandler({
      body: { callSessionId: SESSION_UUID, lineId: 'wrong-line-id', never_ask: true },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('test 25: reenable request pending + never_ask=true — clears request, increments decline count, sets blocked_at', async () => {
    supabaseMock.__state.maybeSingleResult = {
      data: {
        recording_reenable_requested_at: '2026-01-01T00:00:00.000Z',
        recording_reenable_decline_count: 1,
        recording_reenable_blocked_at: null,
      },
      error: null,
    };
    const res = createMockRes();
    await preferenceHandler({ body: prefBody } as any, res);

    expect(updateLineVoiceConsent).toHaveBeenCalledWith(
      LINE_UUID, BASE_ACCOUNT_ID, SESSION_UUID,
      expect.objectContaining({
        recordingPreferencePermanent: true,
        recordingReenableRequestedAt: null,
        recordingReenableDeclineCount: 2,
        recordingReenableBlockedAt: expect.any(String),
      }),
      expect.anything()
    );
    expect(res.body).toMatchObject({ success: true });
  });

  it('test 26: reenable request pending + never_ask=false — clears request only', async () => {
    supabaseMock.__state.maybeSingleResult = {
      data: {
        recording_reenable_requested_at: '2026-01-01T00:00:00.000Z',
        recording_reenable_decline_count: 0,
        recording_reenable_blocked_at: null,
      },
      error: null,
    };
    const res = createMockRes();
    await preferenceHandler({ body: { ...baseBody, never_ask: false } } as any, res);

    const callArg = vi.mocked(updateLineVoiceConsent).mock.calls[0][3];
    expect(callArg).toMatchObject({
      recordingPreferencePermanent: false,
      recordingReenableRequestedAt: null,
    });
    expect(callArg).not.toHaveProperty('recordingReenableDeclineCount');
    expect(res.body).toMatchObject({ success: true });
  });

  it('test 27: already blocked (blocked_at set) + never_ask=true — does NOT overwrite blocked_at', async () => {
    const existingBlockedAt = '2026-01-01T00:00:00.000Z';
    supabaseMock.__state.maybeSingleResult = {
      data: {
        recording_reenable_requested_at: '2026-01-02T00:00:00.000Z',
        recording_reenable_decline_count: 3,
        recording_reenable_blocked_at: existingBlockedAt,
      },
      error: null,
    };
    const res = createMockRes();
    await preferenceHandler({ body: prefBody } as any, res);

    const callArg = vi.mocked(updateLineVoiceConsent).mock.calls[0][3];
    // blocked_at should not be updated (already set)
    expect(callArg).not.toHaveProperty('recordingReenableBlockedAt');
    expect(res.body).toMatchObject({ success: true });
  });

  it('test 28: DB write failure — 500', async () => {
    vi.mocked(updateLineVoiceConsent).mockResolvedValue(false as any);
    const res = createMockRes();
    await preferenceHandler({ body: prefBody } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ success: false, error: 'Failed to update recording preference' });
  });
});
