import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  lastSessionUpdate as sharedLastSessionUpdate,
  toolNamesFromSessionUpdate as sharedToolNamesFromSessionUpdate,
  waitFor as sharedWaitFor,
  waitForFakeTimer as sharedWaitForFakeTimer,
  simulateToolCall as sharedSimulateToolCall,
  allFetchUrls as sharedAllFetchUrls,
  fetchCallsMatching as sharedFetchCallsMatching,
  parsedBody as sharedParsedBody,
  emitTwilioStart as sharedEmitTwilioStart,
  findGrokSocketAsync as sharedFindGrokSocketAsync,
} from './helpers/fake-websocket.js';

// ---------------------------------------------------------------------------
// Hoisted FakeWebSocket (must be defined before any vi.mock calls)
// ---------------------------------------------------------------------------

const { FakeWebSocketClass } = vi.hoisted(() => {
  type Listener = (...args: any[]) => any;

  class FakeWebSocket {
    static OPEN = 1;
    static CLOSED = 3;
    static instances: FakeWebSocket[] = [];

    readyState = FakeWebSocket.OPEN;
    sent: string[] = [];
    url?: string;
    options?: any;

    private listeners = new Map<string, Set<Listener>>();

    constructor(url?: string, options?: any) {
      this.url = url;
      this.options = options;
      FakeWebSocket.instances.push(this);
      if (url && url.startsWith('ws')) {
        queueMicrotask(() => this.emit('open'));
      }
    }

    on(event: string, listener: Listener) {
      const set = this.listeners.get(event) ?? new Set();
      set.add(listener);
      this.listeners.set(event, set);
      return this;
    }

    removeAllListeners() {
      this.listeners.clear();
      return this;
    }

    send(data: string) {
      this.sent.push(String(data));
    }

    close(code?: number, reason?: string) {
      this.readyState = FakeWebSocket.CLOSED;
      this.emit('close', code ?? 1000, Buffer.from(reason ?? ''));
    }

    emit(event: string, ...args: any[]) {
      const set = this.listeners.get(event);
      if (!set) return;
      for (const listener of set) {
        listener(...args);
      }
    }

    async emitAsync(event: string, ...args: any[]) {
      const set = this.listeners.get(event);
      if (!set) return;
      for (const listener of set) {
        await listener(...args);
      }
    }
  }

  return { FakeWebSocketClass: FakeWebSocket };
});

type FakeWebSocket = InstanceType<typeof FakeWebSocketClass>;

// ---------------------------------------------------------------------------
// Module mocks — all must appear before any imports
// ---------------------------------------------------------------------------

vi.mock('ws', () => ({
  WebSocket: FakeWebSocketClass,
  WebSocketServer: class {},
}));

vi.mock('../../server.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../observability/tracing.js', () => ({
  SpanKind: { SERVER: 1, CLIENT: 2, INTERNAL: 3 },
  SpanStatusCode: { OK: 1, ERROR: 2 },
  startSpan: () => undefined,
  runWithSpan: (_span: any, fn: any) => fn(),
  withSpan: (_name: string, _opts: any, fn: any) => fn(undefined),
}));

vi.mock('../../observability/log-context.js', () => ({
  runWithLogContext: (_ctx: any, fn: any) => fn(),
  updateLogContext: () => {},
  withLogContext: (_ctx: any, fn: any) => fn,
  bindLogContext: (fn: any) => fn,
  getLogContext: () => ({}),
}));

vi.mock('../../services/call-session.js', () => ({
  getCallSession: vi.fn(),
  updateCallStatus: vi.fn(),
  completeCallSession: vi.fn(),
  recordCallEvent: vi.fn(),
  recordDebugEvent: vi.fn(),
  incrementToolInvocations: vi.fn(),
  recordSafetyEvent: vi.fn(),
  updateSafetyEventSignals: vi.fn(),
}));

vi.mock('../../services/line-lookup.js', () => ({
  getLineById: vi.fn(),
  recordOptOut: vi.fn(),
}));

vi.mock('../../services/privacy.js', () => ({
  getAccountPrivacySettings: vi.fn(),
  getLineVoiceConsent: vi.fn(),
  updateLineVoiceConsent: vi.fn(),
  logConsentAuditEvent: vi.fn(),
}));

vi.mock('../../services/memory.js', () => ({
  getMemoriesForLine: vi.fn(async () => []),
  markMemoriesAccessed: vi.fn(async () => undefined),
  storeMemory: vi.fn(async () => ({
    memoryId: 'mem-test-001',
    action: 'created' as const,
    version: 1,
  })),
}));

vi.mock('../../services/retention-context.js', () => ({
  buildRetentionContext: vi.fn(async () => ({
    pendingPreview: null,
    segmentPreferences: null,
    activeStoryArcs: [],
  })),
}));

