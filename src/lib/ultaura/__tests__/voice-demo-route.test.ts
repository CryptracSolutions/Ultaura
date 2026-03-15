import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '~/app/api/voice-demo/route';
import { normalizeLocale } from '~/i18n/locales';

let requestCounter = 10;
const supportedLanguage = 'en';
const supportedLocaleInput = 'en-US';
const normalizedSupportedLocale = normalizeLocale(supportedLocaleInput);
if (!normalizedSupportedLocale) {
  throw new Error('Expected test locale to be supported');
}
const unsupportedLanguage = 'zz';

// Fake audio bytes for mocked xAI TTS response
const fakeAudioBytes = new Uint8Array([0xff, 0xfb, 0x90, 0x00]);

function createPostRequest(body: unknown): NextRequest {
  requestCounter += 1;

  return new NextRequest('http://localhost/api/voice-demo', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `203.0.113.${requestCounter}`,
    },
    body: JSON.stringify(body),
  });
}

describe('voice-demo route', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    // Mock fetch to intercept xAI TTS calls
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url === 'https://api.x.ai/v1/tts') {
        return new Response(fakeAudioBytes, {
          status: 200,
          headers: { 'Content-Type': 'audio/mpeg' },
        });
      }
      return originalFetch(input);
    }) as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns audio for legacy payload with text and voice only', async () => {
    const response = await POST(
      createPostRequest({ text: '  Hello from legacy client  ', voice: 'Ara' }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
  });

  it('returns audio for valid language and locale', async () => {
    const response = await POST(
      createPostRequest({
        text: 'Hello there',
        voice: 'Eve',
        language: supportedLanguage.toUpperCase(),
        locale: supportedLocaleInput.toLowerCase(),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
  });

  it('sends lowercase voice_id to xAI', async () => {
    await POST(
      createPostRequest({ text: 'Hello', voice: 'Ara' }),
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.x.ai/v1/tts',
      expect.objectContaining({
        body: expect.stringContaining('"voice_id":"ara"'),
      }),
    );
  });

  it.each([
    {
      name: 'invalid language format',
      body: { text: 'Hello', voice: 'Ara', language: 'english!!!' },
      expectedError: 'Invalid language format',
    },
    {
      name: 'unsupported language',
      body: { text: 'Hello', voice: 'Ara', language: unsupportedLanguage },
      expectedError: 'Unsupported language',
    },
    {
      name: 'invalid locale format',
      body: { text: 'Hello', voice: 'Ara', locale: 'en-@' },
      expectedError: 'Invalid locale format',
    },
    {
      name: 'unsupported locale',
      body: { text: 'Hello', voice: 'Ara', locale: `${unsupportedLanguage}-US` },
      expectedError: 'Unsupported locale',
    },
  ])('rejects $name', async ({ body, expectedError }) => {
    const response = await POST(createPostRequest(body));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain(expectedError);
  });

  it('keeps existing invalid voice and text validations', async () => {
    const invalidVoiceResponse = await POST(
      createPostRequest({ text: 'Hello', voice: 'InvalidVoice' }),
    );
    const invalidVoicePayload = await invalidVoiceResponse.json();

    expect(invalidVoiceResponse.status).toBe(400);
    expect(invalidVoicePayload.error).toContain('Invalid voice');

    const missingTextResponse = await POST(createPostRequest({ voice: 'Ara' }));
    const missingTextPayload = await missingTextResponse.json();

    expect(missingTextResponse.status).toBe(400);
    expect(missingTextPayload.error).toBe('Text is required');

    const tooLongTextResponse = await POST(
      createPostRequest({ text: 'a'.repeat(201), voice: 'Ara' }),
    );
    const tooLongTextPayload = await tooLongTextResponse.json();

    expect(tooLongTextResponse.status).toBe(400);
    expect(tooLongTextPayload.error).toContain('Text must be 200 characters or less');
  });
});
