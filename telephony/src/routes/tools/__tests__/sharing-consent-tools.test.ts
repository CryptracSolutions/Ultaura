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
  getLineVoiceConsent: vi.fn(),
  updateLineVoiceConsent: vi.fn(),
  logConsentAuditEvent: vi.fn(),
}));
vi.mock('../../../utils/supabase.js', () => ({
  getSupabaseClient: vi.fn(),
}));

import { sharingConsentRouter } from '../sharing-consent.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../../services/call-session.js';
import { getLineVoiceConsent, updateLineVoiceConsent, logConsentAuditEvent } from '../../../services/privacy.js';
import { getSupabaseClient } from '../../../utils/supabase.js';
import {
  createMockRes,
  getPostHandler,
  BASE_ACCOUNT_ID,
  baseSession,
  createSupabaseMock,
} from './helpers/index.js';

const SESSION_UUID = '00000000-0000-0000-0000-000000000001';
const LINE_UUID = baseSession.line_id;

const setTierHandler = getPostHandler(sharingConsentRouter, '/set_sharing_tier');
const getTierHandler = getPostHandler(sharingConsentRouter, '/get_sharing_tier');
const enableFamilyHandler = getPostHandler(sharingConsentRouter, '/enable_family_sharing');

const baseBody = {
  callSessionId: SESSION_UUID,
  lineId: LINE_UUID,
};

const mockAccount = {
  id: BASE_ACCOUNT_ID,
  user_type: 'self',
  sharing_enabled: false,
  sharing_enabled_at: null,
};

let supabaseMock: ReturnType<typeof createSupabaseMock>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCallSession).mockResolvedValue(baseSession);
  vi.mocked(updateLineVoiceConsent).mockResolvedValue(true as any);
  vi.mocked(incrementToolInvocations).mockResolvedValue(undefined);
  vi.mocked(recordCallEvent).mockResolvedValue(undefined);
  vi.mocked(logConsentAuditEvent).mockResolvedValue(undefined);
  vi.mocked(getLineVoiceConsent).mockResolvedValue({
    sharingTier: 'tier_1',
    sharingConsent: 'denied',
  } as any);
  supabaseMock = createSupabaseMock();
  supabaseMock.__state.singleResult = { data: mockAccount, error: null };
  vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
});

