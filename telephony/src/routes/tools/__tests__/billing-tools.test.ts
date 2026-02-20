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
  recordCallEvent: vi.fn(),
}));
vi.mock('../../../utils/env.js', () => ({
  getInternalApiSecret: vi.fn(() => 'test-secret'),
}));
vi.mock('../../../services/line-lookup.js', () => ({
  getLineById: vi.fn(),
  recordOptOut: vi.fn(),
}));
vi.mock('../../../services/rate-limiter.js', () => ({
  enforceRateLimit: vi.fn(),
}));
vi.mock('../../../utils/redact.js', () => ({
  redactPhone: vi.fn((_p: string) => 'XXX-XXXX'),
}));

import { overageActionRouter } from '../overage-action.js';
import { optOutRouter } from '../opt-out.js';
import { requestUpgradeRouter } from '../request-upgrade.js';
import { getCallSession } from '../../../services/call-session.js';
import { getLineById, recordOptOut } from '../../../services/line-lookup.js';
import { enforceRateLimit } from '../../../services/rate-limiter.js';
import { createMockRes, getPostHandler } from './helpers/index.js';

const SESSION_ID = '11111111-1111-1111-1111-111111111111';
const LINE_ID = '22222222-2222-2222-2222-222222222222';

const overageHandler = getPostHandler(overageActionRouter);
const optOutHandler = getPostHandler(optOutRouter);
const upgradeHandler = getPostHandler(requestUpgradeRouter);

const baseSession = {
  id: SESSION_ID,
  account_id: 'acct-1',
  line_id: LINE_ID,
  status: 'in_progress',
};

const baseLine = {
  id: LINE_ID,
  account_id: 'acct-1',
  phone_e164: '+15551234567',
  timezone: 'America/New_York',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCallSession).mockResolvedValue(baseSession as any);
  vi.mocked(getLineById).mockResolvedValue({ line: baseLine, account: { id: 'acct-1' } } as any);
  vi.mocked(enforceRateLimit).mockResolvedValue({ allowed: true } as any);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── choose_overage_action ────────────────────────────────────────────────────

describe('choose_overage_action', () => {
  it('continue action: returns success with continue message', async () => {
    const res = createMockRes();
    await overageHandler({
      body: { callSessionId: SESSION_ID, action: 'continue' },
    } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('continue');
  });

  it('stop action: returns success with stop message', async () => {
    const res = createMockRes();
    await overageHandler({
      body: { callSessionId: SESSION_ID, action: 'stop' },
    } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('stop');
  });

  it('upgrade action with valid planId: calls upgrade API via fetch', async () => {
    const res = createMockRes();
    await overageHandler({
      body: { callSessionId: SESSION_ID, action: 'upgrade', planId: 'care' },
    } as any, res);

    expect(res.body.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/telephony/upgrade'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('upgrade action with invalid planId: returns 400', async () => {
    const res = createMockRes();
    await overageHandler({
      body: { callSessionId: SESSION_ID, action: 'upgrade', planId: 'enterprise' },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toContain('Invalid planId');
  });

  it('upgrade action missing planId: returns 400', async () => {
    const res = createMockRes();
    await overageHandler({
      body: { callSessionId: SESSION_ID, action: 'upgrade' },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toContain('Missing planId');
  });

  it('missing action: returns 400', async () => {
    const res = createMockRes();
    await overageHandler({
      body: { callSessionId: SESSION_ID },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toContain('Missing required fields');
  });

  it('session not found: returns 404', async () => {
    vi.mocked(getCallSession).mockResolvedValue(null as any);

    const res = createMockRes();
    await overageHandler({
      body: { callSessionId: SESSION_ID, action: 'continue' },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body.error).toContain('Call session not found');
  });
});

// ─── request_opt_out ──────────────────────────────────────────────────────────

describe('request_opt_out', () => {
  it('happy path: records opt-out and returns success', async () => {
    vi.mocked(recordOptOut).mockResolvedValue(undefined);

    const res = createMockRes();
    await optOutHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, source: 'voice' },
    } as any, res);

    expect(res.body.success).toBe(true);
    expect(recordOptOut).toHaveBeenCalledWith('acct-1', LINE_ID, SESSION_ID, 'voice');
  });

  it('returns 400 when missing lineId', async () => {
    const res = createMockRes();
    await optOutHandler({
      body: { callSessionId: SESSION_ID },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 404 when session not found', async () => {
    vi.mocked(getCallSession).mockResolvedValue(null as any);

    const res = createMockRes();
    await optOutHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, source: 'voice' },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body.error).toContain('Call session not found');
  });

  it('returns 400 on Zod validation failure (invalid source)', async () => {
    const res = createMockRes();
    await optOutHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, source: 'invalid_source_xyz' },
    } as any, res);

    // Zod will reject invalid source value
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns success with default source when source is not provided', async () => {
    vi.mocked(recordOptOut).mockResolvedValue(undefined);

    const res = createMockRes();
    await optOutHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID },
    } as any, res);

    expect(res.body.success).toBe(true);
    expect(recordOptOut).toHaveBeenCalledWith('acct-1', LINE_ID, SESSION_ID, 'voice');
  });
});

// ─── request_upgrade ──────────────────────────────────────────────────────────

describe('request_upgrade', () => {
  it('no planId: returns plan list', async () => {
    const res = createMockRes();
    await upgradeHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID },
    } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Care');
    expect(res.body.message).toContain('Comfort');
  });

  it('planId without sendLink: returns confirmation prompt', async () => {
    const res = createMockRes();
    await upgradeHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, planId: 'comfort' },
    } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Confirm');
    expect(res.body.message).toContain('send_link');
  });

  it('planId + sendLink=true: sends link via fetch, returns emailSent+smsSent', async () => {
    const res = createMockRes();
    await upgradeHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, planId: 'care', sendLink: true },
    } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.emailSent).toBe(true);
    expect(res.body.smsSent).toBe(true);
    expect(fetch).toHaveBeenCalled();
  });

  it('SMS rate limited: sends email only, smsSkipped set', async () => {
    vi.mocked(enforceRateLimit).mockResolvedValue({ allowed: false } as any);

    const res = createMockRes();
    await upgradeHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, planId: 'care', sendLink: true },
    } as any, res);

    expect(res.body.success).toBe(true);
    expect(res.body.emailSent).toBe(true);
    expect(res.body.smsSent).toBe(false);
    expect(res.body.smsSkipped).toBe('daily_limit_reached');
  });

  it('invalid planId: returns 400', async () => {
    const res = createMockRes();
    await upgradeHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, planId: 'enterprise' as any },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toContain('Invalid plan');
  });

  it('missing callSessionId: returns 400', async () => {
    const res = createMockRes();
    await upgradeHandler({
      body: { lineId: LINE_ID, planId: 'care' },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toContain('Missing callSessionId');
  });

  it('line not found: returns 404', async () => {
    vi.mocked(getLineById).mockResolvedValue(null as any);

    const res = createMockRes();
    await upgradeHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, planId: 'care', sendLink: true },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body.error).toContain('Line not found');
  });

  it('fetch failure: returns 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: 'Internal error' }),
    }));

    const res = createMockRes();
    await upgradeHandler({
      body: { callSessionId: SESSION_ID, lineId: LINE_ID, planId: 'care', sendLink: true },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body.error).toContain('Failed to send upgrade link');
  });
});