vi.mock('../../services/prompt-context.js', () => ({
  buildPromptPlaceholders: vi.fn(async () => ({})),
}));

vi.mock('../../services/metering.js', () => ({
  getUsageSummary: vi.fn(async () => ({ minutesRemaining: 100 })),
}));

vi.mock('../../services/language.js', () => ({
  getStartingLanguageForLine: vi.fn(async () => ({ language: 'en', isAutoDetect: false })),
}));

vi.mock('../../services/active-calls.js', () => ({
  registerActiveCall: vi.fn(),
  unregisterActiveCall: vi.fn(),
}));

vi.mock('../../services/safety-verifier.js', () => ({
  verifyHighTierEvent: vi.fn(async () => ({
    decision: 'confirm' as const,
    latencyMs: 50,
  })),
}));

vi.mock('../../services/safety-notifications.js', () => ({
  notifyTrustedContacts: vi.fn(async () => undefined),
  notifyPayerSafetyEmail: vi.fn(async () => undefined),
}));

vi.mock('../../services/safety-metrics.js', () => ({
  incrementNotificationsBlocked: vi.fn(),
  observeVerifierLatency: vi.fn(),
  incrementVerifierDisagreements: vi.fn(),
}));

vi.mock('../../services/safety-state.js', () => ({
  getOrCreateSafetyState: vi.fn(() => ({
    triggeredTiers: new Set(),
    backstopTiersTriggered: new Set(),
    modelTiersLogged: new Set(),
    lastDetectionTime: 0,
  })),
  markSafetyTier: vi.fn(),
  wasBackstopTriggered: vi.fn(() => false),
  getSafetySummary: vi.fn(() => ({ tier: null, backstopFired: false })),
  markSafetySummaryLogged: vi.fn(() => false),
  clearSafetyState: vi.fn(),
}));

vi.mock('../../services/safety-classifier.js', () => ({
  buildContextWindow: vi.fn(() => ({ turns: [], chars: 0 })),
  enqueueClassifierJob: vi.fn(),
  clearJobsForSession: vi.fn(),
}));

vi.mock('../../services/routing-alerts.js', () => ({
  sendRoutingAlert: vi.fn(async () => undefined),
}));

vi.mock('../../services/topic-exclusions.js', () => ({
  excludeTopic: vi.fn(async () => ({ affectedMemoryIds: [] })),
  includeTopic: vi.fn(async () => ({ affectedMemoryIds: [] })),
  listTopicExclusions: vi.fn(async () => []),
  categorizeMemoryTopic: vi.fn(() => null),
  isTopicExcluded: vi.fn(async () => false),
  EXCLUSION_DISPLAY_NAMES: {
    health_medical: 'Health & Medical',
    family_relationships: 'Family Relationships',
    finances: 'Finances',
    location_address: 'Location & Address',
  },
}));

vi.mock('../../services/insight-state.js', () => ({
  addPrivateTopic: vi.fn(),
  getPrivateTopics: vi.fn(() => []),
  clearInsightState: vi.fn(),
}));

vi.mock('../../services/ephemeral-buffer.js', () => ({
  createBuffer: vi.fn(),
  addTurn: vi.fn(),
  addStoredKey: vi.fn(),
  markConsentGranted: vi.fn(),
  getBuffer: vi.fn(() => ({ turns: [] })),
  clearBuffer: vi.fn(),
}));

vi.mock('../../utils/metrics.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/metrics.js')>();
  return {
    ...actual,
    recordVoiceDisconnect: vi.fn(),
    voiceBargeInTotal: { inc: vi.fn() },
    voiceTimeToFirstAudioMs: { observe: vi.fn() },
    voiceRoutingIssuesTotal: { inc: vi.fn() },
  };
});

vi.mock('../../utils/twilio.js', () => ({
  getTwilioClient: vi.fn(() => ({
    calls: () => ({
      update: vi.fn(async () => undefined),
    }),
    recordings: vi.fn(() => ({
      fetch: vi.fn(async () => ({})),
    })),
  })),
  getVoiceConfigForLanguage: vi.fn(() => ({ language: 'en-US' })),
  getVoiceForLanguage: vi.fn(() => 'Ara'),
  generateStreamTwiML: vi.fn(() => '<Response />'),
  startRecordingForCall: vi.fn(async () => 'RE-test-recording-sid'),
  stopRecordingForCall: vi.fn(async () => true),
}));

vi.mock('../../utils/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/env.js')>();
  return {
    ...actual,
    getWebsocketUrl: vi.fn(() => 'ws://localhost:3001/twilio/media'),
    getBackendUrl: vi.fn(() => 'http://localhost:3001'),
    getPublicUrl: vi.fn(() => 'http://localhost:3001'),
  };
});

vi.mock('../../utils/fallback-messages.js', () => ({
  getFallbackMessage: vi.fn((_lang: string, _key: string) => 'fallback'),
}));

