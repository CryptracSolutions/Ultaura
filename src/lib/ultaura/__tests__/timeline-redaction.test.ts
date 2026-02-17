import { describe, it, expect } from 'vitest';

// Test the redaction logic for timeline entries
// These types mirror what will exist in ~/lib/ultaura/admin/timeline-redaction.ts

type TimelineSource =
  | 'call_session'
  | 'call_event'
  | 'safety_event'
  | 'reminder'
  | 'schedule_event'
  | 'opt_out'
  | 'trusted_contact'
  | 'notification_recipient'
  | 'data_export'
  | 'consent_audit'
  | 'telephony_event';

type RedactionMode = 'admin_full' | 'payer_simulated' | 'recipient_simulated';

interface TimelineEntry {
  id: string;
  createdAt: string;
  source: TimelineSource;
  summary: string;
  entityType: string;
  entityId: string;
  accountId: string | null;
  lineId: string | null;
  payload: Record<string, unknown>;
}

// Payer can see these sources
const PAYER_VISIBLE_SOURCES: Set<TimelineSource> = new Set<TimelineSource>([
  'call_session',
  'reminder',
  'schedule_event',
  'opt_out',
  'trusted_contact',
  'data_export',
  'consent_audit',
]);

// Recipient can see these sources
const RECIPIENT_VISIBLE_SOURCES: Set<TimelineSource> = new Set<TimelineSource>([
  'safety_event',
]);

function applyRedaction(
  entries: TimelineEntry[],
  mode: RedactionMode,
): TimelineEntry[] {
  if (mode === 'admin_full') return entries;

  if (mode === 'payer_simulated') {
    return entries
      .filter((e) => PAYER_VISIBLE_SOURCES.has(e.source))
      .map((e) => ({
        ...e,
        payload: {},
        summary: e.source === 'call_session'
          ? e.summary.replace(/\d+s/, '**s')
          : e.summary,
      }));
  }

  if (mode === 'recipient_simulated') {
    return entries
      .filter((e) => RECIPIENT_VISIBLE_SOURCES.has(e.source))
      .map((e) => ({
        ...e,
        payload: {},
        summary: `Safety alert: ${(e.payload as Record<string, string>).tier ?? 'unknown'} tier`,
      }));
  }

  return entries;
}

const mockEntries: TimelineEntry[] = [
  {
    id: '1',
    createdAt: '2026-01-01T00:00:00Z',
    source: 'call_session',
    summary: 'Outbound call - completed (120s)',
    entityType: 'call_session',
    entityId: 'cs-1',
    accountId: 'acc-1',
    lineId: 'line-1',
    payload: { status: 'completed', seconds_connected: 120 },
  },
  {
    id: '2',
    createdAt: '2026-01-01T00:01:00Z',
    source: 'call_event',
    summary: 'Call event: tool_call',
    entityType: 'call_event',
    entityId: 'ce-1',
    accountId: 'acc-1',
    lineId: 'line-1',
    payload: { type: 'tool_call', tool: 'store_memory' },
  },
  {
    id: '3',
    createdAt: '2026-01-01T00:02:00Z',
    source: 'safety_event',
    summary: 'Safety event: high tier - suggested_988',
    entityType: 'safety_event',
    entityId: 'se-1',
    accountId: 'acc-1',
    lineId: 'line-1',
    payload: { tier: 'high', action_taken: 'suggested_988' },
  },
  {
    id: '4',
    createdAt: '2026-01-01T00:03:00Z',
    source: 'telephony_event',
    summary: 'Telephony: status_callback (info)',
    entityType: 'telephony_event',
    entityId: 'te-1',
    accountId: 'acc-1',
    lineId: 'line-1',
    payload: { CallStatus: 'completed', Duration: '120' },
  },
  {
    id: '5',
    createdAt: '2026-01-01T00:04:00Z',
    source: 'reminder',
    summary: 'Reminder sent: Take morning medication',
    entityType: 'reminder',
    entityId: 'r-1',
    accountId: 'acc-1',
    lineId: 'line-1',
    payload: { message: 'Take morning medication', status: 'sent' },
  },
];

describe('timeline redaction', () => {
  describe('admin_full mode', () => {
    it('returns all entries unchanged', () => {
      const result = applyRedaction(mockEntries, 'admin_full');
      expect(result).toHaveLength(5);
      expect(result).toEqual(mockEntries);
    });

    it('preserves full payloads', () => {
      const result = applyRedaction(mockEntries, 'admin_full');
      expect(result[0].payload).toEqual({
        status: 'completed',
        seconds_connected: 120,
      });
    });
  });

  describe('payer_simulated mode', () => {
    it('filters out call_events and telephony_events', () => {
      const result = applyRedaction(mockEntries, 'payer_simulated');
      const sources = result.map((e) => e.source);
      expect(sources).not.toContain('call_event');
      expect(sources).not.toContain('telephony_event');
    });

    it('keeps call_sessions, reminders, and other payer-visible sources', () => {
      const result = applyRedaction(mockEntries, 'payer_simulated');
      const sources = result.map((e) => e.source);
      expect(sources).toContain('call_session');
      expect(sources).toContain('reminder');
    });

    it('filters out safety_events from payer view', () => {
      const result = applyRedaction(mockEntries, 'payer_simulated');
      const sources = result.map((e) => e.source);
      expect(sources).not.toContain('safety_event');
    });

    it('strips payloads', () => {
      const result = applyRedaction(mockEntries, 'payer_simulated');
      for (const entry of result) {
        expect(entry.payload).toEqual({});
      }
    });
  });

  describe('recipient_simulated mode', () => {
    it('only shows safety_events', () => {
      const result = applyRedaction(mockEntries, 'recipient_simulated');
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('safety_event');
    });

    it('strips detailed payload', () => {
      const result = applyRedaction(mockEntries, 'recipient_simulated');
      expect(result[0].payload).toEqual({});
    });
  });

  describe('empty entries', () => {
    it('handles empty array for all modes', () => {
      expect(applyRedaction([], 'admin_full')).toEqual([]);
      expect(applyRedaction([], 'payer_simulated')).toEqual([]);
      expect(applyRedaction([], 'recipient_simulated')).toEqual([]);
    });
  });
});
