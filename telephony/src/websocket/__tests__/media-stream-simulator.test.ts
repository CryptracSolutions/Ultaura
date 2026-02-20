import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  lastSessionUpdate as sharedLastSessionUpdate,
  toolNamesFromSessionUpdate as sharedToolNamesFromSessionUpdate,
  waitFor as sharedWaitFor,
  findGrokSocketAsync as sharedFindGrokSocketAsync,
} from './helpers/fake-websocket.js';

const SENTINEL = 'SENSITIVE_SENTINEL_12345';

const { serverLogger } = vi.hoisted(() => ({
  serverLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const { FakeWebSocket: FakeWebSocketClass } = vi.hoisted(() => {
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

      // GrokBridge expects async open after listeners are attached.
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

  return { FakeWebSocket };
});

type FakeWebSocket = InstanceType<typeof FakeWebSocketClass>;

vi.mock('ws', () => ({
  WebSocket: FakeWebSocketClass,
  WebSocketServer: class {},
}));

vi.mock('../../server.js', () => ({
  logger: serverLogger,
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

vi.mock('../../utils/metrics.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/metrics.js')>();
  return {
    ...actual,
    recordVoiceDisconnect: vi.fn(),
    voiceBargeInTotal: { inc: vi.fn() },
    voiceTimeToFirstAudioMs: { observe: vi.fn() },
  };
});

vi.mock('../../utils/twilio.js', () => ({
  getTwilioClient: vi.fn(() => ({
    calls: () => ({
      update: vi.fn(async () => undefined),
    }),
  })),
  getVoiceConfigForLanguage: vi.fn(() => ({ language: 'en-US' })),
  getVoiceForLanguage: vi.fn(() => 'Ara'),
  generateStreamTwiML: vi.fn(() => '<Response />'),
}));

vi.mock('../../utils/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/env.js')>();
  return {
    ...actual,
    getWebsocketUrl: vi.fn(() => 'ws://localhost:3001/twilio/media'),
  };
});

vi.mock('../../utils/fallback-messages.js', () => ({
  getFallbackMessage: vi.fn((_lang: string, _key: string) => 'fallback'),
}));

vi.mock('../../utils/supabase.js', () => ({
  getSupabaseClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              single: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }),
  })),
}));

let handleMediaStreamConnection: typeof import('../media-stream.js').handleMediaStreamConnection;
let getCallSession: typeof import('../../services/call-session.js').getCallSession;
let getLineById: typeof import('../../services/line-lookup.js').getLineById;
let getAccountPrivacySettings: typeof import('../../services/privacy.js').getAccountPrivacySettings;
let getLineVoiceConsent: typeof import('../../services/privacy.js').getLineVoiceConsent;
let getMemoriesForLine: typeof import('../../services/memory.js').getMemoriesForLine;
let getGrokBridge: typeof import('../grok-bridge-registry.js').getGrokBridge;
let unregisterGrokBridge: typeof import('../grok-bridge-registry.js').unregisterGrokBridge;

const CALL_SESSION_ID_1 = '00000000-0000-0000-0000-000000000100';
const CALL_SESSION_ID_2 = '00000000-0000-0000-0000-000000000200';
const LINE_ID = '00000000-0000-0000-0000-000000000101';
const ACCOUNT_ID = '00000000-0000-0000-0000-000000000102';

async function findGrokSocket(): Promise<FakeWebSocket> {
  return sharedFindGrokSocketAsync(FakeWebSocketClass.instances as any) as Promise<any>;
}

// Delegate to shared helpers (cast hoisted FakeWebSocket as compatible)
const lastSessionUpdate: (ws: FakeWebSocket) => any = sharedLastSessionUpdate as any;
const toolNamesFromSessionUpdate = sharedToolNamesFromSessionUpdate;

beforeAll(async () => {
  vi.resetModules();
  ({ handleMediaStreamConnection } = await import('../media-stream.js'));
  ({ getCallSession } = await import('../../services/call-session.js'));
  ({ getLineById } = await import('../../services/line-lookup.js'));
  ({ getAccountPrivacySettings, getLineVoiceConsent } = await import('../../services/privacy.js'));
  ({ getMemoriesForLine } = await import('../../services/memory.js'));
  ({ getGrokBridge, unregisterGrokBridge } = await import('../grok-bridge-registry.js'));
});