vi.mock('../../utils/supabase.js', () => ({
  getSupabaseClient: vi.fn(() => ({
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              single: async () => ({ data: null, error: null }),
            }),
            single: async () => ({ data: null, error: null }),
            maybeSingle: async () => ({ data: null, error: null }),
          }),
          maybeSingle: async () => ({ data: null, error: null }),
          single: async () => ({ data: null, error: null }),
        }),
      }),
      insert: () => ({ error: null }),
      update: () => ({
        eq: () => ({ error: null }),
      }),
      upsert: () => ({ error: null, onConflict: () => ({ error: null }) }),
    }),
  })),
}));

// ---------------------------------------------------------------------------
// Dynamic imports (after mocks)
// ---------------------------------------------------------------------------

let handleMediaStreamConnection: typeof import('../media-stream.js').handleMediaStreamConnection;
let getCallSession: typeof import('../../services/call-session.js').getCallSession;
let completeCallSession: typeof import('../../services/call-session.js').completeCallSession;
let getLineById: typeof import('../../services/line-lookup.js').getLineById;
let getAccountPrivacySettings: typeof import('../../services/privacy.js').getAccountPrivacySettings;
let getLineVoiceConsent: typeof import('../../services/privacy.js').getLineVoiceConsent;
let updateLineVoiceConsent: typeof import('../../services/privacy.js').updateLineVoiceConsent;
let verifyHighTierEvent: typeof import('../../services/safety-verifier.js').verifyHighTierEvent;
let unregisterActiveCall: typeof import('../../services/active-calls.js').unregisterActiveCall;
let clearBuffer: typeof import('../../services/ephemeral-buffer.js').clearBuffer;
let getUsageSummary: typeof import('../../services/metering.js').getUsageSummary;
let getGrokBridge: typeof import('../grok-bridge-registry.js').getGrokBridge;
let unregisterGrokBridge: typeof import('../grok-bridge-registry.js').unregisterGrokBridge;

// ---------------------------------------------------------------------------
// Test IDs
// ---------------------------------------------------------------------------

const SESSION_ID = '00000000-0000-0000-0000-000000000001';
const LINE_ID = '00000000-0000-0000-0000-000000000101';
const ACCOUNT_ID = '00000000-0000-0000-0000-000000000102';

const BACKEND_URL = 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Local helpers (mirror pattern from media-stream-simulator.test.ts)
// ---------------------------------------------------------------------------

// Delegate to shared helpers (cast hoisted FakeWebSocket as compatible with shared type)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- bridge hoisted vs imported FakeWebSocket private field
const lastSessionUpdate: (ws: FakeWebSocket) => any = sharedLastSessionUpdate as any;
const toolNamesFromSessionUpdate = sharedToolNamesFromSessionUpdate;
const waitFor = sharedWaitFor;
const waitForFakeTimer = sharedWaitForFakeTimer;
const simulateToolCall: (
  grokWs: FakeWebSocket, callId: string, toolName: string, args?: Record<string, unknown>
) => Promise<void> = sharedSimulateToolCall as any;
const fetchCallsMatching = sharedFetchCallsMatching;
const parsedBody = sharedParsedBody;
const emitTwilioStart: (ws: FakeWebSocket, streamSid?: string) => Promise<void> = sharedEmitTwilioStart as any;
const allFetchUrls = sharedAllFetchUrls;

async function findGrokSocket(): Promise<FakeWebSocket> {
  return sharedFindGrokSocketAsync(FakeWebSocketClass.instances as any) as Promise<any>;
}

async function setupCall(sessionId = SESSION_ID): Promise<{
  twilioWs: FakeWebSocket;
  grokWs: FakeWebSocket;
}> {
  const twilioWs = new FakeWebSocketClass('ws://twilio');
  await handleMediaStreamConnection(twilioWs as any, sessionId);
  await emitTwilioStart(twilioWs);
  const grokWs = await findGrokSocket();
  await waitFor(() => Boolean(lastSessionUpdate(grokWs)), 'initial session.update');
  return { twilioWs, grokWs };
}

// ---------------------------------------------------------------------------
// Base mock state
// ---------------------------------------------------------------------------

beforeAll(async () => {
  vi.resetModules();
  ({ handleMediaStreamConnection } = await import('../media-stream.js'));
  ({ getCallSession, completeCallSession } = await import('../../services/call-session.js'));
  ({ getLineById } = await import('../../services/line-lookup.js'));
  ({ getAccountPrivacySettings, getLineVoiceConsent, updateLineVoiceConsent } = await import('../../services/privacy.js'));
  await import('../../services/memory.js');
  ({ verifyHighTierEvent } = await import('../../services/safety-verifier.js'));
  await import('../../services/safety-notifications.js');
  ({ unregisterActiveCall } = await import('../../services/active-calls.js'));
  ({ clearBuffer } = await import('../../services/ephemeral-buffer.js'));
  ({ getUsageSummary } = await import('../../services/metering.js'));
  ({ getGrokBridge, unregisterGrokBridge } = await import('../grok-bridge-registry.js'));
});

