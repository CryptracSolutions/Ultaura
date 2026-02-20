import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../services/call-session.js', () => ({
  getCallSession: vi.fn(),
  incrementToolInvocations: vi.fn(),
  recordCallEvent: vi.fn(),
}));
vi.mock('../../../services/privacy.js', () => ({
  updateLineVoiceConsent: vi.fn(),
}));

import { voiceConsentRouter } from '../voice-consent.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../../services/call-session.js';
import { updateLineVoiceConsent } from '../../../services/privacy.js';
import {
  createMockRes,
  getPostHandler,
  BASE_ACCOUNT_ID,
  baseSession,
} from './helpers/index.js';

const SESSION_UUID = '00000000-0000-0000-0000-000000000001';
const LINE_UUID = baseSession.line_id;

const grantHandler = getPostHandler(voiceConsentRouter, '/grant_memory_consent');
const denyHandler = getPostHandler(voiceConsentRouter, '/deny_memory_consent');

const baseBody = {
  callSessionId: SESSION_UUID,
  lineId: LINE_UUID,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCallSession).mockResolvedValue(baseSession);
  vi.mocked(updateLineVoiceConsent).mockResolvedValue(true as any);
  vi.mocked(incrementToolInvocations).mockResolvedValue(undefined);
  vi.mocked(recordCallEvent).mockResolvedValue(undefined);
});

describe('grant_memory_consent', () => {
  it('test 1: happy path — updateLineVoiceConsent called with memoryConsent: granted', async () => {
    const res = createMockRes();
    await grantHandler({ body: baseBody } as any, res);

    expect(updateLineVoiceConsent).toHaveBeenCalledWith(
      LINE_UUID,
      BASE_ACCOUNT_ID,
      SESSION_UUID,
      { memoryConsent: 'granted' },
      expect.objectContaining({ skipPersist: false })
    );
    expect(res.body).toEqual({
      success: true,
      message: 'Memory consent recorded. You can now remember things the user shares.',
    });
  });

  it('test 2: missing callSessionId — 400', async () => {
    const res = createMockRes();
    await grantHandler({ body: { lineId: LINE_UUID } } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ success: false, error: 'Missing required fields' });
  });

  it('test 3: missing lineId — 400', async () => {
    const res = createMockRes();
    await grantHandler({ body: { callSessionId: SESSION_UUID } } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ success: false, error: 'Missing required fields' });
  });

  it('test 4: session not found — 404', async () => {
    vi.mocked(getCallSession).mockResolvedValue(null as any);
    const res = createMockRes();
    await grantHandler({ body: baseBody } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ success: false, error: 'Call session not found' });
  });

  it('test 5: line ID mismatch — 403, recordCallEvent called with unauthorized', async () => {
    const res = createMockRes();
    await grantHandler({
      body: { callSessionId: SESSION_UUID, lineId: 'wrong-line-id' },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({ success: false, error: 'Unauthorized' });
    expect(recordCallEvent).toHaveBeenCalledWith(
      SESSION_UUID,
      'tool_call',
      expect.objectContaining({ errorCode: 'unauthorized' }),
      expect.anything()
    );
  });

  it('test 6: test call (is_test_call=true) — skipPersist=true, updateLineVoiceConsent called with skipPersist, returns success', async () => {
    vi.mocked(getCallSession).mockResolvedValue({ ...baseSession, is_test_call: true });
    const res = createMockRes();
    await grantHandler({ body: baseBody } as any, res);

    expect(updateLineVoiceConsent).toHaveBeenCalledWith(
      LINE_UUID,
      BASE_ACCOUNT_ID,
      SESSION_UUID,
      { memoryConsent: 'granted' },
      expect.objectContaining({ skipPersist: true })
    );
    expect(res.body).toMatchObject({ success: true });
  });

  it('test 7: preview mode (is_preview_mode=true) — skipPersist=true, returns success', async () => {
    vi.mocked(getCallSession).mockResolvedValue({ ...baseSession, is_preview_mode: true });
    const res = createMockRes();
    await grantHandler({ body: baseBody } as any, res);

    expect(updateLineVoiceConsent).toHaveBeenCalledWith(
      LINE_UUID,
      BASE_ACCOUNT_ID,
      SESSION_UUID,
      { memoryConsent: 'granted' },
      expect.objectContaining({ skipPersist: true })
    );
    expect(res.body).toMatchObject({ success: true });
  });

  it('test 7b: DB write failure (updateLineVoiceConsent returns false, not skipPersist) — 500', async () => {
    vi.mocked(updateLineVoiceConsent).mockResolvedValue(false as any);
    const res = createMockRes();
    await grantHandler({ body: baseBody } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ success: false, error: 'Failed to record consent' });
  });
});

describe('deny_memory_consent', () => {
  it('test 8: happy path — updateLineVoiceConsent called with memoryConsent: denied, returns success', async () => {
    const res = createMockRes();
    await denyHandler({ body: baseBody } as any, res);

    expect(updateLineVoiceConsent).toHaveBeenCalledWith(
      LINE_UUID,
      BASE_ACCOUNT_ID,
      SESSION_UUID,
      { memoryConsent: 'denied' },
      expect.objectContaining({ skipPersist: false })
    );
    expect(res.body).toEqual({
      success: true,
      message: 'Noted. Conversations will not be remembered for personalization.',
    });
  });

  it('test 9: missing fields — 400', async () => {
    const res = createMockRes();
    await denyHandler({ body: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ success: false, error: 'Missing required fields' });
  });

  it('test 10: session not found — 404', async () => {
    vi.mocked(getCallSession).mockResolvedValue(null as any);
    const res = createMockRes();
    await denyHandler({ body: baseBody } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ success: false, error: 'Call session not found' });
  });

  it('test 11: line ID mismatch — 403', async () => {
    const res = createMockRes();
    await denyHandler({
      body: { callSessionId: SESSION_UUID, lineId: 'wrong-line-id' },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({ success: false, error: 'Unauthorized' });
    expect(recordCallEvent).toHaveBeenCalledWith(
      SESSION_UUID,
      'tool_call',
      expect.objectContaining({ errorCode: 'unauthorized' }),
      expect.anything()
    );
  });

  it('test 12: test call — skipPersist=true', async () => {
    vi.mocked(getCallSession).mockResolvedValue({ ...baseSession, is_test_call: true });
    const res = createMockRes();
    await denyHandler({ body: baseBody } as any, res);

    expect(updateLineVoiceConsent).toHaveBeenCalledWith(
      LINE_UUID,
      BASE_ACCOUNT_ID,
      SESSION_UUID,
      { memoryConsent: 'denied' },
      expect.objectContaining({ skipPersist: true })
    );
    expect(res.body).toMatchObject({ success: true });
  });

  it('test 13: DB write failure (updateLineVoiceConsent returns false, not skipPersist) — 500', async () => {
    vi.mocked(updateLineVoiceConsent).mockResolvedValue(false as any);
    const res = createMockRes();
    await denyHandler({ body: baseBody } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ success: false, error: 'Failed to record consent' });
    expect(recordCallEvent).toHaveBeenCalledWith(
      SESSION_UUID,
      'tool_call',
      expect.objectContaining({ errorCode: 'db_write_failed' }),
      expect.anything()
    );
  });

  it('test 14: catch block (updateLineVoiceConsent throws) — 500', async () => {
    vi.mocked(updateLineVoiceConsent).mockRejectedValue(new Error('DB error'));
    const res = createMockRes();
    await denyHandler({ body: baseBody } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ success: false, error: 'Failed to record consent' });
  });
});