beforeEach(() => {
  FakeWebSocketClass.instances = [];
  vi.clearAllMocks();

  for (const sessionId of [CALL_SESSION_ID_1, CALL_SESSION_ID_2]) {
    const existing = getGrokBridge(sessionId);
    if (existing) {
      existing.close();
      unregisterGrokBridge(sessionId);
    }
  }

  vi.mocked(getCallSession).mockImplementation(async (sessionId: string) => ({
    id: sessionId,
    line_id: LINE_ID,
    account_id: ACCOUNT_ID,
    created_at: '2026-01-12T12:00:00.000Z',
    direction: 'outbound',
    status: 'created',
    started_at: null,
    connected_at: null,
    ended_at: null,
    seconds_connected: null,
    twilio_call_sid: null,
    twilio_from: null,
    twilio_to: null,
    recording_sid: null,
    end_reason: null,
    answered_by: null,
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

  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/tools/grant_memory_consent')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as any;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as any;
  }) as any);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('media-stream simulator', () => {
  it('gates memory tools until consent is granted, then enables them (via session.update)', async () => {
    const twilioWs = new FakeWebSocketClass('ws://twilio');

    await handleMediaStreamConnection(twilioWs as any, CALL_SESSION_ID_1);

    await twilioWs.emitAsync('message', Buffer.from(JSON.stringify({
      event: 'start',
      start: {
        streamSid: 'MS123',
        callSid: 'CA123',
        accountSid: 'AC123',
        tracks: ['inbound'],
        customParameters: {},
      },
    })));

    const grokWs = await (async () => {
      for (let i = 0; i < 50; i++) {
        const socket = FakeWebSocketClass.instances.find((ws: any) => ws.url?.includes('realtime'));
        if (socket) return socket;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      throw new Error('Grok WebSocket not created');
    })();
    const waitFor = sharedWaitFor;

    await waitFor(() => Boolean(lastSessionUpdate(grokWs)), 'initial session.update');
    const initialUpdate = lastSessionUpdate(grokWs);
    expect(initialUpdate).toBeTruthy();
    const initialTools = toolNamesFromSessionUpdate(initialUpdate);

    expect(initialTools).toContain('grant_memory_consent');
    expect(initialTools).toContain('deny_memory_consent');
    expect(initialTools).not.toContain('store_memory');
    expect(initialTools).not.toContain('update_memory');
    expect(initialTools).not.toContain('review_memories');

    await grokWs.emitAsync('message', Buffer.from(JSON.stringify({
      type: 'response.function_call_arguments.done',
      call_id: 'call-1',
      name: 'grant_memory_consent',
      arguments: '{}',
    })));
    await waitFor(() => toolNamesFromSessionUpdate(lastSessionUpdate(grokWs)).includes('store_memory'), 'post-consent session.update');

    const afterUpdate = lastSessionUpdate(grokWs);
    const afterTools = toolNamesFromSessionUpdate(afterUpdate);
    expect(afterTools).toContain('store_memory');
    expect(afterTools).toContain('update_memory');
    expect(afterTools).toContain('review_memories');
  });

  it('filters line_only memories for family-managed prompts', async () => {
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
        user_type: 'family_managed',
        sharing_enabled: true,
        trial_ends_at: null,
      },
    } as any);

    vi.mocked(getLineVoiceConsent).mockResolvedValue({
      memoryConsent: 'granted',
      recordingConsent: 'pending',
      sharingConsent: 'pending',
      sharingTier: 'tier_1',
      recordingPreferencePermanent: false,
      recordingReenableRequestedAt: null,
      sharingRePromptRequestedAt: null,
      onboardingCompletedAt: null,
    } as any);

    vi.mocked(getMemoriesForLine).mockResolvedValue([
      {
        id: 'mem-1',
        key: 'public_note',
        value: 'likes birds',
        privacyScope: 'account_shared',
      },
      {
        id: 'mem-2',
        key: 'secret_note',
        value: 'secret',
        privacyScope: 'line_only',
      },
    ] as any);

    const twilioWs = new FakeWebSocketClass('ws://twilio');

    await handleMediaStreamConnection(twilioWs as any, CALL_SESSION_ID_1);

    await twilioWs.emitAsync('message', Buffer.from(JSON.stringify({
      event: 'start',
      start: {
        streamSid: 'MS123',
        callSid: 'CA123',
        accountSid: 'AC123',
        tracks: ['inbound'],
        customParameters: {},
      },
    })));

    const waitFor = sharedWaitFor;

    await waitFor(
      () => FakeWebSocketClass.instances.some((ws: any) => ws.url?.includes('realtime')),
      'Grok WebSocket creation'
    );
    const grokWs = await findGrokSocket();
    await waitFor(() => Boolean(lastSessionUpdate(grokWs)), 'initial session.update');

    const instructions = lastSessionUpdate(grokWs)?.session?.instructions ?? '';
    expect(instructions).toContain('public_note');
    expect(instructions).not.toContain('secret_note');
  });

  it('never logs tool args values (only argsSummary) from Grok tool calls', async () => {
    const twilioWs = new FakeWebSocketClass('ws://twilio');
    await handleMediaStreamConnection(twilioWs as any, CALL_SESSION_ID_2);

    await twilioWs.emitAsync('message', Buffer.from(JSON.stringify({
      event: 'start',
      start: {
        streamSid: 'MS123',
        callSid: 'CA123',
        accountSid: 'AC123',
        tracks: ['inbound'],
        customParameters: {},
      },
    })));

    const waitFor = sharedWaitFor;

    await waitFor(
      () => FakeWebSocketClass.instances.some((ws: any) => ws.url?.includes('realtime')),
      'Grok WebSocket creation'
    );
    const grokWs = await findGrokSocket();
    await waitFor(() => Boolean(lastSessionUpdate(grokWs)), 'initial session.update');

    await grokWs.emitAsync('message', Buffer.from(JSON.stringify({
      type: 'response.function_call_arguments.done',
      call_id: 'call-2',
      name: 'request_opt_out',
      arguments: JSON.stringify({ confirmed: false, value: SENTINEL }),
    })));

    await waitFor(() => serverLogger.debug.mock.calls.length > 0, 'logger.debug call');

    const logged = (serverLogger.debug.mock.calls || [])
      .map((call) => JSON.stringify(call[0]))
      .join('\n');

    expect(logged).not.toContain(SENTINEL);
    expect(logged).toContain('argsSummary');
  });
});
