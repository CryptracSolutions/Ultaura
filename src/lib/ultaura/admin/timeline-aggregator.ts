import 'server-only';

import getLogger from '~/core/logger';
const logger = getLogger();

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';

export type TimelineSource =
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

export interface TimelineEntry {
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

export type RedactionMode =
  | 'admin_full'
  | 'payer_simulated'
  | 'recipient_simulated';

export interface TimelineFilter {
  accountIds?: string[];
  lineIds?: string[];
  sources?: TimelineSource[];
  limit?: number;
  offset?: number;
}

/**
 * PERFORMANCE NOTE — In-memory merge
 *
 * Current approach: fetch up to SOURCE_LIMIT (500) rows per source (11 sources = 5,500 max),
 * merge in memory, sort by createdAt desc, paginate via offset/limit.
 *
 * This is acceptable at current scale. Migrate to DB-level UNION ALL when:
 * - Any single source table exceeds ~10,000 rows for a single account/line filter
 * - p95 response time for /admin/timeline exceeds 1.5 seconds
 * - Total row count across all sources exceeds ~50,000 for a filtered query
 *
 * Tracking: Monitor via server-side timing logs or APM. The aggregateTimeline function
 * is instrumented with duration logging below.
 *
 * See follow-up task description at the bottom of this file.
 */
const ALL_SOURCES: TimelineSource[] = [
  'call_session',
  'call_event',
  'safety_event',
  'reminder',
  'schedule_event',
  'opt_out',
  'trusted_contact',
  'notification_recipient',
  'data_export',
  'consent_audit',
  'telephony_event',
];

export async function aggregateTimeline(filter: TimelineFilter): Promise<{
  entries: TimelineEntry[];
  total: number;
}> {
  const start = performance.now();
  const client = getSupabaseServerComponentClient({ admin: true });
  const sources = filter.sources?.length ? filter.sources : ALL_SOURCES;
  const limit = filter.limit;
  const offset = filter.offset ?? 0;

  const results = await Promise.all(
    sources.map((source) =>
      fetchSourceEntries(client, source, filter.accountIds, filter.lineIds),
    ),
  );
  const allEntries = results.flat();

  allEntries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const total = allEntries.length;
  const paginated =
    typeof limit === 'number'
      ? allEntries.slice(offset, offset + limit)
      : allEntries.slice(offset);

  const durationMs = Math.round(performance.now() - start);
  logger.info({ durationMs, total: allEntries.length, sourceCount: results.length }, 'Timeline aggregation completed');

  return { entries: paginated, total };
}

type SupabaseAdminClient = ReturnType<typeof getSupabaseServerComponentClient>;

const SOURCE_LIMIT = 500;

async function fetchSourceEntries(
  client: SupabaseAdminClient,
  source: TimelineSource,
  accountIds?: string[],
  lineIds?: string[],
): Promise<TimelineEntry[]> {
  switch (source) {
    case 'call_session':
      return fetchCallSessions(client, accountIds, lineIds);
    case 'call_event':
      return fetchCallEvents(client, accountIds, lineIds);
    case 'safety_event':
      return fetchSafetyEvents(client, accountIds, lineIds);
    case 'reminder':
      return fetchReminders(client, accountIds, lineIds);
    case 'schedule_event':
      return fetchScheduleEvents(client, accountIds, lineIds);
    case 'opt_out':
      return fetchOptOuts(client, accountIds, lineIds);
    case 'trusted_contact':
      return fetchTrustedContacts(client, accountIds, lineIds);
    case 'notification_recipient':
      return fetchNotificationRecipients(client, accountIds);
    case 'data_export':
      return fetchDataExports(client, accountIds);
    case 'consent_audit':
      return fetchConsentAudit(client, accountIds, lineIds);
    case 'telephony_event':
      return fetchTelephonyEvents(client, accountIds, lineIds);
    default:
      return [];
  }
}

function applyAccountAndLineFilters(
  query: any,
  accountIds?: string[],
  lineIds?: string[],
  accountColumn = 'account_id',
  lineColumn = 'line_id',
) {
  let filtered = query;
  if (accountIds?.length) {
    filtered = filtered.in(accountColumn, accountIds);
  }
  if (lineIds?.length) {
    filtered = filtered.in(lineColumn, lineIds);
  }
  return filtered;
}

function applyAccountFilter(
  query: any,
  accountIds?: string[],
  accountColumn = 'account_id',
) {
  if (accountIds?.length) {
    return query.in(accountColumn, accountIds);
  }
  return query;
}

async function fetchCallSessions(
  client: SupabaseAdminClient,
  accountIds?: string[],
  lineIds?: string[],
): Promise<TimelineEntry[]> {
  let query = client
    .from('ultaura_call_sessions')
    .select(
      'id, account_id, line_id, direction, status, started_at, ended_at, seconds_connected, end_reason, is_reminder_call, twilio_call_sid, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(SOURCE_LIMIT);

  query = applyAccountAndLineFilters(query, accountIds, lineIds);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => {
    const secondsPart = row.seconds_connected != null ? ` (${row.seconds_connected}s)` : '';

    return {
      id: row.id,
      createdAt: row.created_at,
      source: 'call_session' as const,
      summary: `${row.direction ?? 'unknown'} call - ${row.status ?? 'unknown'}${secondsPart}`,
      entityType: 'call_session',
      entityId: row.id,
      accountId: row.account_id,
      lineId: row.line_id,
      payload: {
        direction: row.direction,
        status: row.status,
        started_at: row.started_at,
        ended_at: row.ended_at,
        seconds_connected: row.seconds_connected,
        end_reason: row.end_reason,
        is_reminder_call: row.is_reminder_call,
        twilio_call_sid: row.twilio_call_sid,
      },
    };
  });
}

async function fetchCallEvents(
  client: SupabaseAdminClient,
  accountIds?: string[],
  lineIds?: string[],
): Promise<TimelineEntry[]> {
  // call_events link through call_session_id; if we have accountIds/lineIds
  // we need to first find matching session IDs
  let sessionIds: string[] | undefined;

  if (accountIds?.length || lineIds?.length) {
    let sessionQuery = client
      .from('ultaura_call_sessions')
      .select('id');

    sessionQuery = applyAccountAndLineFilters(sessionQuery, accountIds, lineIds);
    const { data: sessions } = await sessionQuery;
    if (!sessions?.length) return [];

    sessionIds = sessions.map((session: any) => session.id);
  }

  let query = client
    .from('ultaura_call_events')
    .select('id, call_session_id, type, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(SOURCE_LIMIT);

  if (sessionIds) {
    query = query.in('call_session_id', sessionIds);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    createdAt: row.created_at,
    source: 'call_event' as const,
    summary: `Call event: ${row.type ?? 'unknown'}`,
    entityType: 'call_event',
    entityId: row.id,
    accountId: null,
    lineId: null,
    payload: {
      call_session_id: row.call_session_id,
      type: row.type,
      event_payload: row.payload,
    },
  }));
}

