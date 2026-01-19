import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import {
  validateWebSocketConnection,
  unregisterConnection,
} from '../ws-security.js';
import {
  createInvalidToken,
  createNonTwilioIpRequest,
  createProxiedRequest,
  createTwilioIpRequest,
  createValidToken,
} from '../../__tests__/helpers/ws-security-mocks.js';

const originalFetch = globalThis.fetch;

function createWebSocket() {
  return { readyState: WebSocket.OPEN } as WebSocket;
}

describe('ws-security', () => {
  beforeEach(() => {
    vi.stubEnv('ULTAURA_STREAM_TOKEN_SECRET', 'test-secret-at-least-32-characters');
    vi.stubEnv('ULTAURA_INTERNAL_API_SECRET', 'test-internal-secret-at-least-32-characters');
    vi.stubEnv('ULTAURA_WS_SECURITY_MODE', 'enforce');
    vi.stubEnv('TWILIO_MEDIA_IP_ALLOW_UNKNOWN', 'false');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as any);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  it('allows valid Twilio connection in enforce mode', async () => {
    const callSessionId = 'session-enforce-valid';
    const token = createValidToken(callSessionId);
    const req = createTwilioIpRequest();
    const ws = createWebSocket();

    const result = await validateWebSocketConnection(req as any, callSessionId, token, ws);

    expect(result.allowed).toBe(true);
    expect(result.ipCheck.allowed).toBe(true);
    expect(result.tokenCheck.valid).toBe(true);
    expect(result.connectionCapCheck.allowed).toBe(true);

    unregisterConnection(callSessionId, ws);
  });

  it('rejects duplicate connection in enforce mode', async () => {
    const callSessionId = 'session-enforce-dup';
    const token = createValidToken(callSessionId);
    const req = createTwilioIpRequest();
    const ws1 = createWebSocket();
    const ws2 = createWebSocket();

    await validateWebSocketConnection(req as any, callSessionId, token, ws1);
    const result = await validateWebSocketConnection(req as any, callSessionId, token, ws2);

    expect(result.allowed).toBe(false);
    expect(result.connectionCapCheck.reason).toBe('duplicate');

    unregisterConnection(callSessionId, ws1);
  });

  it('allows duplicate connection in audit mode', async () => {
    vi.stubEnv('ULTAURA_WS_SECURITY_MODE', 'audit');
    const callSessionId = 'session-audit-dup';
    const token = createValidToken(callSessionId);
    const req = createTwilioIpRequest();
    const ws1 = createWebSocket();
    const ws2 = createWebSocket();

    await validateWebSocketConnection(req as any, callSessionId, token, ws1);
    const result = await validateWebSocketConnection(req as any, callSessionId, token, ws2);

    expect(result.allowed).toBe(true);
    expect(result.connectionCapCheck.reason).toBe('duplicate');

    unregisterConnection(callSessionId, ws1);
  });

  it('allows unknown IPs when bypass is enabled', async () => {
    vi.stubEnv('TWILIO_MEDIA_IP_ALLOW_UNKNOWN', 'true');
    const callSessionId = 'session-dev-bypass';
    const token = createValidToken(callSessionId);
    const req = createNonTwilioIpRequest();
    const ws = createWebSocket();

    const result = await validateWebSocketConnection(req as any, callSessionId, token, ws);

    expect(result.ipCheck.allowed).toBe(true);
    expect(result.ipCheck.reason).toBe('development');

    unregisterConnection(callSessionId, ws);
  });

  it('uses x-forwarded-for header for IP checks', async () => {
    const callSessionId = 'session-forwarded-for';
    const token = createValidToken(callSessionId);
    const req = createProxiedRequest('168.86.128.10');
    const ws = createWebSocket();

    const result = await validateWebSocketConnection(req as any, callSessionId, token, ws);

    expect(result.ipCheck.ip).toBe('168.86.128.10');
    expect(result.ipCheck.allowed).toBe(true);

    unregisterConnection(callSessionId, ws);
  });

  it('rejects invalid token in enforce mode', async () => {
    const callSessionId = 'session-invalid-token';
    const invalidToken = createInvalidToken(callSessionId);
    const req = createTwilioIpRequest();
    const ws = createWebSocket();

    const result = await validateWebSocketConnection(req as any, callSessionId, invalidToken, ws);

    expect(result.allowed).toBe(false);
    expect(result.tokenCheck.valid).toBe(false);
    expect(result.tokenCheck.reason).toBe('invalid_signature');
    expect(globalThis.fetch).toHaveBeenCalled();
  });
});
