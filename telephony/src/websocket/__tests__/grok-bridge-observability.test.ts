import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import type { LogContext } from '../../observability/log-context.js';

process.env.LOG_LEVEL = 'debug';
process.env.ULTAURA_LOG_PRETTY = 'false';
process.env.ULTAURA_OTEL_ENABLED = 'true';

let GrokBridge: typeof import('../../websocket/grok-bridge.js').GrokBridge;
let exporter: InMemorySpanExporter;
let logEntries: Array<{ payload: Record<string, unknown>; msg: string; context: LogContext | undefined }>;

beforeAll(async () => {
  vi.resetModules();
  logEntries = [];
  vi.doMock('../../utils/logger.js', async () => {
    const { getLogContext } = await import('../../observability/log-context.js');
    const capture = (payload: Record<string, unknown>, msg: string) => {
      logEntries.push({ payload, msg, context: getLogContext() });
    };
    return {
      logger: {
        debug: capture,
        info: capture,
        warn: capture,
        error: capture,
      },
    };
  });
  exporter = new InMemorySpanExporter();
  const provider = new NodeTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  provider.register({ contextManager: new AsyncLocalStorageContextManager() });

  ({ GrokBridge } = await import('../../websocket/grok-bridge.js'));
}, 20000);

beforeEach(() => {
  exporter.reset();
  logEntries = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function createBridge() {
  return new GrokBridge({
    callSessionId: 'session-123',
    lineId: 'line-1',
    accountId: 'account-1',
    userName: 'Test User',
    timezone: 'America/Los_Angeles',
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

describe('GrokBridge observability', () => {
  it('includes callSessionId in tool endpoint logs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    })) as any);

    const bridge = createBridge();
    await (bridge as any).handleToolCall('call-1', 'set_reminder', JSON.stringify({
      due_at_local: '2024-01-01T12:00:00',
      message: 'Hello',
    }));
    const entry = logEntries.find((item) => item.msg === 'Tool endpoint response');
    expect(entry).toBeTruthy();
    expect(entry?.context?.callSessionId).toBe('session-123');
  });

  it('creates a span for each tool call', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    })) as any);

    const bridge = createBridge();
    await (bridge as any).handleToolCall('call-2', 'set_reminder', JSON.stringify({
      due_at_local: '2024-01-01T12:00:00',
      message: 'Hello',
    }));

    const spans = exporter.getFinishedSpans();
    const toolSpan = spans.find((span) => span.name === 'grok.tool.set_reminder');
    expect(toolSpan).toBeTruthy();
    expect(toolSpan?.attributes.toolName).toBe('set_reminder');
  });

  it('forwards reminder delivery method args to tool endpoints with telephony field names', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    }));
    vi.stubGlobal('fetch', fetchMock as any);

    const bridge = createBridge();
    await (bridge as any).handleToolCall('call-3', 'set_reminder', JSON.stringify({
      due_at_local: '2024-01-01T12:00:00',
      message: 'Hello',
      delivery_method: 'sms',
    }));
    await (bridge as any).handleToolCall('call-4', 'edit_reminder', JSON.stringify({
      reminder_id: 'rem-1',
      new_delivery_method: 'call',
    }));
    await (bridge as any).handleToolCall('call-5', 'edit_reminder', JSON.stringify({
      reminder_id: 'rem-2',
      new_delivery_method: 'outbound_call',
    }));

    const setBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const editBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const legacyEditBody = JSON.parse(fetchMock.mock.calls[2][1].body as string);

    expect(setBody.deliveryMethod).toBe('sms');
    expect(editBody.newDeliveryMethod).toBe('outbound_call');
    expect(editBody.reminderId).toBe('rem-1');
    expect(legacyEditBody.newDeliveryMethod).toBe('outbound_call');
    expect(legacyEditBody.reminderId).toBe('rem-2');
  });

  it('warns on unsupported non-null reminder delivery methods while keeping endpoint mapping undefined', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    }));
    vi.stubGlobal('fetch', fetchMock as any);

    const bridge = createBridge();
    await (bridge as any).handleToolCall('call-6', 'set_reminder', JSON.stringify({
      due_at_local: '2024-01-01T12:00:00',
      message: 'Hello',
      delivery_method: 'pigeon',
    }));
    await (bridge as any).handleToolCall('call-7', 'edit_reminder', JSON.stringify({
      reminder_id: 'rem-3',
      new_delivery_method: 'fax',
    }));

    const setBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const editBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const warningLogs = logEntries.filter((entry) => entry.msg === 'Unsupported reminder delivery method from Grok tool args');

    expect(setBody.deliveryMethod).toBeUndefined();
    expect(editBody.newDeliveryMethod).toBeUndefined();
    expect(warningLogs).toHaveLength(2);
    expect(warningLogs[0]?.payload).toEqual(expect.objectContaining({
      toolName: 'set_reminder',
      argName: 'delivery_method',
      deliveryMethod: 'pigeon',
    }));
    expect(warningLogs[1]?.payload).toEqual(expect.objectContaining({
      toolName: 'edit_reminder',
      argName: 'new_delivery_method',
      deliveryMethod: 'fax',
    }));
  });
});