async function fetchSafetyEvents(
  client: SupabaseAdminClient,
  accountIds?: string[],
  lineIds?: string[],
): Promise<TimelineEntry[]> {
  let query = client
    .from('ultaura_safety_events')
    .select(
      'id, account_id, line_id, call_session_id, tier, signals, action_taken, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(SOURCE_LIMIT);

  query = applyAccountAndLineFilters(query, accountIds, lineIds);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    createdAt: row.created_at,
    source: 'safety_event' as const,
    summary: `Safety event: ${row.tier ?? 'unknown'} tier - ${row.action_taken ?? 'none'}`,
    entityType: 'safety_event',
    entityId: row.id,
    accountId: row.account_id,
    lineId: row.line_id,
    payload: {
      call_session_id: row.call_session_id,
      tier: row.tier,
      signals: row.signals,
      action_taken: row.action_taken,
    },
  }));
}

async function fetchReminders(
  client: SupabaseAdminClient,
  accountIds?: string[],
  lineIds?: string[],
): Promise<TimelineEntry[]> {
  let query = client
    .from('ultaura_reminders')
    .select(
      'id, account_id, line_id, due_at, message, message_ciphertext, status, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(SOURCE_LIMIT);

  query = applyAccountAndLineFilters(query, accountIds, lineIds);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => {
    const messagePreview = getReminderMessagePreview(
      row.message,
      row.message_ciphertext,
    );

    return {
      id: row.id,
      createdAt: row.created_at,
      source: 'reminder' as const,
      summary: `Reminder ${row.status ?? 'unknown'}: ${messagePreview}`,
      entityType: 'reminder',
      entityId: row.id,
      accountId: row.account_id,
      lineId: row.line_id,
      payload: {
        due_at: row.due_at,
        message: row.message ?? null,
        has_encrypted_message: !!row.message_ciphertext,
        status: row.status,
      },
    };
  });
}

