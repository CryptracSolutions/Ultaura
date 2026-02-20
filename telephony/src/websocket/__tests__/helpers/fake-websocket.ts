import { vi, expect } from 'vitest';

type Listener = (...args: any[]) => any;

export class FakeWebSocket {
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

// ---------------------------------------------------------------------------
// Scenario helpers
// ---------------------------------------------------------------------------

export function findGrokSocket(instances?: FakeWebSocket[]): FakeWebSocket {
  const pool = instances ?? FakeWebSocket.instances;
  const grok = pool.find((ws) => ws.url?.includes('realtime'));
  if (!grok) {
    throw new Error('Grok WebSocket not created');
  }
  return grok;
}

export async function findGrokSocketAsync(
  instances: { url?: string }[],
  pollFn: typeof waitFor = waitFor
): Promise<FakeWebSocket> {
  await pollFn(
    () => instances.some((ws) => ws.url?.includes('realtime')),
    'Grok WebSocket creation'
  );
  const grok = instances.find((ws) => ws.url?.includes('realtime'));
  if (!grok) throw new Error('Grok WebSocket not found');
  return grok as FakeWebSocket;
}

export function lastSessionUpdate(ws: FakeWebSocket): any {
  const updates = ws.sent
    .map((raw) => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((msg: any) => msg.type === 'session.update');
  return updates[updates.length - 1] ?? null;
}

export function toolNamesFromSessionUpdate(msg: any): string[] {
  const tools = msg?.session?.tools ?? [];
  return tools
    .filter((t: any) => t?.type === 'function' && typeof t?.name === 'string')
    .map((t: any) => t.name as string);
}

export async function waitFor(
  predicate: () => boolean,
  label: string,
  maxIterations = 200
): Promise<void> {
  for (let i = 0; i < maxIterations; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

export async function simulateToolCall(
  grokWs: FakeWebSocket,
  callId: string,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<void> {
  await grokWs.emitAsync('message', Buffer.from(JSON.stringify({
    type: 'response.function_call_arguments.done',
    call_id: callId,
    name: toolName,
    arguments: JSON.stringify(args),
  })));
}

export function assertFetchCalledWith(
  fetchMock: ReturnType<typeof vi.fn>,
  urlPattern: string | RegExp,
  bodyMatcher: Record<string, unknown>
): void {
  const calls = fetchMock.mock.calls as Array<[string, RequestInit?]>;
  const match = calls.find(([url]) => {
    if (typeof urlPattern === 'string') {
      return url.endsWith(urlPattern) || url.includes(urlPattern);
    }
    return urlPattern.test(url);
  });

  if (!match) {
    throw new Error(
      `fetch was not called with URL matching ${String(urlPattern)}.\n` +
      `Actual calls: ${calls.map(([url]) => url).join(', ')}`
    );
  }

  const [, init] = match;
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;

  expect(body).toEqual(expect.objectContaining(bodyMatcher));
}

// ---------------------------------------------------------------------------
// Fake-timer-compatible polling helper
// ---------------------------------------------------------------------------

export async function waitForFakeTimer(
  predicate: () => boolean,
  label: string,
  maxTicks = 50
): Promise<void> {
  for (let i = 0; i < maxTicks; i++) {
    if (predicate()) return;
    vi.advanceTimersByTime(100);
    await Promise.resolve();
  }
  throw new Error(`Timed out (fake timers) waiting for: ${label}`);
}

// ---------------------------------------------------------------------------
// Fetch inspection helpers
// ---------------------------------------------------------------------------

export function allFetchUrls(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return (fetchMock.mock.calls as Array<[string, RequestInit?]>).map(([url]) => url);
}

export function fetchCallsMatching(
  fetchMock: ReturnType<typeof vi.fn>,
  pattern: string | RegExp
): Array<[string, RequestInit?]> {
  return (fetchMock.mock.calls as Array<[string, RequestInit?]>).filter(([url]) =>
    typeof pattern === 'string' ? url.includes(pattern) : pattern.test(url)
  );
}

export function parsedBody(call: [string, RequestInit?]): any {
  const body = call[1]?.body;
  return typeof body === 'string' ? JSON.parse(body) : body;
}

// ---------------------------------------------------------------------------
// Twilio start-event helper
// ---------------------------------------------------------------------------

export async function emitTwilioStart(
  twilioWs: FakeWebSocket,
  streamSid = 'MS-test-123'
): Promise<void> {
  await twilioWs.emitAsync('message', Buffer.from(JSON.stringify({
    event: 'start',
    start: {
      streamSid,
      callSid: 'CA-test-call-001',
      accountSid: 'AC-test-account',
      tracks: ['inbound'],
      customParameters: {},
    },
  })));
}
