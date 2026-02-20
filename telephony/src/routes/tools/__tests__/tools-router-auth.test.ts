import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';

// ---------------------------------------------------------------------------
// Mock ALL service dependencies that any tool route imports (34 modules)
// This enables importing toolsRouter without triggering real module side effects
// ---------------------------------------------------------------------------

vi.mock('../../../server.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../services/call-session.js', () => ({
  getCallSession: vi.fn(),
  incrementToolInvocations: vi.fn(),
  recordCallEvent: vi.fn(),
  recordSafetyEvent: vi.fn(),
  updateSafetyEventSignals: vi.fn(),
  updateCallSession: vi.fn(),
  updateCallSessionRecording: vi.fn(),
  recordDebugEvent: vi.fn(),
  updateCallStatus: vi.fn(),
}));
vi.mock('../../../utils/supabase.js', () => ({
  getSupabaseClient: vi.fn(),
}));
vi.mock('../../../services/privacy.js', () => ({
  updateLineVoiceConsent: vi.fn(),
  getLineVoiceConsent: vi.fn(),
  getAccountPrivacySettings: vi.fn(),
  logConsentAuditEvent: vi.fn(),
}));
vi.mock('../../../services/memory.js', () => ({
  storeMemory: vi.fn(),
  updateMemory: vi.fn(),
  getMemoriesForLine: vi.fn(),
  forgetMemory: vi.fn(),
  hardDeleteMemoryByKey: vi.fn(),
  findFuzzyMatches: vi.fn(),
  searchMemoriesSemantic: vi.fn(),
  markMemoriesAccessed: vi.fn(),
  markMemoryPrivate: vi.fn(),
  logMemoryDeactivation: vi.fn(),
}));
vi.mock('../../../services/line-lookup.js', () => ({
  getLineById: vi.fn(),
  recordOptOut: vi.fn(),
}));
vi.mock('../../../services/cognitive-flags.js', () => ({
  updateCognitiveFlagsFromObservation: vi.fn(),
}));
vi.mock('../../../services/ephemeral-buffer.js', () => ({
  addStoredKey: vi.fn(),
  getBuffer: vi.fn(),
  createBuffer: vi.fn(),
  clearBuffer: vi.fn(),
  markConsentGranted: vi.fn(),
}));
vi.mock('../../../services/insight-state.js', () => ({
  addPrivateTopic: vi.fn(),
}));
vi.mock('../../../services/insights.js', () => ({
  storeCallInsights: vi.fn(),
  DuplicateInsightError: class extends Error {},
}));
vi.mock('../../../services/language.js', () => ({
  persistLanguageToLine: vi.fn(),
}));
vi.mock('../../../services/line-encryption.js', () => ({
  getMemoryDEK: vi.fn(),
}));
vi.mock('../../../services/rate-limit-config.js', () => ({
  RATE_LIMITS: { REMINDER_PER_SESSION: 10, REMINDER_PER_LINE: 50 },
}));
vi.mock('../../../services/rate-limiter.js', () => ({
  enforceRateLimit: vi.fn(),
}));
vi.mock('../../../services/routing-alerts.js', () => ({
  sendRoutingAlert: vi.fn(),
}));
vi.mock('../../../services/safety-classifier.js', () => ({
  buildContextWindow: vi.fn(),
  enqueueClassifierJob: vi.fn(),
}));
vi.mock('../../../services/safety-metrics.js', () => ({
  incrementNotificationsBlocked: vi.fn(),
}));
vi.mock('../../../services/safety-notifications.js', () => ({
  notifyPayerSafetyEmail: vi.fn(),
  notifyTrustedContacts: vi.fn(),
}));
vi.mock('../../../services/safety-state.js', () => ({
  markSafetyTier: vi.fn(),
  wasBackstopTriggered: vi.fn(),
}));
vi.mock('../../../services/safety-verifier.js', () => ({
  verifyHighTierEvent: vi.fn(),
}));
vi.mock('../../../services/topic-exclusions.js', () => ({
  excludeTopic: vi.fn(),
  includeTopic: vi.fn(),
  listTopicExclusions: vi.fn(),
  EXCLUSION_DISPLAY_NAMES: {},
}));
vi.mock('../../../utils/bytea.js', () => ({
  encodeBytea: vi.fn(),
}));
vi.mock('../../../utils/derived-artifact-minimizer.js', () => ({
  minimizeDerivedText: vi.fn((t: string) => t),
  minimizeDerivedOptionalText: vi.fn((t: string) => t),
  minimizeDerivedObjectDeep: vi.fn((o: any) => o),
}));
vi.mock('../../../utils/env.js', () => ({
  getInternalApiSecret: vi.fn(() => 'test-webhook-secret'),
  getPublicUrl: vi.fn(() => 'http://localhost:3000'),
}));
vi.mock('../../../utils/health-mention-crypto.js', () => ({
  encryptHealthMentionSummary: vi.fn(),
}));
vi.mock('../../../utils/life-chapter-crypto.js', () => ({
  encryptLifeChapterNarrative: vi.fn(),
}));
vi.mock('../../../utils/metrics.js', () => ({
  voiceRoutingIssuesTotal: { inc: vi.fn() },
}));
vi.mock('../../../utils/redact.js', () => ({
  redactPhone: vi.fn(),
}));
vi.mock('../../../utils/reminder-crypto.js', () => ({
  encryptReminderMessage: vi.fn(),
  decryptReminderMessagesWithDek: vi.fn(),
}));
vi.mock('../../../utils/search-tokens.js', () => ({
  buildReminderSearchTokens: vi.fn(),
}));
vi.mock('../../../utils/timezone.js', () => ({
  localToUtc: vi.fn(),
  validateTimezone: vi.fn(),
}));
vi.mock('../../../utils/twilio.js', () => ({
  startRecordingForCall: vi.fn(),
  stopRecordingForCall: vi.fn(),
}));
vi.mock('../../../utils/schedule-helpers.js', () => ({
  calculateNextRun: vi.fn(),
  getScheduleForTool: vi.fn(),
  normalizeTimeOfDay: vi.fn(),
  updateLineNextScheduledCallAt: vi.fn(),
}));
vi.mock('../../../websocket/grok-bridge-registry.js', () => ({
  getGrokBridge: vi.fn(),
}));
vi.mock('../memory-guard.js', () => ({
  enforceMemoryConsent: vi.fn(),
}));
vi.mock('../reminder-tool-helpers.js', () => ({
  enforceSessionLineMatch: vi.fn(),
  formatReminderSchedule: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { requireInternalSecret } from '../../../middleware/auth.js';
import { getInternalApiSecret } from '../../../utils/env.js';
import { toolsRouter } from '../index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createExpressApp() {
  const app = express();
  app.use(express.json());
  app.use('/tools', toolsRouter);
  return app;
}

function sendRequest(
  app: express.Express,
  path: string,
  headers: Record<string, string> = {},
  body: Record<string, unknown> = {}
): Promise<{ statusCode: number; body: any }> {
  return new Promise((resolve) => {
    const req: any = {
      method: 'POST',
      url: path,
      headers: { 'content-type': 'application/json', ...headers },
      body,
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      originalUrl: path,
      path,
      query: {},
      params: {},
      get: (name: string) => headers[name.toLowerCase()],
      is: () => 'application/json',
      on: vi.fn(),
      read: vi.fn(),
    };
    const res: any = {
      statusCode: 200,
      _headers: {} as Record<string, string>,
      status(code: number) { this.statusCode = code; return this; },
      json(payload: any) { this.body = payload; this._ended = true; resolve({ statusCode: this.statusCode, body: payload }); return this; },
      send(payload: any) { this.body = payload; this._ended = true; resolve({ statusCode: this.statusCode, body: payload }); return this; },
      setHeader(name: string, value: string) { this._headers[name] = value; },
      getHeader(name: string) { return this._headers[name]; },
      end() { if (!this._ended) resolve({ statusCode: this.statusCode, body: undefined }); },
      _ended: false,
    };

    app(req, res);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('requireInternalSecret middleware (unit)', () => {
  function createMockReq(headers: Record<string, string> = {}) {
    return {
      headers,
      ip: '127.0.0.1',
      originalUrl: '/tools/test',
      socket: { remoteAddress: '127.0.0.1' },
    } as any;
  }

  function createMockRes() {
    const res: any = {};
    res.statusCode = 200;
    res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
    res.json = vi.fn((payload: any) => { res.body = payload; return res; });
    return res;
  }

  it('rejects request without X-Webhook-Secret header (401)', () => {
    const req = createMockReq({});
    const res = createMockRes();
    const next = vi.fn();

    requireInternalSecret(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with wrong secret (401)', () => {
    const req = createMockReq({ 'x-webhook-secret': 'wrong-secret-value' });
    const res = createMockRes();
    const next = vi.fn();

    requireInternalSecret(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(next).not.toHaveBeenCalled();
  });

  it('allows request with correct secret (calls next)', () => {
    const req = createMockReq({ 'x-webhook-secret': 'test-webhook-secret' });
    const res = createMockRes();
    const next = vi.fn();

    requireInternalSecret(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects same-length but incorrect secret (timing-safe comparison)', () => {
    const sameLength = 'x'.repeat('test-webhook-secret'.length);
    const req = createMockReq({ 'x-webhook-secret': sameLength });
    const res = createMockRes();
    const next = vi.fn();

    requireInternalSecret(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when internal secret is not configured (getInternalApiSecret throws)', () => {
    vi.mocked(getInternalApiSecret).mockImplementationOnce(() => { throw new Error('Missing env'); });
    const req = createMockReq({ 'x-webhook-secret': 'test-webhook-secret' });
    const res = createMockRes();
    const next = vi.fn();

    requireInternalSecret(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ error: 'Server misconfigured' });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('toolsRouter integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requireInternalSecret is mounted as the first middleware on toolsRouter', () => {
    const stack = (toolsRouter as any).stack;
    expect(stack.length).toBeGreaterThan(0);

    // First layer should be the non-route middleware (requireInternalSecret)
    const firstLayer = stack[0];
    expect(firstLayer.route).toBeUndefined();
    expect(firstLayer.handle).toBe(requireInternalSecret);
  });

  it('rejects requests without valid secret when routed through toolsRouter', async () => {
    const app = createExpressApp();
    const result = await sendRequest(app, '/tools/safety_event', {}, { callSessionId: 'test' });

    expect(result.statusCode).toBe(401);
    expect(result.body.error).toBe('Unauthorized');
  });

  it('passes requests with valid secret through to tool handlers via toolsRouter', async () => {
    const app = createExpressApp();
    // With a valid secret, the request should pass through the middleware
    // and reach the actual tool handler (which will return its own response)
    const result = await sendRequest(
      app,
      '/tools/safety_event',
      { 'x-webhook-secret': 'test-webhook-secret' },
      { callSessionId: 'test' }
    );

    // Should NOT be 401 — the middleware passed it through
    expect(result.statusCode).not.toBe(401);
  });
});
