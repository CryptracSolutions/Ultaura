import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateStreamToken, validateStreamToken } from '../stream-token.js';

describe('stream-token', () => {
  beforeEach(() => {
    vi.stubEnv('ULTAURA_STREAM_TOKEN_SECRET', 'test-secret-at-least-32-characters');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('generates a token with correct format', () => {
    const token = generateStreamToken('test-session-id');
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('test-session-id');
  });

  it('sets expiry 5 minutes in the future', () => {
    vi.useFakeTimers();
    const baseTime = new Date('2025-01-01T00:00:00Z');
    vi.setSystemTime(baseTime);

    const token = generateStreamToken('test-session-id');
    const [, expStr] = token.split('.');
    const exp = Number.parseInt(expStr, 10);
    const expectedExp = Math.floor(baseTime.getTime() / 1000) + 300;

    expect(exp).toBe(expectedExp);
  });

  it('validates a fresh token', () => {
    const token = generateStreamToken('test-session-id');
    const result = validateStreamToken(token, 'test-session-id');
    expect(result.valid).toBe(true);
    expect(result.reason).toBe('valid');
  });

  it('rejects expired token', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const token = generateStreamToken('test-session-id');

    vi.setSystemTime(new Date('2025-01-01T00:06:00Z'));
    const result = validateStreamToken(token, 'test-session-id');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('expired');
  });

  it('rejects token for wrong session', () => {
    const token = generateStreamToken('test-session-id');
    const result = validateStreamToken(token, 'different-session');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid_signature');
  });

  it('rejects malformed token', () => {
    const result = validateStreamToken('bad.token', 'test-session-id');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('malformed');
  });

  it('accepts token signed with previous key', () => {
    vi.stubEnv('ULTAURA_STREAM_TOKEN_SECRET', 'old-secret-at-least-32-characters');
    const token = generateStreamToken('test-session-id');

    vi.stubEnv('ULTAURA_STREAM_TOKEN_SECRET', 'new-secret-at-least-32-characters');
    vi.stubEnv('ULTAURA_STREAM_TOKEN_SECRET_PREVIOUS', 'old-secret-at-least-32-characters');

    const result = validateStreamToken(token, 'test-session-id');
    expect(result.valid).toBe(true);
    expect(result.reason).toBe('valid');
  });
});