beforeEach(() => {
  FakeWebSocketClass.instances = [];
  vi.clearAllMocks();

  // Clean up any lingering bridges from previous tests
  const existing = getGrokBridge(SESSION_ID);
  if (existing) {
    existing.close();
    unregisterGrokBridge(SESSION_ID);
  }

  // Default session mock
  vi.mocked(getCallSession).mockImplementation(async (sessionId: string) => ({
    id: sessionId,
    line_id: LINE_ID,
    account_id: ACCOUNT_ID,
    created_at: '2026-01-12T12:00:00.000Z',
    direction: 'outbound',
    status: 'in_progress',
    started_at: '2026-01-12T12:00:01.000Z',
    connected_at: '2026-01-12T12:00:05.000Z',
    ended_at: null,
    seconds_connected: null,
    twilio_call_sid: 'CA-test-call-001',
    twilio_from: '+15551234567',
    twilio_to: '+15559876543',
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
  } as any));

  vi.mocked(getLineById).mockResolvedValue({
    line: {
      id: LINE_ID,
      display_name: 'Test User',
      timezone: 'America/Los_Angeles',
      phone_e164: '+15551234567',
      seed_interests: [],
      seed_avoid_topics: [],
      inbound_allowed: true,
      interruption_tolerance: 'normal',
      filler_word_patience: 'normal',
      silence_tolerance_ms: 1000,
      crosstalk_recovery_mode: 'patient',
    },
    account: {
      id: ACCOUNT_ID,
      status: 'active',
      plan_id: 'care',
      user_type: 'self',
      sharing_enabled: false,
      trial_ends_at: null,
    },
  } as any);

  vi.mocked(getAccountPrivacySettings).mockResolvedValue({
    aiSummarizationEnabled: true,
    recordingEnabled: false,
  } as any);

  vi.mocked(getLineVoiceConsent).mockResolvedValue({
    memoryConsent: 'pending',
    recordingConsent: 'pending',
    sharingConsent: 'pending',
    sharingTier: 'tier_1',
    recordingPreferencePermanent: false,
    recordingReenableRequestedAt: null,
    sharingRePromptRequestedAt: null,
    onboardingCompletedAt: null,
  } as any);

  vi.mocked(updateLineVoiceConsent).mockResolvedValue(true);

  vi.stubGlobal('fetch', vi.fn(async (_url: string) => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true }),
  })) as any);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

