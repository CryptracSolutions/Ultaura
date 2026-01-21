import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EphemeralBuffer } from '../ephemeral-buffer.js';

vi.mock('../../server.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../privacy.js', () => ({
  getAccountPrivacySettings: vi.fn(async () => ({ aiSummarizationEnabled: true })),
  getLineVoiceConsent: vi.fn(async () => ({ memoryConsent: 'granted' })),
}));

vi.mock('../memory.js', () => ({
  storeMemory: vi.fn(async () => null),
  updateMemory: vi.fn(async () => null),
  getMemoriesForLine: vi.fn(async () => []),
}));

describe('call summarization consent slicing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-12T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('uses only post-consent turns for extraction', async () => {
    let capturedUserContent: string | null = null;

    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: any) => {
      const body = JSON.parse(init?.body ?? '{}');
      const userMessage = (body?.messages ?? []).find((m: any) => m.role === 'user');
      capturedUserContent = String(userMessage?.content ?? '');

      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '[]' } }] }),
      } as any;
    }) as any);

    const { summarizeAndExtractMemoriesFromBuffer } = await import('../call-summarization.js');

    const buffer: EphemeralBuffer = {
      callSessionId: 'session-1',
      lineId: 'line-1',
      accountId: 'account-1',
      startTime: Date.now(),
      turns: [
        { timestamp: Date.now(), speaker: 'user', summary: 'PRE-CONSENT turn' },
        { timestamp: Date.now(), speaker: 'assistant', summary: 'POST-CONSENT turn' },
      ],
      storedKeys: new Set(),
      consentGrantedAtTurnIndex: 1,
    };

    await summarizeAndExtractMemoriesFromBuffer(buffer);

    expect(capturedUserContent).toBeTruthy();
    expect(capturedUserContent).toContain('POST-CONSENT');
    expect(capturedUserContent).not.toContain('PRE-CONSENT');
  });
});

