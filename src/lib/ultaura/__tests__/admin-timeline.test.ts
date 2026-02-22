import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// Hoisted shared state — must be declared before vi.mock so the factory can close over these refs
const { mockResponses, filterCalls } = vi.hoisted(() => ({
  mockResponses: {} as Record<string, { data: any[] | null; error: any }>,
  filterCalls: [] as Array<{ table: string; method: string; args: any[] }>,
}));

// Override the setup.ts mock with a table-name-keyed chainable mock
vi.mock('~/core/supabase/server-component-client', () => ({
  default: vi.fn(() => ({
    from: (tableName: string) => {
      const chain: any = {
        select: () => chain,
        eq: (...args: any[]) => {
          filterCalls.push({ table: tableName, method: 'eq', args });
          return chain;
        },
        in: (...args: any[]) => {
          filterCalls.push({ table: tableName, method: 'in', args });
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        // Makes the chain thenable — `await query` calls this with Promise's resolve fn
        then: (resolve: (value: any) => any) =>
          resolve(mockResponses[tableName] ?? { data: [], error: null }),
      };
      return chain;
    },
  })),
}));

import { aggregateTimeline } from '~/lib/ultaura/admin/timeline-aggregator';

// --- Row factories ---

function makeCallSessionRow(
  id: string,
  createdAt: string,
  overrides: Record<string, any> = {},
) {
  return {
    id,
    account_id: 'acc-1',
    line_id: 'line-1',
    direction: 'outbound',
    status: 'completed',
    started_at: createdAt,
    ended_at: createdAt,
    seconds_connected: 120,
    end_reason: 'completed',
    is_reminder_call: false,
    twilio_call_sid: `CA${id}`,
    created_at: createdAt,
    ...overrides,
  };
}

function makeSafetyEventRow(
  id: string,
  createdAt: string,
  overrides: Record<string, any> = {},
) {
  return {
    id,
    account_id: 'acc-1',
    line_id: 'line-1',
    call_session_id: null,
    tier: 'low',
    signals: ['distress'],
    action_taken: 'none',
    created_at: createdAt,
    ...overrides,
  };
}

function makeNotificationRecipientRow(
  id: string,
  createdAt: string,
  overrides: Record<string, any> = {},
) {
  return {
    id,
    account_id: 'acc-1',
    name: 'Test Contact',
    email: 'contact@example.com',
    confirmed_at: null,
    unsubscribed_at: null,
    created_at: createdAt,
    ...overrides,
  };
}

function makeDataExportRow(
  id: string,
  createdAt: string,
  overrides: Record<string, any> = {},
) {
  return {
    id,
    account_id: 'acc-1',
    requested_by: 'user-1',
    format: 'json',
    status: 'completed',
    created_at: createdAt,
    ...overrides,
  };
}

// --- Tests ---

describe('aggregateTimeline', () => {
  beforeEach(() => {
    // Reset per-test state without breaking the shared reference
    for (const key of Object.keys(mockResponses)) {
      delete mockResponses[key];
    }
    filterCalls.length = 0;
  });

  it('sorts entries by createdAt DESC', async () => {
    mockResponses['ultaura_call_sessions'] = {
      data: [
        makeCallSessionRow('c1', '2026-01-01T00:00:00Z'),
        makeCallSessionRow('c3', '2026-01-03T00:00:00Z'),
        makeCallSessionRow('c2', '2026-01-02T00:00:00Z'),
      ],
      error: null,
    };

    const result = await aggregateTimeline({ sources: ['call_session'] });

    expect(result.entries.map((e) => e.id)).toEqual(['c3', 'c2', 'c1']);
  });

  it('paginates correctly with offset and limit', async () => {
    // t1 = oldest, t5 = newest. After sort DESC: t5, t4, t3, t2, t1
    const rows = ['t1', 't2', 't3', 't4', 't5'].map((id, i) =>
      makeCallSessionRow(id, `2026-01-0${i + 1}T00:00:00Z`),
    );
    mockResponses['ultaura_call_sessions'] = { data: rows, error: null };

    // offset: 2, limit: 2 → indices [2, 3] → t3, t2
    const result = await aggregateTimeline({
      sources: ['call_session'],
      offset: 2,
      limit: 2,
    });

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].id).toBe('t3');
    expect(result.entries[1].id).toBe('t2');
  });

  it('paginates correctly with offset only (no limit)', async () => {
    // After sort DESC: t5, t4, t3, t2, t1
    const rows = ['t1', 't2', 't3', 't4', 't5'].map((id, i) =>
      makeCallSessionRow(id, `2026-01-0${i + 1}T00:00:00Z`),
    );
    mockResponses['ultaura_call_sessions'] = { data: rows, error: null };

    // offset: 3, no limit → indices [3, 4] → t2, t1
    const result = await aggregateTimeline({
      sources: ['call_session'],
      offset: 3,
    });

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].id).toBe('t2');
    expect(result.entries[1].id).toBe('t1');
  });

  it('returns total as the full count, not the paginated slice size', async () => {
    const rows = ['t1', 't2', 't3', 't4', 't5'].map((id, i) =>
      makeCallSessionRow(id, `2026-01-0${i + 1}T00:00:00Z`),
    );
    mockResponses['ultaura_call_sessions'] = { data: rows, error: null };

    const result = await aggregateTimeline({
      sources: ['call_session'],
      offset: 2,
      limit: 2,
    });

    expect(result.total).toBe(5);
    expect(result.entries).toHaveLength(2); // paginated slice is still 2
  });

  it('applies accountIds filter via .in("account_id")', async () => {
    mockResponses['ultaura_call_sessions'] = { data: [], error: null };

    await aggregateTimeline({
      sources: ['call_session'],
      accountIds: ['acc-abc'],
    });

    const accountFilter = filterCalls.find(
      (c) =>
        c.table === 'ultaura_call_sessions' &&
        c.method === 'in' &&
        c.args[0] === 'account_id',
    );
    expect(accountFilter).toBeDefined();
    expect(accountFilter!.args[1]).toEqual(['acc-abc']);
  });

  it('applies lineIds filter via .in("line_id")', async () => {
    mockResponses['ultaura_call_sessions'] = { data: [], error: null };

    await aggregateTimeline({
      sources: ['call_session'],
      lineIds: ['line-xyz'],
    });

    const lineFilter = filterCalls.find(
      (c) =>
        c.table === 'ultaura_call_sessions' &&
        c.method === 'in' &&
        c.args[0] === 'line_id',
    );
    expect(lineFilter).toBeDefined();
    expect(lineFilter!.args[1]).toEqual(['line-xyz']);
  });

  it('account-only sources (notification_recipient, data_export) ignore lineIds filter', async () => {
    mockResponses['ultaura_notification_recipients'] = {
      data: [makeNotificationRecipientRow('nr-1', '2026-01-01T00:00:00Z')],
      error: null,
    };
    mockResponses['ultaura_data_export_requests'] = {
      data: [makeDataExportRow('de-1', '2026-01-02T00:00:00Z')],
      error: null,
    };

    const result = await aggregateTimeline({
      sources: ['notification_recipient', 'data_export'],
      accountIds: ['acc-1'],
      lineIds: ['line-xyz'],
    });

    // Both account-only sources should still return their rows despite lineIds being provided
    expect(result.entries).toHaveLength(2);
    expect(result.entries.map((e) => e.source).sort()).toEqual([
      'data_export',
      'notification_recipient',
    ]);

    // No line_id filter should have been applied to either account-only table
    const lineFilterOnRecipients = filterCalls.find(
      (c) =>
        c.table === 'ultaura_notification_recipients' &&
        c.method === 'in' &&
        c.args[0] === 'line_id',
    );
    const lineFilterOnExports = filterCalls.find(
      (c) =>
        c.table === 'ultaura_data_export_requests' &&
        c.method === 'in' &&
        c.args[0] === 'line_id',
    );
    expect(lineFilterOnRecipients).toBeUndefined();
    expect(lineFilterOnExports).toBeUndefined();
  });

  it('only queries sources listed in the sources filter', async () => {
    mockResponses['ultaura_call_sessions'] = {
      data: [makeCallSessionRow('cs-1', '2026-01-02T00:00:00Z')],
      error: null,
    };
    mockResponses['ultaura_safety_events'] = {
      data: [makeSafetyEventRow('se-1', '2026-01-01T00:00:00Z')],
      error: null,
    };

    const result = await aggregateTimeline({
      sources: ['call_session', 'safety_event'],
    });

    const sources = result.entries.map((e) => e.source);
    expect(sources).toContain('call_session');
    expect(sources).toContain('safety_event');
    // No other source types should appear
    expect(
      sources.every((s) => s === 'call_session' || s === 'safety_event'),
    ).toBe(true);
    expect(result.total).toBe(2);
  });

  it('returns empty entries and zero total when all sources have no data', async () => {
    mockResponses['ultaura_call_sessions'] = { data: [], error: null };
    mockResponses['ultaura_safety_events'] = { data: [], error: null };

    const result = await aggregateTimeline({
      sources: ['call_session', 'safety_event'],
    });

    expect(result.entries).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('gracefully handles a source fetch failure — failed source contributes empty, others still returned', async () => {
    mockResponses['ultaura_call_sessions'] = {
      data: null,
      error: { message: 'timeout' },
    };
    mockResponses['ultaura_safety_events'] = {
      data: [makeSafetyEventRow('se-1', '2026-01-01T00:00:00Z')],
      error: null,
    };

    const result = await aggregateTimeline({
      sources: ['call_session', 'safety_event'],
    });

    // Failed source contributes nothing; successful source is still returned
    expect(result.total).toBe(1);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].source).toBe('safety_event');
    expect(result.entries[0].id).toBe('se-1');
  });
});