describe('call scenario simulator', { timeout: 30_000 }, () => {

  // ---- Scenario 1: First call onboarding --------------------------------
  it('scenario 1: first call onboarding — consent tools present, grant → memory tools enabled → store memory → log insights', async () => {
    const { grokWs } = await setupCall();

    // Verify initial tool set: consent tools present, memory tools absent
    const initialTools = toolNamesFromSessionUpdate(lastSessionUpdate(grokWs));
    expect(initialTools).toContain('grant_memory_consent');
    expect(initialTools).toContain('deny_memory_consent');
    expect(initialTools).not.toContain('store_memory');
    expect(initialTools).not.toContain('review_memories');

    const fetchMock = vi.mocked(global.fetch as any);

    // Grant memory consent
    await simulateToolCall(grokWs, 'call-1', 'grant_memory_consent', {
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
    });

    await waitFor(
      () => fetchCallsMatching(fetchMock, '/tools/grant_memory_consent').length > 0,
      'grant_memory_consent fetch'
    );

    // Wait for session.update to reflect new tool set
    await waitFor(
      () => toolNamesFromSessionUpdate(lastSessionUpdate(grokWs))?.includes('store_memory'),
      'post-consent session.update with store_memory'
    );

    const afterConsentTools = toolNamesFromSessionUpdate(lastSessionUpdate(grokWs));
    expect(afterConsentTools).toContain('store_memory');
    expect(afterConsentTools).toContain('update_memory');
    expect(afterConsentTools).toContain('review_memories');

    // Store a memory
    await simulateToolCall(grokWs, 'call-2', 'store_memory', {
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
      memoryType: 'fact',
      key: 'favorite_flower',
      value: 'roses',
    });

    await waitFor(
      () => fetchCallsMatching(fetchMock, '/tools/store_memory').length > 0,
      'store_memory fetch'
    );

    // Log call insights
    await simulateToolCall(grokWs, 'call-3', 'log_call_insights', {
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
      mood_start: 'neutral',
      mood_end: 'positive',
      mood_trajectory: 'improving',
      techniques_used: ['humor'],
      has_concerns: false,
      needs_follow_up: false,
      has_baseline: false,
      engagement_level: 'high',
    });

    await waitFor(
      () => fetchCallsMatching(fetchMock, '/tools/log_call_insights').length > 0,
      'log_call_insights fetch'
    );

    // Verify 3+ distinct tool endpoint calls happened
    const urls = allFetchUrls(fetchMock);
    expect(urls.some((u) => u.includes('/tools/grant_memory_consent'))).toBe(true);
    expect(urls.some((u) => u.includes('/tools/store_memory'))).toBe(true);
    expect(urls.some((u) => u.includes('/tools/log_call_insights'))).toBe(true);
    expect(urls.length).toBeGreaterThanOrEqual(3);
  });

  // ---- Scenario 2: Memory consent denied --------------------------------
  it('scenario 2: memory consent denied — memory tools stay absent after deny', async () => {
    const { grokWs } = await setupCall();

    const fetchMock = vi.mocked(global.fetch as any);

    // Deny consent
    await simulateToolCall(grokWs, 'call-1', 'deny_memory_consent', {
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
    });

    await waitFor(
      () => fetchCallsMatching(fetchMock, '/tools/deny_memory_consent').length > 0,
      'deny_memory_consent fetch'
    );

    // Tools list should NOT gain memory tools
    const tools = toolNamesFromSessionUpdate(lastSessionUpdate(grokWs));
    expect(tools).not.toContain('store_memory');
    expect(tools).not.toContain('update_memory');
    expect(tools).not.toContain('review_memories');
  });

  // ---- Scenario 3: Reminder management ----------------------------------
  it('scenario 3: reminder management — set, list, edit, pause verify fetch URLs', async () => {
    const { grokWs } = await setupCall();
    const fetchMock = vi.mocked(global.fetch as any);

    // set_reminder
    await simulateToolCall(grokWs, 'call-1', 'set_reminder', {
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
      dueAtLocal: '2030-06-15T09:00:00',
      timezone: 'America/Los_Angeles',
      message: 'Take medication',
    });

    await waitFor(
      () => fetchCallsMatching(fetchMock, '/tools/set_reminder').length > 0,
      'set_reminder fetch'
    );

    // list_reminders
    await simulateToolCall(grokWs, 'call-2', 'list_reminders', {
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
    });

    await waitFor(
      () => fetchCallsMatching(fetchMock, '/tools/list_reminders').length > 0,
      'list_reminders fetch'
    );

    // edit_reminder
    await simulateToolCall(grokWs, 'call-3', 'edit_reminder', {
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
      reminderId: 'rem-test-001',
      newTimeLocal: '2030-06-15T10:00:00',
      timezone: 'America/Los_Angeles',
    });

    await waitFor(
      () => fetchCallsMatching(fetchMock, '/tools/edit_reminder').length > 0,
      'edit_reminder fetch'
    );

    // pause_reminder
    await simulateToolCall(grokWs, 'call-4', 'pause_reminder', {
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
      reminderId: 'rem-test-001',
    });

    await waitFor(
      () => fetchCallsMatching(fetchMock, '/tools/pause_reminder').length > 0,
      'pause_reminder fetch'
    );

    const urls = allFetchUrls(fetchMock);
    expect(urls.some((u) => u.includes('/tools/set_reminder'))).toBe(true);
    expect(urls.some((u) => u.includes('/tools/list_reminders'))).toBe(true);
    expect(urls.some((u) => u.includes('/tools/edit_reminder'))).toBe(true);
    expect(urls.some((u) => u.includes('/tools/pause_reminder'))).toBe(true);
  });

  // ---- Scenario 4: Schedule control -------------------------------------
  it('scenario 4: schedule control — schedule_call then skip_schedule verify payloads', async () => {
    const { grokWs } = await setupCall();
    const fetchMock = vi.mocked(global.fetch as any);

    // schedule_call
    await simulateToolCall(grokWs, 'call-1', 'schedule_call', {
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
      mode: 'update_recurring',
      daysOfWeek: [1, 3, 5],
      timeLocal: '09:00',
      timezone: 'America/Los_Angeles',
    });

    await waitFor(
      () => fetchCallsMatching(fetchMock, '/tools/schedule_call').length > 0,
      'schedule_call fetch'
    );

    const scheduleCallEntry = fetchCallsMatching(fetchMock, '/tools/schedule_call')[0];
    const scheduleBody = parsedBody(scheduleCallEntry);
    expect(scheduleBody).toMatchObject({
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
      mode: 'update_recurring',
    });

    // skip_schedule — grok bridge maps args.schedule_id → body.scheduleId
    await simulateToolCall(grokWs, 'call-2', 'skip_schedule', {
      schedule_id: 'sched-test-001',
    });

    await waitFor(
      () => fetchCallsMatching(fetchMock, '/tools/skip_schedule').length > 0,
      'skip_schedule fetch'
    );

    const skipEntry = fetchCallsMatching(fetchMock, '/tools/skip_schedule')[0];
    const skipBody = parsedBody(skipEntry);
    expect(skipBody).toMatchObject({
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
    });
  });

  // ---- Scenario 5: Safety event high tier full pipeline ----------------
  it('scenario 5: safety high tier full pipeline — SUICIDAL_IDEATION → verifier confirms → notify contacts and payer', async () => {
    const { grokWs } = await setupCall();
    const fetchMock = vi.mocked(global.fetch as any);

    // Verifier set to confirm
    vi.mocked(verifyHighTierEvent).mockResolvedValue({
      decision: 'confirm',
      latencyMs: 45,
    } as any);

    // grok bridge maps args.action_taken → body.actionTaken
    await simulateToolCall(grokWs, 'call-1', 'log_safety_concern', {
      category: 'SUICIDAL_IDEATION',
      confidence: 0.95,
      action_taken: 'suggested_988',
    });

    await waitFor(
      () => fetchCallsMatching(fetchMock, '/tools/safety_event').length > 0,
      'safety_event fetch'
    );

    // Verify the grok bridge dispatched the safety event fetch with correct payload
    const safetyFetch = fetchCallsMatching(fetchMock, '/tools/safety_event')[0];
    const safetyBody = parsedBody(safetyFetch);
    expect(safetyBody).toMatchObject({
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
      category: 'SUICIDAL_IDEATION',
      // grok bridge resolves tier from category automatically
      tier: 'high',
      source: 'model',
    });

    // Verify the URL is correct
    expect(safetyFetch[0]).toContain(`${BACKEND_URL}/tools/safety_event`);
  });

  // ---- Scenario 6: Safety event verifier blocks -------------------------
  it('scenario 6: safety verifier returns clear — notifications NOT sent', async () => {
    const { grokWs } = await setupCall();
    const fetchMock = vi.mocked(global.fetch as any);

    // Verifier returns clear
    vi.mocked(verifyHighTierEvent).mockResolvedValue({
      decision: 'clear',
      latencyMs: 30,
    } as any);

    await simulateToolCall(grokWs, 'call-1', 'log_safety_concern', {
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
      category: 'SUICIDAL_IDEATION',
      confidence: 0.8,
      action_taken: 'none',
    });

    await waitFor(
      () => fetchCallsMatching(fetchMock, '/tools/safety_event').length > 0,
      'safety_event fetch'
    );

    // The grok bridge dispatched the safety event — verify payload
    const safetyFetch = fetchCallsMatching(fetchMock, '/tools/safety_event')[0];
    expect(parsedBody(safetyFetch)).toMatchObject({
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
      category: 'SUICIDAL_IDEATION',
      tier: 'high',
      source: 'model',
    });

    // In this test, fetch is mocked so the Express route handler (which calls
    // verifyHighTierEvent + notify) never runs. The "verifier blocks" behavior
    // is exercised by safety-event-tool.test.ts at the route level.
    // Here we only verify that the grok bridge correctly dispatched the fetch.
    expect(safetyFetch[0]).toContain(`${BACKEND_URL}/tools/safety_event`);
  });

  // ---- Scenario 7: Recording consent lifecycle -------------------------
  it('scenario 7: recording consent lifecycle — grant then revoke', async () => {
    const { grokWs } = await setupCall();
    const fetchMock = vi.mocked(global.fetch as any);

    // Grant recording consent
    await simulateToolCall(grokWs, 'call-1', 'grant_recording_consent', {
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
    });

    await waitFor(
      () => fetchCallsMatching(fetchMock, '/tools/grant_recording_consent').length > 0,
      'grant_recording_consent fetch'
    );

    const grantCall = fetchCallsMatching(fetchMock, '/tools/grant_recording_consent')[0];
    expect(parsedBody(grantCall)).toMatchObject({
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
    });

    // Revoke recording consent
    await simulateToolCall(grokWs, 'call-2', 'revoke_recording_consent', {
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
    });

    await waitFor(
      () => fetchCallsMatching(fetchMock, '/tools/revoke_recording_consent').length > 0,
      'revoke_recording_consent fetch'
    );

    const urls = allFetchUrls(fetchMock);
    expect(urls.some((u) => u.includes('/tools/grant_recording_consent'))).toBe(true);
    expect(urls.some((u) => u.includes('/tools/revoke_recording_consent'))).toBe(true);
  });

  // ---- Scenario 8: Privacy controls ------------------------------------
  it('scenario 8: privacy controls — exclude_memory_topic then mark_topic_private', async () => {
    const { grokWs } = await setupCall();
    const fetchMock = vi.mocked(global.fetch as any);

    // exclude_topic (exclude_memory_topic)
    await simulateToolCall(grokWs, 'call-1', 'exclude_memory_topic', {
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
      category: 'health_medical',
    });

    await waitFor(
      () => fetchCallsMatching(fetchMock, '/tools/exclude_topic').length > 0,
      'exclude_topic fetch'
    );

    const excludeCall = fetchCallsMatching(fetchMock, '/tools/exclude_topic')[0];
    expect(parsedBody(excludeCall)).toMatchObject({
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
      category: 'health_medical',
    });

    // mark_topic_private
    await simulateToolCall(grokWs, 'call-2', 'mark_topic_private', {
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
      topic_code: 'medication',
    });

    await waitFor(
      () => fetchCallsMatching(fetchMock, '/tools/mark_topic_private').length > 0,
      'mark_topic_private fetch'
    );

    const markCall = fetchCallsMatching(fetchMock, '/tools/mark_topic_private')[0];
    expect(parsedBody(markCall)).toMatchObject({
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
      topic_code: 'medication',
    });
  });

  // ---- Scenario 9: Family sharing --------------------------------------
  it('scenario 9: family sharing — enable_family_sharing then set_sharing_tier', async () => {
    const { grokWs } = await setupCall();
    const fetchMock = vi.mocked(global.fetch as any);

    // enable_family_sharing
    await simulateToolCall(grokWs, 'call-1', 'enable_family_sharing', {
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
    });

    await waitFor(
      () => fetchCallsMatching(fetchMock, '/tools/enable_family_sharing').length > 0,
      'enable_family_sharing fetch'
    );

    expect(parsedBody(fetchCallsMatching(fetchMock, '/tools/enable_family_sharing')[0])).toMatchObject({
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
    });

    // set_sharing_tier
    await simulateToolCall(grokWs, 'call-2', 'set_sharing_tier', {
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
      tier: 'tier_2',
      consent: 'granted',
    });

    await waitFor(
      () => fetchCallsMatching(fetchMock, '/tools/set_sharing_tier').length > 0,
      'set_sharing_tier fetch'
    );

    expect(parsedBody(fetchCallsMatching(fetchMock, '/tools/set_sharing_tier')[0])).toMatchObject({
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
      tier: 'tier_2',
      consent: 'granted',
    });
  });

  // ---- Scenario 10: Overage → upgrade (fake timers) --------------------
  it('scenario 10: overage prompt triggered by 0 minutes → choose_overage_action(upgrade) → request_upgrade(sendLink)', async () => {
    vi.useFakeTimers();

    // Override metering to return 0 minutes — triggers shouldPromptOverage=true
    vi.mocked(getUsageSummary).mockResolvedValue({ minutesRemaining: 0 } as any);

    const twilioWs = new FakeWebSocketClass('ws://twilio');
    await handleMediaStreamConnection(twilioWs as any, SESSION_ID);
    await twilioWs.emitAsync('message', Buffer.from(JSON.stringify({
      event: 'start',
      start: {
        streamSid: 'MS-fake-timer',
        callSid: 'CA-test-call-001',
        accountSid: 'AC-test-account',
        tracks: ['inbound'],
        customParameters: {},
      },
    })));

    // Find grok socket using fake-timer-aware polling
    let grokWs: FakeWebSocket | undefined;
    await waitForFakeTimer(
      () => {
        grokWs = FakeWebSocketClass.instances.find((ws) => ws.url?.includes('realtime'));
        return Boolean(grokWs);
      },
      'Grok WebSocket (fake timers)'
    );

    await waitForFakeTimer(
      () => Boolean(grokWs && lastSessionUpdate(grokWs)),
      'initial session.update (fake timers)'
    );

    // After connection with 0 minutes, sendOveragePrompt() fires automatically.
    // Verify that grokWs received a conversation.item.create with the overage prompt text
    // (sendTextInput sends type: 'conversation.item.create' with role: 'user').
    await waitForFakeTimer(
      () => grokWs!.sent.some((raw) => {
        try {
          const msg = JSON.parse(raw);
          return msg.type === 'conversation.item.create' &&
            msg.item?.content?.[0]?.text?.includes('overage charges');
        } catch { return false; }
      }),
      'overage prompt sent to Grok'
    );

    const fetchMock = vi.mocked(global.fetch as any);

    // Grok processes the overage prompt and calls choose_overage_action(upgrade, comfort)
    await simulateToolCall(grokWs!, 'call-1', 'choose_overage_action', {
      callSessionId: SESSION_ID,
      action: 'upgrade',
      plan_id: 'comfort',
    });

    await waitForFakeTimer(
      () => fetchCallsMatching(fetchMock, '/tools/overage_action').length > 0,
      'overage_action fetch (fake timers)'
    );

    const overageCall = fetchCallsMatching(fetchMock, '/tools/overage_action')[0];
    expect(parsedBody(overageCall)).toMatchObject({
      callSessionId: SESSION_ID,
      action: 'upgrade',
    });

    // Then Grok calls request_upgrade with sendLink to email the upgrade link
    await simulateToolCall(grokWs!, 'call-2', 'request_upgrade', {
      plan_id: 'comfort',
      send_link: true,
    });

    await waitForFakeTimer(
      () => fetchCallsMatching(fetchMock, '/tools/request_upgrade').length > 0,
      'request_upgrade fetch (fake timers)'
    );

    expect(parsedBody(fetchCallsMatching(fetchMock, '/tools/request_upgrade')[0])).toMatchObject({
      callSessionId: SESSION_ID,
    });

    // Advance past the 60s overage prompt timeout — should NOT force-close since user responded
    vi.advanceTimersByTime(61000);
    for (let i = 0; i < 30; i++) await Promise.resolve();

    // Assert no force-close: Twilio WS still open, completeCallSession not called
    expect(vi.mocked(completeCallSession)).not.toHaveBeenCalled();
    expect(vi.mocked(unregisterActiveCall)).not.toHaveBeenCalled();

    // Restore getUsageSummary to default
    vi.mocked(getUsageSummary).mockResolvedValue({ minutesRemaining: 100 } as any);
  });

  // ---- Scenario 11: Opt-out and goodbye --------------------------------
  it('scenario 11: opt-out and goodbye — request_opt_out with correct body', async () => {
    const { grokWs } = await setupCall();
    const fetchMock = vi.mocked(global.fetch as any);

    await simulateToolCall(grokWs, 'call-1', 'request_opt_out', {
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
      confirmed: true,
      source: 'voice',
    });

    await waitFor(
      () => fetchCallsMatching(fetchMock, '/tools/opt_out').length > 0,
      'opt_out fetch'
    );

    const optOutCall = fetchCallsMatching(fetchMock, '/tools/opt_out')[0];
    const body = parsedBody(optOutCall);
    expect(body).toMatchObject({
      callSessionId: SESSION_ID,
      lineId: LINE_ID,
    });

    // Verify source: 'voice' is forwarded (bridge adds this before HTTP call)
    expect(body.source).toBe('voice');

    // Verify the URL is exactly right (no suffix confusion)
    expect(optOutCall[0]).toContain(`${BACKEND_URL}/tools/opt_out`);
  });

  // ---- Scenario 12: Call teardown (fake timers) ------------------------
  it('scenario 12: call teardown — close WebSocket → verify completeCallSession and unregisterActiveCall', async () => {
    vi.useFakeTimers();

    const twilioWs = new FakeWebSocketClass('ws://twilio');
    await handleMediaStreamConnection(twilioWs as any, SESSION_ID);
    await twilioWs.emitAsync('message', Buffer.from(JSON.stringify({
      event: 'start',
      start: {
        streamSid: 'MS-teardown',
        callSid: 'CA-test-call-001',
        accountSid: 'AC-test-account',
        tracks: ['inbound'],
        customParameters: {},
      },
    })));

    let grokWs: FakeWebSocket | undefined;
    await waitForFakeTimer(
      () => {
        grokWs = FakeWebSocketClass.instances.find((ws) => ws.url?.includes('realtime'));
        return Boolean(grokWs);
      },
      'Grok WebSocket (teardown)'
    );

    await waitForFakeTimer(
      () => Boolean(grokWs && lastSessionUpdate(grokWs)),
      'initial session.update (teardown)'
    );

    // Simulate Twilio WebSocket close (call ended)
    await twilioWs.emitAsync('close', 1000, Buffer.from(''));

    // Allow close handlers to run
    vi.advanceTimersByTime(500);
    for (let i = 0; i < 30; i++) {
      await Promise.resolve();
    }
    vi.advanceTimersByTime(500);
    for (let i = 0; i < 30; i++) {
      await Promise.resolve();
    }

    // After teardown, verify cleanup (5+ assertions):
    // 1. Active call unregistered
    expect(vi.mocked(unregisterActiveCall)).toHaveBeenCalledWith(SESSION_ID);
    // 2. completeCallSession called to finalize the session
    expect(vi.mocked(completeCallSession)).toHaveBeenCalled();
    const completeArgs = vi.mocked(completeCallSession).mock.calls[0];
    expect(completeArgs[0]).toBe(SESSION_ID);
    // 3. Ephemeral buffer cleared for this session
    expect(vi.mocked(clearBuffer)).toHaveBeenCalledWith(SESSION_ID);
    // 4. Grok bridge unregistered (no longer in registry)
    const bridge = getGrokBridge(SESSION_ID);
    expect(bridge).toBeUndefined();
    // 5. Grok WebSocket was closed
    expect(grokWs!.readyState).toBe(3); // WebSocket.CLOSED
  });

});
