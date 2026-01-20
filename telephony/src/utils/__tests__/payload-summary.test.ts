import { describe, it, expect } from 'vitest';
import { buildPayloadSummary } from '../payload-summary.js';

describe('buildPayloadSummary', () => {
  it('preserves existing argsSummary for tool call payloads', () => {
    const toolCallPayload = {
      tool: 'store-memory',
      argsSummary: {
        memoryType: { type: 'string', size: 12 },
        key: { type: 'string', size: 8 },
        value: { type: 'string', size: 156 },
      },
    };

    const summary = buildPayloadSummary(toolCallPayload);

    expect(summary).toEqual({
      tool: 'store-memory',
      argsSummary: {
        memoryType: { type: 'string', size: 12 },
        key: { type: 'string', size: 8 },
        value: { type: 'string', size: 156 },
      },
    });
  });

  it('summarizes raw payloads without argsSummary', () => {
    const rawPayload = { foo: 'bar', count: 42 };
    const summary = buildPayloadSummary(rawPayload);

    expect(summary).toHaveProperty('foo');
    expect(summary.foo).toHaveProperty('type', 'string');
  });

  it('handles missing tool field gracefully', () => {
    const payload = {
      argsSummary: { key: { type: 'string', size: 5 } },
    };

    const summary = buildPayloadSummary(payload);

    expect(summary).toEqual({
      tool: undefined,
      argsSummary: { key: { type: 'string', size: 5 } },
    });
  });
});
