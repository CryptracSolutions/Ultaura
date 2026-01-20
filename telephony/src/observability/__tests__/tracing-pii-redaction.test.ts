import { describe, expect, it } from 'vitest';
import type { Span } from '@opentelemetry/api';

import { __internal } from '../tracing.js';

describe('tracing PII redaction', () => {
  it('redacts phone numbers in URL query attributes', () => {
    const attributes: Record<string, unknown> = {};
    const span = {
      setAttribute(key: string, value: unknown) {
        attributes[key] = value;
        return this as unknown as Span;
      },
    } as unknown as Span;

    __internal.applyUrlRedaction(span, {
      url: `/pii?From=%2B15551234567&To=%2B15557654321&callSessionId=session-123`,
      headers: {
        host: 'telephony.local',
        'x-forwarded-proto': 'https',
      },
      socket: {},
    });

    const serialized = JSON.stringify(attributes);
    expect(serialized).not.toContain('+15551234567');
    expect(serialized).not.toContain('+15557654321');
    expect(serialized).not.toContain('15551234567');
    expect(serialized).not.toContain('15557654321');

    expect(attributes['url.query']).toContain('From=%5BREDACTED%5D');
    expect(attributes['url.query']).toContain('To=%5BREDACTED%5D');
    expect(attributes['http.target']).toContain('/pii?');
    expect(attributes['http.url']).toContain('https://telephony.local/pii?');
  });

  it('uses path-only http.url when host is unavailable', () => {
    const attributes: Record<string, unknown> = {};
    const span = {
      setAttribute(key: string, value: unknown) {
        attributes[key] = value;
        return this as unknown as Span;
      },
    } as unknown as Span;

    __internal.applyUrlRedaction(span, {
      url: `/pii?From=%2B15551234567`,
      headers: {},
      socket: {},
    });

    expect(attributes['http.url']).toBe('/pii?From=%5BREDACTED%5D');
  });
});

