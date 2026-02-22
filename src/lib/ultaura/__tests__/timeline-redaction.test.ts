import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { applyRedaction } from '~/lib/ultaura/admin/timeline-redaction';
import type { TimelineEntry } from '~/lib/ultaura/admin/timeline-aggregator';

function createEntry(overrides: Partial<TimelineEntry>): TimelineEntry {
  return {
    id: 'entry-1',
    createdAt: '2026-01-01T00:00:00Z',
    source: 'call_session',
    summary: 'Outbound call - completed (120s)',
    entityType: 'call_session',
    entityId: 'call-session-1',
    accountId: 'account-1',
    lineId: 'line-1',
    payload: {},
    ...overrides,
  };
}

describe('timeline-redaction', () => {
  it('returns entries unchanged for admin_full mode', () => {
    const entries: TimelineEntry[] = [
      createEntry({
        source: 'telephony_event',
        payload: { event_type: 'status_callback', severity: 'info' },
      }),
      createEntry({
        id: 'entry-2',
        source: 'call_event',
        payload: { type: 'tool_call', event_payload: { tool: 'store_memory' } },
      }),
    ];

    const redacted = applyRedaction(entries, 'admin_full');

    expect(redacted).toEqual(entries);
  });

  it('filters payer view to payer-visible sources (including safety_event)', () => {
    const entries: TimelineEntry[] = [
      createEntry({ id: 'call-session', source: 'call_session' }),
      createEntry({ id: 'safety', source: 'safety_event' }),
      createEntry({ id: 'reminder', source: 'reminder' }),
      createEntry({ id: 'call-event', source: 'call_event' }),
      createEntry({ id: 'telephony', source: 'telephony_event' }),
      createEntry({
        id: 'recipient',
        source: 'notification_recipient',
      }),
    ];

    const redacted = applyRedaction(entries, 'payer_simulated');
    const sources = redacted.map((entry) => entry.source);

    expect(sources).toEqual(['call_session', 'safety_event', 'reminder']);
  });

  it('redacts call session payload fields for payer view', () => {
    const [redacted] = applyRedaction(
      [
        createEntry({
          source: 'call_session',
          payload: {
            direction: 'outbound',
            status: 'completed',
            seconds_connected: 120,
            twilio_call_sid: 'CA123',
            end_reason: 'completed',
          },
        }),
      ],
      'payer_simulated',
    );

    expect(redacted.payload).toEqual({
      direction: 'outbound',
      status: 'completed',
      seconds_connected: 120,
    });
  });

  it('redacts safety_event summary and payload details for payer view', () => {
    const [redacted] = applyRedaction(
      [
        createEntry({
          source: 'safety_event',
          summary: 'Safety event: high tier - suggested_988',
          payload: {
            tier: 'high',
            signals: ['hopeless'],
            action_taken: 'suggested_988',
          },
        }),
      ],
      'payer_simulated',
    );

    expect(redacted.summary).toBe('Safety event: high tier');
    expect(redacted.payload).toEqual({
      tier: 'high',
      signals: '[hidden]',
      action_taken: '[hidden]',
    });
  });

  it('redacts reminder encrypted payload marker for payer view', () => {
    const [redacted] = applyRedaction(
      [
        createEntry({
          source: 'reminder',
          payload: {
            message: 'Take medication',
            has_encrypted_message: true,
            status: 'sent',
          },
        }),
      ],
      'payer_simulated',
    );

    expect(redacted.payload).toEqual({
      message: '[hidden]',
      status: 'sent',
    });
  });

  it('shows only minimal safety details for recipient view', () => {
    const entries: TimelineEntry[] = [
      createEntry({
        id: 'safety',
        source: 'safety_event',
        summary: 'Safety event: medium tier - suggested_911',
        payload: {
          tier: 'medium',
          signals: ['distress'],
          action_taken: 'suggested_911',
          call_session_id: 'call-1',
        },
      }),
      createEntry({ id: 'reminder', source: 'reminder' }),
    ];

    const redacted = applyRedaction(entries, 'recipient_simulated');

    expect(redacted).toHaveLength(1);
    expect(redacted[0].source).toBe('safety_event');
    expect(redacted[0].summary).toBe('Safety alert: medium tier');
    expect(redacted[0].payload).toEqual({
      tier: 'medium',
      signals: '[hidden]',
      action_taken: '[hidden]',
      call_session_id: '[hidden]',
    });
  });

  it('strips nested payload values for safe pass-through sources', () => {
    const [redacted] = applyRedaction(
      [
        createEntry({
          source: 'schedule_event',
          payload: {
            event_type: 'triggered',
            metadata: { reason: 'scheduler' },
            tags: ['nightly'],
            triggered_by: 'system',
          },
        }),
      ],
      'payer_simulated',
    );

    expect(redacted.payload).toEqual({
      event_type: 'triggered',
      metadata: '[hidden]',
      tags: '[hidden]',
      triggered_by: 'system',
    });
  });

  it('redacts trusted_contact phone for payer view', () => {
    const [redacted] = applyRedaction(
      [
        createEntry({
          source: 'trusted_contact',
          payload: { name: 'Jane', phone_e164: '+14155551234', enabled: true },
        }),
      ],
      'payer_simulated',
    );

    expect(redacted.payload).toEqual({
      name: 'Jane',
      phone_e164: '[hidden]',
      enabled: true,
    });
  });

  it('redacts consent_audit sensitive fields for payer view', () => {
    const [redacted] = applyRedaction(
      [
        createEntry({
          source: 'consent_audit',
          payload: {
            actor_type: 'system',
            action: 'granted',
            consent_type: 'calls',
            old_value: false,
            new_value: true,
          },
        }),
      ],
      'payer_simulated',
    );

    expect(redacted.payload).toEqual({
      action: 'granted',
      consent_type: 'calls',
      old_value: '[hidden]',
      new_value: '[hidden]',
      actor_type: '[hidden]',
    });
  });

  it('strips nested payloads from opt_out for payer view', () => {
    const [redacted] = applyRedaction(
      [
        createEntry({
          source: 'opt_out',
          payload: { channel: 'calls', reason: 'personal', source: 'voice' },
        }),
      ],
      'payer_simulated',
    );

    expect(redacted.payload).toEqual({
      channel: 'calls',
      reason: 'personal',
      source: 'voice',
    });
  });

  it('strips nested payloads from data_export for payer view', () => {
    const [redacted] = applyRedaction(
      [
        createEntry({
          source: 'data_export',
          payload: { requested_by: 'user-1', format: 'json', status: 'completed' },
        }),
      ],
      'payer_simulated',
    );

    expect(redacted.payload).toEqual({
      requested_by: 'user-1',
      format: 'json',
      status: 'completed',
    });
  });
});
