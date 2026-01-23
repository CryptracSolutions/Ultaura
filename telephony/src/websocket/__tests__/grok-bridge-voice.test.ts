import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.XAI_API_KEY = 'test-key';

const { FakeWebSocket: FakeWebSocketClass } = vi.hoisted(() => {
  type Listener = (...args: any[]) => any;

  class FakeWebSocket {
    static OPEN = 1;
    static CLOSED = 3;
    static instances: FakeWebSocket[] = [];

    readyState = FakeWebSocket.OPEN;
    sent: string[] = [];
    private listeners = new Map<string, Set<Listener>>();

    constructor(_url?: string, _options?: any) {
      FakeWebSocket.instances.push(this);
      queueMicrotask(() => this.emit('open'));
    }

    on(event: string, listener: Listener) {
      const set = this.listeners.get(event) ?? new Set();
      set.add(listener);
      this.listeners.set(event, set);
      return this;
    }

    send(data: string) {
      this.sent.push(String(data));
    }

    close(code?: number, reason?: string) {
      this.readyState = FakeWebSocket.CLOSED;
      this.emit('close', code ?? 1000, Buffer.from(reason ?? ''));
    }

    private emit(event: string, ...args: any[]) {
      const set = this.listeners.get(event);
      if (!set) return;
      for (const listener of set) {
        listener(...args);
      }
    }
  }

  return { FakeWebSocket };
});

type FakeWebSocket = InstanceType<typeof FakeWebSocketClass>;

vi.mock('ws', () => ({
  WebSocket: FakeWebSocketClass,
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
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
  withLogContext: (_ctx: any, fn: any) => fn,
}));

let GrokBridge: typeof import('../../websocket/grok-bridge.js').GrokBridge;

beforeEach(async () => {
  vi.resetModules();
  FakeWebSocketClass.instances = [];
  ({ GrokBridge } = await import('../../websocket/grok-bridge.js'));
});

function createBridge(preferredGrokVoice?: string | null) {
  return new GrokBridge({
    callSessionId: 'session-voice',
    lineId: 'line-voice',
    accountId: 'account-voice',
    userName: 'Test User',
    timezone: 'America/Los_Angeles',
    preferredGrokVoice,
    isFirstCall: true,
    memories: [],
    memoryEnabled: false,
    needsMemoryConsent: false,
    seedInterests: null,
    seedAvoidTopics: null,
    lowMinutesWarning: false,
    minutesRemaining: 0,
    isReminderCall: false,
    reminderMessage: null,
    isTestCall: false,
    isPreviewMode: false,
    userType: 'self',
    sharingEnabled: false,
    recordingEnabled: false,
    recordingConsent: 'pending',
    recordingReenableRequested: false,
    needsRecordingConsent: false,
    sharingTier: 'tier_1',
    sharingConsent: 'pending',
    sharingRePromptRequested: false,
    needsSharingConsent: false,
    onboardingCompleted: true,
    canReceiveInboundCalls: true,
    currentPlanId: 'care',
    accountStatus: 'active',
    onAudioReceived: () => {},
    onClearBuffer: () => {},
    onError: () => {},
    onToolCall: () => {},
  } as any);
}

describe('GrokBridge voice selection', () => {
  it('uses the preferred Grok voice when valid', async () => {
    const bridge = createBridge('Eve');
    await bridge.connect();

    const socket = FakeWebSocketClass.instances[0] as FakeWebSocket | undefined;
    const payload = socket?.sent[0];
    expect(payload).toBeTruthy();

    const message = JSON.parse(payload ?? '{}');
    expect(message?.session?.voice).toBe('Eve');
  });

  it('falls back to Ara when the preferred voice is invalid', async () => {
    const bridge = createBridge('InvalidVoice');
    await bridge.connect();

    const socket = FakeWebSocketClass.instances[0] as FakeWebSocket | undefined;
    const payload = socket?.sent[0];
    expect(payload).toBeTruthy();

    const message = JSON.parse(payload ?? '{}');
    expect(message?.session?.voice).toBe('Ara');
  });
});