function getReminderMessagePreview(
  message: string | null,
  messageCiphertext: string | null,
): string {
  if (message) {
    return message.length > 50 ? `${message.slice(0, 50)}...` : message;
  }

  if (messageCiphertext) {
    return '[encrypted reminder]';
  }

  return '[no message]';
}

async function fetchScheduleEvents(
  client: SupabaseAdminClient,
  accountIds?: string[],
  lineIds?: string[],
): Promise<TimelineEntry[]> {
  let query = client
    .from('ultaura_schedule_events')
    .select(
      'id, account_id, line_id, schedule_id, event_type, triggered_by, metadata, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(SOURCE_LIMIT);

  query = applyAccountAndLineFilters(query, accountIds, lineIds);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    createdAt: row.created_at,
    source: 'schedule_event' as const,
    summary: `Schedule ${row.event_type ?? 'unknown'} (${row.triggered_by ?? 'unknown'})`,
    entityType: 'schedule_event',
    entityId: row.id,
    accountId: row.account_id,
    lineId: row.line_id,
    payload: {
      schedule_id: row.schedule_id,
      event_type: row.event_type,
      triggered_by: row.triggered_by,
      metadata: row.metadata,
    },
  }));
}

async function fetchOptOuts(
  client: SupabaseAdminClient,
  accountIds?: string[],
  lineIds?: string[],
): Promise<TimelineEntry[]> {
  let query = client
    .from('ultaura_opt_outs')
    .select('id, account_id, line_id, channel, reason, source, created_at')
    .order('created_at', { ascending: false })
    .limit(SOURCE_LIMIT);

  query = applyAccountAndLineFilters(query, accountIds, lineIds);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    createdAt: row.created_at,
    source: 'opt_out' as const,
    summary: `Opt-out: ${row.channel ?? 'unknown'} via ${row.source ?? 'unknown'}`,
    entityType: 'opt_out',
    entityId: row.id,
    accountId: row.account_id,
    lineId: row.line_id,
    payload: {
      channel: row.channel,
      reason: row.reason,
      source: row.source,
    },
  }));
}

async function fetchTrustedContacts(
  client: SupabaseAdminClient,
  accountIds?: string[],
  lineIds?: string[],
): Promise<TimelineEntry[]> {
  let query = client
    .from('ultaura_trusted_contacts')
    .select(
      'id, account_id, line_id, name, phone_e164, enabled, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(SOURCE_LIMIT);

  query = applyAccountAndLineFilters(query, accountIds, lineIds);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    createdAt: row.created_at,
    source: 'trusted_contact' as const,
    summary: `Trusted contact: ${row.name ?? 'unnamed'} (${row.enabled ? 'active' : 'removed'})`,
    entityType: 'trusted_contact',
    entityId: row.id,
    accountId: row.account_id,
    lineId: row.line_id,
    payload: {
      name: row.name,
      phone_e164: row.phone_e164,
      enabled: row.enabled,
    },
  }));
}

async function fetchNotificationRecipients(
  client: SupabaseAdminClient,
  accountIds?: string[],
): Promise<TimelineEntry[]> {
  let query = client
    .from('ultaura_notification_recipients')
    .select(
      'id, account_id, name, email, confirmed_at, unsubscribed_at, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(SOURCE_LIMIT);

  query = applyAccountFilter(query, accountIds);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    createdAt: row.created_at,
    source: 'notification_recipient' as const,
    summary: `Notification recipient: ${row.name ?? 'unnamed'} <${row.email ?? 'no email'}>`,
    entityType: 'notification_recipient',
    entityId: row.id,
    accountId: row.account_id,
    lineId: null,
    payload: {
      name: row.name,
      email: row.email,
      confirmed_at: row.confirmed_at,
      unsubscribed_at: row.unsubscribed_at,
    },
  }));
}