describe('set_sharing_tier', () => {
  it('test 1: happy path tier_2 with consent=granted', async () => {
    const res = createMockRes();
    await setTierHandler({
      body: { ...baseBody, tier: 'tier_2', consent: 'granted' },
    } as any, res);

    expect(updateLineVoiceConsent).toHaveBeenCalledWith(
      LINE_UUID, BASE_ACCOUNT_ID, SESSION_UUID,
      expect.objectContaining({ sharingConsent: 'granted', sharingTier: 'tier_2' }),
      expect.objectContaining({ skipPersist: false })
    );
    expect(res.body).toEqual({ success: true, message: 'Sharing preference updated.' });
  });

  it('test 2: denied consent forces tier_1', async () => {
    const res = createMockRes();
    await setTierHandler({
      body: { ...baseBody, tier: 'tier_3', consent: 'denied' },
    } as any, res);

    expect(updateLineVoiceConsent).toHaveBeenCalledWith(
      LINE_UUID, BASE_ACCOUNT_ID, SESSION_UUID,
      expect.objectContaining({ sharingConsent: 'denied', sharingTier: 'tier_1' }),
      expect.anything()
    );
    expect(res.body).toMatchObject({ success: true });
  });

  it('test 3: invalid tier — 400', async () => {
    const res = createMockRes();
    await setTierHandler({
      body: { ...baseBody, tier: 'tier_99' },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ success: false, error: 'Invalid tier' });
  });

  it('test 4: missing tier — 400', async () => {
    const res = createMockRes();
    await setTierHandler({ body: baseBody } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ success: false, error: 'Missing required fields' });
  });

  it('test 5: line mismatch — 403', async () => {
    const res = createMockRes();
    await setTierHandler({
      body: { callSessionId: SESSION_UUID, lineId: 'wrong-line-id', tier: 'tier_1' },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({ success: false, error: 'Unauthorized' });
    expect(recordCallEvent).toHaveBeenCalledWith(
      SESSION_UUID, 'tool_call',
      expect.objectContaining({ errorCode: 'unauthorized' }),
      expect.anything()
    );
  });

  it('test 6: test call — skipPersist=true', async () => {
    vi.mocked(getCallSession).mockResolvedValue({ ...baseSession, is_test_call: true });
    const res = createMockRes();
    await setTierHandler({
      body: { ...baseBody, tier: 'tier_2', consent: 'granted' },
    } as any, res);

    expect(updateLineVoiceConsent).toHaveBeenCalledWith(
      LINE_UUID, BASE_ACCOUNT_ID, SESSION_UUID,
      expect.anything(),
      expect.objectContaining({ skipPersist: true })
    );
    expect(res.body).toMatchObject({ success: true });
  });

  it('test 7: DB write failure — 500', async () => {
    vi.mocked(updateLineVoiceConsent).mockResolvedValue(false as any);
    const res = createMockRes();
    await setTierHandler({
      body: { ...baseBody, tier: 'tier_2', consent: 'granted' },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ success: false, error: 'Failed to update sharing preference' });
    expect(recordCallEvent).toHaveBeenCalledWith(
      SESSION_UUID, 'tool_call',
      expect.objectContaining({ errorCode: 'db_write_failed' }),
      expect.anything()
    );
  });
});

describe('get_sharing_tier', () => {
  it('test 8: happy path — returns tier and consent', async () => {
    vi.mocked(getLineVoiceConsent).mockResolvedValue({
      sharingTier: 'tier_2',
      sharingConsent: 'granted',
    } as any);
    const res = createMockRes();
    await getTierHandler({ body: baseBody } as any, res);

    expect(res.body).toEqual({
      success: true,
      tier: 'tier_2',
      consent: 'granted',
    });
  });

  it('test 9: missing fields — 400', async () => {
    const res = createMockRes();
    await getTierHandler({ body: { callSessionId: SESSION_UUID } } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ success: false, error: 'Missing required fields' });
  });

  it('test 10: session not found — 404', async () => {
    vi.mocked(getCallSession).mockResolvedValue(null as any);
    const res = createMockRes();
    await getTierHandler({ body: baseBody } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ success: false, error: 'Call session not found' });
  });

  it('test 11: line mismatch — 403', async () => {
    const res = createMockRes();
    await getTierHandler({
      body: { callSessionId: SESSION_UUID, lineId: 'wrong-line-id' },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('test 12: consent record not found — 404', async () => {
    vi.mocked(getLineVoiceConsent).mockResolvedValue(null as any);
    const res = createMockRes();
    await getTierHandler({ body: baseBody } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ success: false, error: 'Consent record not found' });
  });
});

describe('enable_family_sharing', () => {
  it('test 13: happy path — self user_type — account updated, consent set to pending, audit logged', async () => {
    const res = createMockRes();
    await enableFamilyHandler({ body: baseBody } as any, res);

    expect(supabaseMock.__state.updates.some(u => u.table === 'ultaura_accounts')).toBe(true);
    const accountUpdate = supabaseMock.__state.updates.find(u => u.table === 'ultaura_accounts');
    expect(accountUpdate?.payload).toMatchObject({ sharing_enabled: true });

    expect(updateLineVoiceConsent).toHaveBeenCalledWith(
      LINE_UUID, BASE_ACCOUNT_ID, SESSION_UUID,
      expect.objectContaining({ sharingConsent: 'pending' }),
      expect.objectContaining({ skipPersist: false })
    );
    expect(logConsentAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'sharing_enabled_by_self_user',
      consentType: 'data_sharing',
    }));
    expect(res.body).toEqual({
      success: true,
      message: 'Family sharing enabled. Ask for tier preference next.',
    });
  });

  it('test 14: non-self user_type — 400', async () => {
    supabaseMock.__state.singleResult = {
      data: { ...mockAccount, user_type: 'family' },
      error: null,
    };
    const res = createMockRes();
    await enableFamilyHandler({ body: baseBody } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ success: false, error: 'Sharing is already managed by family.' });
    expect(recordCallEvent).toHaveBeenCalledWith(
      SESSION_UUID, 'tool_call',
      expect.objectContaining({ errorCode: 'invalid_user_type' }),
      expect.anything()
    );
  });

  it('test 15: account not found — 404', async () => {
    supabaseMock.__state.singleResult = { data: null, error: { message: 'Not found' } };
    const res = createMockRes();
    await enableFamilyHandler({ body: baseBody } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ success: false, error: 'Account not found' });
    expect(recordCallEvent).toHaveBeenCalledWith(
      SESSION_UUID, 'tool_call',
      expect.objectContaining({ errorCode: 'account_not_found' }),
      expect.anything()
    );
  });

  it('test 16: missing fields — 400', async () => {
    const res = createMockRes();
    await enableFamilyHandler({ body: { callSessionId: SESSION_UUID } } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ success: false, error: 'Missing required fields' });
  });

  it('test 17: line mismatch — 403', async () => {
    const res = createMockRes();
    await enableFamilyHandler({
      body: { callSessionId: SESSION_UUID, lineId: 'wrong-line-id' },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('test 18: test call — skipPersist=true, no supabase writes, returns success', async () => {
    vi.mocked(getCallSession).mockResolvedValue({ ...baseSession, is_test_call: true });
    const res = createMockRes();
    await enableFamilyHandler({ body: baseBody } as any, res);

    expect(supabaseMock.__state.updates.filter(u => u.table === 'ultaura_accounts')).toHaveLength(0);
    expect(updateLineVoiceConsent).not.toHaveBeenCalled();
    expect(logConsentAuditEvent).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ success: true });
  });

  it('test 19: account update failure — 500', async () => {
    // Use counter-based supabase mock so the awaited update resolves with an error
    const errorMock = createSupabaseMock({
      // first call to ultaura_accounts is the .single() read in getAccountSharing
      ultaura_accounts: [
        { data: mockAccount, error: null },
        // second call is the update — resolves with an error
        { data: null, error: { message: 'DB error' } },
      ],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(errorMock as any);

    const res = createMockRes();
    await enableFamilyHandler({ body: baseBody } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ success: false, error: 'Failed to enable sharing' });
    expect(recordCallEvent).toHaveBeenCalledWith(
      SESSION_UUID, 'tool_call',
      expect.objectContaining({ errorCode: 'update_failed' }),
      expect.anything()
    );
  });

  it('test 20: consent update failure (updateLineVoiceConsent returns false) — 500', async () => {
    vi.mocked(updateLineVoiceConsent).mockResolvedValue(false as any);
    const res = createMockRes();
    await enableFamilyHandler({ body: baseBody } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ success: false, error: 'Failed to update sharing consent' });
    expect(recordCallEvent).toHaveBeenCalledWith(
      SESSION_UUID, 'tool_call',
      expect.objectContaining({ errorCode: 'db_write_failed' }),
      expect.anything()
    );
  });
});
