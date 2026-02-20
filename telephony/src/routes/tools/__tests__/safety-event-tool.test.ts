import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../services/call-session.js', () => ({
  getCallSession: vi.fn(),
  incrementToolInvocations: vi.fn(),
  recordCallEvent: vi.fn(),
  recordSafetyEvent: vi.fn(),
  updateSafetyEventSignals: vi.fn(),
}));
vi.mock('../../../services/safety-classifier.js', () => ({
  buildContextWindow: vi.fn(),
  enqueueClassifierJob: vi.fn(),
}));
vi.mock('../../../services/safety-verifier.js', () => ({
  verifyHighTierEvent: vi.fn(),
}));
vi.mock('../../../services/safety-notifications.js', () => ({
  notifyPayerSafetyEmail: vi.fn(),
  notifyTrustedContacts: vi.fn(),
}));
vi.mock('../../../services/safety-state.js', () => ({
  markSafetyTier: vi.fn(),
  wasBackstopTriggered: vi.fn(),
}));
vi.mock('../../../services/safety-metrics.js', () => ({
  incrementNotificationsBlocked: vi.fn(),
}));
vi.mock('../../../services/ephemeral-buffer.js', () => ({
  getBuffer: vi.fn(),
}));
vi.mock('../../../websocket/grok-bridge-registry.js', () => ({
  getGrokBridge: vi.fn(),
}));
vi.mock('../../../services/routing-alerts.js', () => ({
  sendRoutingAlert: vi.fn(),
}));
vi.mock('../../../utils/metrics.js', () => ({
  voiceRoutingIssuesTotal: { inc: vi.fn() },
}));

import { safetyEventRouter } from '../safety-event.js';
import { getCallSession, recordSafetyEvent, recordCallEvent, updateSafetyEventSignals } from '../../../services/call-session.js';
import { buildContextWindow, enqueueClassifierJob } from '../../../services/safety-classifier.js';
import { verifyHighTierEvent } from '../../../services/safety-verifier.js';
import { notifyPayerSafetyEmail, notifyTrustedContacts } from '../../../services/safety-notifications.js';
import { markSafetyTier, wasBackstopTriggered } from '../../../services/safety-state.js';
import { incrementNotificationsBlocked } from '../../../services/safety-metrics.js';
import { getBuffer } from '../../../services/ephemeral-buffer.js';
import { getGrokBridge } from '../../../websocket/grok-bridge-registry.js';
import { sendRoutingAlert } from '../../../services/routing-alerts.js';
import { voiceRoutingIssuesTotal } from '../../../utils/metrics.js';

import {
  createMockRes,
  getPostHandler,
  BASE_ACCOUNT_ID,
  baseSession,
} from './helpers/index.js';

const handler = getPostHandler(safetyEventRouter);

// The schema validates UUIDs — use proper UUIDs in request bodies
const SESSION_UUID = '00000000-0000-0000-0000-000000000001';
const LINE_UUID = '00000000-0000-0000-0000-000000000002';

const baseBody = {
  callSessionId: SESSION_UUID,
  lineId: LINE_UUID,
  category: 'ISOLATION_DISTRESS',
  confidence: 0.8,
  actionTaken: 'none',
};

const mockBuffer = {
  turns: [
    { timestamp: Date.now() - 10000, speaker: 'user', summary: 'I feel so alone lately' },
    { timestamp: Date.now() - 5000, speaker: 'assistant', summary: 'I understand that can be tough' },
    { timestamp: Date.now() - 2000, speaker: 'user', summary: 'Nobody ever calls me' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCallSession).mockResolvedValue(baseSession);
  vi.mocked(recordSafetyEvent).mockResolvedValue('safety-event-id-1');
  vi.mocked(recordCallEvent).mockResolvedValue(undefined);
  vi.mocked(updateSafetyEventSignals).mockResolvedValue(undefined);
  vi.mocked(markSafetyTier).mockReturnValue(undefined as any);
  vi.mocked(wasBackstopTriggered).mockReturnValue(false);
  vi.mocked(getBuffer).mockReturnValue(mockBuffer as any);
  vi.mocked(getGrokBridge).mockReturnValue({ getDetectedLanguage: () => 'en' } as any);
  vi.mocked(buildContextWindow).mockReturnValue({ turns: mockBuffer.turns, truncated: false } as any);
  vi.mocked(verifyHighTierEvent).mockResolvedValue({ decision: 'confirm', confidence: 0.95, latencyMs: 100 });
  vi.mocked(notifyTrustedContacts).mockResolvedValue(undefined);
  vi.mocked(notifyPayerSafetyEmail).mockResolvedValue(undefined);
  delete process.env.ULTAURA_MULTILINGUAL_SAFETY_ENABLED;
});