async function fetchDataExports(
  client: SupabaseAdminClient,
  accountIds?: string[],
): Promise<TimelineEntry[]> {
  let query = client
    .from('ultaura_data_export_requests')
    .select('id, account_id, requested_by, format, status, created_at')
    .order('created_at', { ascending: false })
    .limit(SOURCE_LIMIT);

  query = applyAccountFilter(query, accountIds);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    createdAt: row.created_at,
    source: 'data_export' as const,
    summary: `Data export: ${row.status ?? 'unknown'} (${row.format ?? 'unknown'})`,
    entityType: 'data_export',
    entityId: row.id,
    accountId: row.account_id,
    lineId: null,
    payload: {
      requested_by: row.requested_by,
      format: row.format,
      status: row.status,
    },
  }));
}

async function fetchConsentAudit(
  client: SupabaseAdminClient,
  accountIds?: string[],
  lineIds?: string[],
): Promise<TimelineEntry[]> {
  let query = client
    .from('ultaura_consent_audit_log')
    .select(
      'id, account_id, line_id, actor_type, action, consent_type, old_value, new_value, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(SOURCE_LIMIT);

  query = applyAccountAndLineFilters(query, accountIds, lineIds);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    createdAt: row.created_at,
    source: 'consent_audit' as const,
    summary: `Consent: ${row.action ?? 'unknown'} - ${row.consent_type ?? 'unknown'}`,
    entityType: 'consent_audit',
    entityId: row.id,
    accountId: row.account_id,
    lineId: row.line_id,
    payload: {
      actor_type: row.actor_type,
      action: row.action,
      consent_type: row.consent_type,
      old_value: row.old_value,
      new_value: row.new_value,
    },
  }));
}

async function fetchTelephonyEvents(
  client: SupabaseAdminClient,
  accountIds?: string[],
  lineIds?: string[],
): Promise<TimelineEntry[]> {
  let query = client
    .from('ultaura_telephony_event_log' as any)
    .select(
      'id, account_id, line_id, call_session_id, event_type, payload_redacted, severity, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(SOURCE_LIMIT);

  query = applyAccountAndLineFilters(query, accountIds, lineIds);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    createdAt: row.created_at,
    source: 'telephony_event' as const,
    summary: `Telephony: ${row.event_type ?? 'unknown'} (${row.severity ?? 'info'})`,
    entityType: 'telephony_event',
    entityId: row.id,
    accountId: row.account_id,
    lineId: row.line_id,
    payload: {
      call_session_id: row.call_session_id,
      event_type: row.event_type,
      payload_redacted: row.payload_redacted,
      severity: row.severity,
    },
  }));
}

/**
 * FOLLOW-UP TASK: Migrate aggregateTimeline to UNION ALL
 *
 * When the monitoring thresholds above are hit, replace the in-memory merge with
 * a database-level UNION ALL query. Approach:
 *
 * 1. Create a Postgres function `aggregate_timeline(p_account_id uuid, p_line_id uuid, ...filters)`
 *    that UNIONs all 11 source tables with normalized column names (id, source, created_at, payload jsonb)
 * 2. Apply WHERE filters (account_id, line_id, date range) at the SQL level
 * 3. ORDER BY created_at DESC, LIMIT/OFFSET at the SQL level
 * 4. Return paginated results with a COUNT(*) OVER() window for total
 * 5. The TypeScript function becomes a thin wrapper: call RPC, map rows to TimelineEntry[]
 *
 * Benefits:
 * - Pagination is DB-native (no in-memory sort/slice)
 * - Only fetches the rows needed for the current page
 * - Scales to millions of rows per source
 *
 * Risks:
 * - Complex SQL function (11-way UNION with different column shapes)
 * - Must maintain parity with TypeScript source fetchers (column mappings, joins)
 * - Migration requires parallel testing (run both paths, compare results)
 *
 * Estimated effort: Medium (1-2 days)
 * Priority trigger: p95 > 1.5s OR any source > 10k rows for a single filter
 */
