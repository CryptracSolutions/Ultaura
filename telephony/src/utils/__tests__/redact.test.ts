import { describe, it, expect } from 'vitest';
import { summarizeArgs, redactSensitive } from '../redact.js';

describe('summarizeArgs', () => {
  it('should summarize string arguments with byte size', () => {
    const args = {
      key: 'preferred_name',
      value: 'This is a longer string value',
    };

    const summary = summarizeArgs(args);

    expect(summary.key).toEqual({ type: 'string', size: 14 });
    expect(summary.value).toEqual({ type: 'string', size: 29 });
  });

  it('should summarize number arguments without size', () => {
    const args = {
      confidence: 0.95,
      count: 42,
    };

    const summary = summarizeArgs(args);

    expect(summary.confidence).toEqual({ type: 'number' });
    expect(summary.count).toEqual({ type: 'number' });
  });

  it('should summarize boolean arguments', () => {
    const args = {
      isRecurring: true,
      suggestReminder: false,
    };

    const summary = summarizeArgs(args);

    expect(summary.isRecurring).toEqual({ type: 'boolean' });
    expect(summary.suggestReminder).toEqual({ type: 'boolean' });
  });

  it('should summarize arrays with total size', () => {
    const args = {
      topics: ['health', 'family', 'hobbies'],
      items: [1, 2, 3, 4, 5],
    };

    const summary = summarizeArgs(args);

    expect(summary.topics.type).toBe('array');
    expect(summary.topics.size).toBeGreaterThan(0);
    expect(summary.items.type).toBe('array');
    expect(summary.items.size).toBeGreaterThan(0);
  });

  it('should summarize nested objects with total size (one level deep)', () => {
    const args = {
      metadata: {
        source: 'conversation',
        nested: {
          deep: 'value',
        },
      },
    };

    const summary = summarizeArgs(args);

    expect(summary.metadata.type).toBe('object');
    expect(summary.metadata.size).toBeGreaterThan(0);
    expect(summary).not.toHaveProperty('metadata.nested');
  });

  it('should handle null and undefined values', () => {
    const args = {
      nullValue: null,
      undefinedValue: undefined,
    };

    const summary = summarizeArgs(args);

    expect(summary.nullValue).toEqual({ type: 'null' });
    expect(summary.undefinedValue).toEqual({ type: 'undefined' });
  });

  it('should handle empty objects', () => {
    const args = {};

    const summary = summarizeArgs(args);

    expect(summary).toEqual({});
  });

  it('should not expose actual string values', () => {
    const sensitiveArgs = {
      message: 'Take your heart medication at 9am',
      value: 'My daughter Sarah lives in Boston',
      context: 'User mentioned feeling lonely today',
    };

    const summary = summarizeArgs(sensitiveArgs);

    const summaryStr = JSON.stringify(summary);
    expect(summaryStr).not.toContain('medication');
    expect(summaryStr).not.toContain('Sarah');
    expect(summaryStr).not.toContain('Boston');
    expect(summaryStr).not.toContain('lonely');
  });

  it('should handle large nested objects efficiently', () => {
    const largeArgs = {
      memories: Array(100).fill({ key: 'test', value: 'x'.repeat(100) }),
      metadata: {
        nested1: { nested2: { nested3: 'deep' } },
      },
    };

    const summary = summarizeArgs(largeArgs);

    expect(summary.memories.type).toBe('array');
    expect(summary.memories.size).toBeGreaterThan(1000);
    expect(summary.metadata.type).toBe('object');
  });

  it('should handle unicode strings correctly', () => {
    const args = {
      name: '日本語テキスト',
      emoji: '😀🎉👋',
    };

    const summary = summarizeArgs(args);

    expect(summary.name.type).toBe('string');
    expect(summary.name.size).toBe(Buffer.byteLength('日本語テキスト', 'utf8'));
    expect(summary.emoji.type).toBe('string');
    expect(summary.emoji.size).toBe(Buffer.byteLength('😀🎉👋', 'utf8'));
  });

  it('should handle circular reference gracefully', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;

    const args = { circular: obj };
    const summary = summarizeArgs(args);

    expect(summary.circular.type).toBe('object');
    expect(summary.circular.size).toBe(0);
  });

  it('should guard against non-object input', () => {
    const nullSummary = summarizeArgs(null as unknown as Record<string, unknown>);
    const arraySummary = summarizeArgs(['value'] as unknown as Record<string, unknown>);

    expect(nullSummary).toEqual({ _invalid: { type: 'null' } });
    expect(arraySummary).toEqual({ _invalid: { type: 'array' } });
  });
});

describe('redactSensitive', () => {
  it('should redact sensitive keys from SENSITIVE_KEYS set', () => {
    const data = {
      id: '123',
      message: 'This is sensitive',
      content: 'Also sensitive',
      text: 'And this too',
    };

    const redacted = redactSensitive(data);

    expect(redacted.id).toBe('123');
    expect(redacted.message).toBe('[REDACTED]');
    expect(redacted.content).toBe('[REDACTED]');
    expect(redacted.text).toBe('[REDACTED]');
  });

  it('should redact nested sensitive keys', () => {
    const data = {
      outer: {
        message: 'Nested sensitive',
        safe: 'This is fine',
      },
    };

    const redacted = redactSensitive(data);

    expect(redacted.outer.message).toBe('[REDACTED]');
    expect(redacted.outer.safe).toBe('This is fine');
  });
});