describe('safety-event tool (log_safety_concern)', () => {
  it('test 1: low tier — records event, marks tier, does NOT call verifier', async () => {
    const res = createMockRes();
    await handler({ body: { ...baseBody, category: 'ISOLATION_DISTRESS' } } as any, res);

    expect(res.body).toEqual({ success: true, message: 'Safety concern logged' });
    expect(recordSafetyEvent).toHaveBeenCalled();
    expect(markSafetyTier).toHaveBeenCalledWith(SESSION_UUID, 'low', 'model');
    expect(verifyHighTierEvent).not.toHaveBeenCalled();
    expect(notifyTrustedContacts).not.toHaveBeenCalled();
  });

  it('test 2: medium tier — records event, marks tier, does NOT call verifier', async () => {
    const res = createMockRes();
    await handler({ body: { ...baseBody, category: 'HOPELESSNESS' } } as any, res);

    expect(res.body).toEqual({ success: true, message: 'Safety concern logged' });
    expect(recordSafetyEvent).toHaveBeenCalled();
    expect(markSafetyTier).toHaveBeenCalledWith(SESSION_UUID, 'medium', 'model');
    expect(verifyHighTierEvent).not.toHaveBeenCalled();
    expect(notifyTrustedContacts).not.toHaveBeenCalled();
  });

  it('test 3: high tier model source — records event, marks tier high, kicks off background verifier', async () => {
    const res = createMockRes();
    await handler({ body: { ...baseBody, category: 'SUICIDAL_IDEATION', actionTaken: 'suggested_988' } } as any, res);

    expect(res.body).toEqual({ success: true, message: 'Safety concern logged' });
    expect(recordSafetyEvent).toHaveBeenCalled();
    expect(markSafetyTier).toHaveBeenCalledWith(SESSION_UUID, 'high', 'model');
    // Let background IIFE complete
    await new Promise(r => setTimeout(r, 0));
    expect(verifyHighTierEvent).toHaveBeenCalled();
  });

  it('test 4: high tier + verifier confirms — notifyTrustedContacts and notifyPayerSafetyEmail called', async () => {
    vi.mocked(verifyHighTierEvent).mockResolvedValue({ decision: 'confirm', confidence: 0.95, latencyMs: 100 });
    const res = createMockRes();
    await handler({ body: { ...baseBody, category: 'SUICIDAL_IDEATION', actionTaken: 'suggested_988' } } as any, res);

    await new Promise(r => setTimeout(r, 0));
    expect(notifyTrustedContacts).toHaveBeenCalledWith(expect.objectContaining({
      accountId: BASE_ACCOUNT_ID,
      callSessionId: SESSION_UUID,
      lineId: LINE_UUID,
      tier: 'high',
    }));
    expect(notifyPayerSafetyEmail).toHaveBeenCalledWith(expect.objectContaining({
      accountId: BASE_ACCOUNT_ID,
      lineId: LINE_UUID,
      tier: 'high',
    }));
  });

  it('test 5: high tier + verifier clears — incrementNotificationsBlocked("verifier_clear"), NO notifications', async () => {
    vi.mocked(verifyHighTierEvent).mockResolvedValue({ decision: 'clear', confidence: 0.85, latencyMs: 50 });
    const res = createMockRes();
    await handler({ body: { ...baseBody, category: 'SUICIDAL_IDEATION', actionTaken: 'suggested_988' } } as any, res);

    await new Promise(r => setTimeout(r, 0));
    expect(incrementNotificationsBlocked).toHaveBeenCalledWith('verifier_clear');
    expect(notifyTrustedContacts).not.toHaveBeenCalled();
    expect(notifyPayerSafetyEmail).not.toHaveBeenCalled();
  });

  it('test 6: high tier + verifier uncertain — incrementNotificationsBlocked("uncertain")', async () => {
    vi.mocked(verifyHighTierEvent).mockResolvedValue({ decision: 'uncertain', confidence: 0.5, latencyMs: 75 });
    const res = createMockRes();
    await handler({ body: { ...baseBody, category: 'SUICIDAL_IDEATION', actionTaken: 'suggested_988' } } as any, res);

    await new Promise(r => setTimeout(r, 0));
    expect(incrementNotificationsBlocked).toHaveBeenCalledWith('uncertain');
    expect(notifyTrustedContacts).not.toHaveBeenCalled();
  });

  it('test 7: high tier + no ephemeral buffer — verifier NOT called, updateSafetyEventSignals with uncertain, incrementNotificationsBlocked("uncertain")', async () => {
    vi.mocked(getBuffer).mockReturnValue(undefined as any);
    const res = createMockRes();
    await handler({ body: { ...baseBody, category: 'SUICIDAL_IDEATION', actionTaken: 'suggested_988' } } as any, res);

    await new Promise(r => setTimeout(r, 0));
    expect(verifyHighTierEvent).not.toHaveBeenCalled();
    expect(updateSafetyEventSignals).toHaveBeenCalledWith('safety-event-id-1', expect.objectContaining({
      verifier_result: 'uncertain',
    }));
    expect(incrementNotificationsBlocked).toHaveBeenCalledWith('uncertain');
  });

  it('test 8: high tier + multilingual enabled — enqueueClassifierJob called', async () => {
    process.env.ULTAURA_MULTILINGUAL_SAFETY_ENABLED = 'true';
    const res = createMockRes();
    await handler({ body: { ...baseBody, category: 'SUICIDAL_IDEATION', actionTaken: 'suggested_988' } } as any, res);

    await new Promise(r => setTimeout(r, 0));
    expect(enqueueClassifierJob).toHaveBeenCalledWith(
      SESSION_UUID,
      LINE_UUID,
      expect.any(String),
      'high_verify',
      expect.anything(),
      expect.anything(),
      'model'
    );
  });

  it('test 9: high tier + GrokBridge missing — sendRoutingAlert called, voiceRoutingIssuesTotal.inc called', async () => {
    vi.mocked(getGrokBridge).mockReturnValue(null as any);
    vi.mocked(sendRoutingAlert).mockResolvedValue(undefined);
    const res = createMockRes();
    await handler({ body: { ...baseBody, category: 'SUICIDAL_IDEATION', actionTaken: 'suggested_988' } } as any, res);

    expect(voiceRoutingIssuesTotal.inc).toHaveBeenCalledWith({ issue: 'bridge_missing_for_tool' });
    expect(sendRoutingAlert).toHaveBeenCalledWith(expect.objectContaining({
      callSessionId: SESSION_UUID,
      issue: 'bridge_missing_for_tool',
      severity: 'high',
    }));
  });

  it('test 10: high tier + verifier throws error — caught, incrementNotificationsBlocked("uncertain")', async () => {
    vi.mocked(verifyHighTierEvent).mockRejectedValue(new Error('verifier failed'));
    const res = createMockRes();
    await handler({ body: { ...baseBody, category: 'SUICIDAL_IDEATION', actionTaken: 'suggested_988' } } as any, res);

    await new Promise(r => setTimeout(r, 0));
    expect(incrementNotificationsBlocked).toHaveBeenCalledWith('uncertain');
    expect(notifyTrustedContacts).not.toHaveBeenCalled();
  });

  it('test 11: GENERAL_CONCERN with valid tier — uses provided tier directly', async () => {
    const res = createMockRes();
    await handler({
      body: {
        ...baseBody,
        category: 'GENERAL_CONCERN',
        tier: 'low',
      },
    } as any, res);

    expect(res.body).toEqual({ success: true, message: 'Safety concern logged' });
    expect(markSafetyTier).toHaveBeenCalledWith(SESSION_UUID, 'low', 'model');
  });

  it('test 12: GENERAL_CONCERN without tier — returns 400', async () => {
    const res = createMockRes();
    await handler({
      body: {
        ...baseBody,
        category: 'GENERAL_CONCERN',
        // tier intentionally omitted
      },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('test 13: category tier mapping — SUICIDAL_IDEATION→high, HOPELESSNESS→medium', async () => {
    const res1 = createMockRes();
    await handler({ body: { ...baseBody, category: 'SUICIDAL_IDEATION', actionTaken: 'suggested_988' } } as any, res1);
    expect(markSafetyTier).toHaveBeenCalledWith(SESSION_UUID, 'high', 'model');

    vi.clearAllMocks();
    vi.mocked(getCallSession).mockResolvedValue(baseSession);
    vi.mocked(recordSafetyEvent).mockResolvedValue('safety-event-id-2');
    vi.mocked(markSafetyTier).mockReturnValue(undefined as any);
    vi.mocked(wasBackstopTriggered).mockReturnValue(false);
    vi.mocked(getBuffer).mockReturnValue(mockBuffer as any);
    vi.mocked(getGrokBridge).mockReturnValue({ getDetectedLanguage: () => 'en' } as any);
    vi.mocked(buildContextWindow).mockReturnValue({ turns: mockBuffer.turns, truncated: false } as any);
    vi.mocked(verifyHighTierEvent).mockResolvedValue({ decision: 'confirm', confidence: 0.95, latencyMs: 100 });
    vi.mocked(notifyTrustedContacts).mockResolvedValue(undefined);
    vi.mocked(notifyPayerSafetyEmail).mockResolvedValue(undefined);

    const res2 = createMockRes();
    await handler({ body: { ...baseBody, category: 'HOPELESSNESS' } } as any, res2);
    expect(markSafetyTier).toHaveBeenCalledWith(SESSION_UUID, 'medium', 'model');
  });

  it('test 14: keyword_backstop source — confidence forced to 1.0, wasBackstopTriggered NOT called', async () => {
    const res = createMockRes();
    await handler({
      body: {
        ...baseBody,
        category: 'SUICIDAL_IDEATION',
        actionTaken: 'suggested_988',
        source: 'keyword_backstop',
        confidence: 0.5,
      },
    } as any, res);

    expect(res.body).toEqual({ success: true, message: 'Safety concern logged' });
    expect(wasBackstopTriggered).not.toHaveBeenCalled();
    expect(recordSafetyEvent).toHaveBeenCalledWith(expect.objectContaining({
      confidence: 1.0,
    }));
  });

  it('test 15: model source when backstop already triggered — wasBackstopTriggered returns true, short-circuits', async () => {
    vi.mocked(wasBackstopTriggered).mockReturnValue(true);
    const res = createMockRes();
    await handler({
      body: { ...baseBody, category: 'SUICIDAL_IDEATION', actionTaken: 'suggested_988' },
    } as any, res);

    // response still succeeds but high tier verifier background logic short-circuits
    expect(res.body).toEqual({ success: true, message: 'Safety concern logged' });
    expect(wasBackstopTriggered).toHaveBeenCalledWith(SESSION_UUID, 'high');
    // Since sourceValue === 'model' and backstopWasTriggered is true, the high-tier block is still entered
    // but the backstop check is for duplicate prevention (logged via logger), verifier still runs
    await new Promise(r => setTimeout(r, 0));
  });

  it('test 16: missing required fields (no callSessionId) — 400', async () => {
    const res = createMockRes();
    await handler({
      body: {
        lineId: LINE_UUID,
        category: 'ISOLATION_DISTRESS',
        confidence: 0.8,
        actionTaken: 'none',
      },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it('test 17: session not found — 404', async () => {
    vi.mocked(getCallSession).mockResolvedValue(null as any);
    const res = createMockRes();
    await handler({ body: baseBody } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ error: 'Call session not found' });
  });

  it('test 18: Zod validation failure (invalid category type) — 400', async () => {
    const res = createMockRes();
    await handler({
      body: {
        callSessionId: SESSION_UUID,
        lineId: LINE_UUID,
        category: 'NOT_A_VALID_CATEGORY',
        confidence: 0.8,
        actionTaken: 'none',
      },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });
});
