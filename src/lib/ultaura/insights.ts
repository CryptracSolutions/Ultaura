'use server';

import crypto from 'crypto';
import { DateTime } from 'luxon';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CallInsights,
  ConcernCode,
  FollowUpReasonCode,
  MemoryType,
  SharingTier,
  VoiceConsentStatus,
  TopicCode,
} from '@ultaura/types';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import requireSession from '~/lib/user/require-session';
import getLogger from '~/core/logger';
import type {
  CallSessionRow,
  ConversationHighlightsData,
  EmotionalTrendEntry,
  EmotionalTrendsData,
  InsightPrivacyRow,
  InsightPrivacySettings,
  InsightsDashboard,
  LineBaselineRow,
  LineRow,
  MemoryActivityData,
  MemoryActivityItem,
  MoodCalendarData,
  MoodCalendarDay,
  MoodEnergyLevel,
  MoodSnapshotMood,
  MoodSnapshotRow,
  MoodTrajectory,
  NotificationPreferencesRow,
  RelationshipIndicator,
  RelationshipIndicatorsData,
  WeeklySummaryData,
  WeeklySummaryRow,
} from './types';
import { INSIGHTS } from './constants';
import type { SegmentType } from './types/retention';
import { getPrivateTopicCodes, getSharingGate } from './sharing-gate';
import { logConsentAudit } from './privacy';
import { decodeBytea, encodeBytea, type ByteaInput } from './bytea';
import { unwrapDEK, wrapDEKWithCurrentKey } from './crypto-kek';

const logger = getLogger();

interface EncryptedPayload {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
}

interface EncryptedPayloadInput {
  ciphertext: ByteaInput;
  iv: ByteaInput;
  tag: ByteaInput;
}

const INSIGHTS_ALG = 'aes-256-gcm';

function toUint8Array(value: Uint8Array | Buffer): Uint8Array {
  return Uint8Array.from(value);
}

function decodeByteaOrThrow(
  label: string,
  value: ByteaInput,
  expectedLength?: number
): Buffer {
  const decoded = decodeBytea(value);
  if (!decoded) {
    logger.error({ label, valueType: typeof value }, 'Failed to decode bytea value');
    throw new Error(`Invalid ${label} payload`);
  }
  if (expectedLength && decoded.length !== expectedLength) {
    logger.error(
      { label, expectedLength, actualLength: decoded.length },
      'Bytea payload length mismatch'
    );
    throw new Error(`Invalid ${label} length`);
  }
  return Buffer.from(decoded);
}

function decodeEncryptedPayload(
  labelPrefix: string,
  encrypted: EncryptedPayloadInput
): EncryptedPayload {
  return {
    ciphertext: decodeByteaOrThrow(`${labelPrefix}.ciphertext`, encrypted.ciphertext),
    iv: decodeByteaOrThrow(`${labelPrefix}.iv`, encrypted.iv, 12),
    tag: decodeByteaOrThrow(`${labelPrefix}.tag`, encrypted.tag, 16),
  };
}

function decryptValue(
  dek: Buffer,
  ciphertext: Buffer,
  iv: Buffer,
  tag: Buffer,
  aad: Buffer
): CallInsights | WeeklySummaryData {
  const decipher = crypto.createDecipheriv(
    INSIGHTS_ALG,
    toUint8Array(dek),
    toUint8Array(iv),
    { authTagLength: 16 }
  );

  decipher.setAuthTag(toUint8Array(tag));
  decipher.setAAD(toUint8Array(aad));

  const plaintext = Buffer.concat([
    Uint8Array.from(decipher.update(toUint8Array(ciphertext))),
    Uint8Array.from(decipher.final()),
  ]);
  return JSON.parse(plaintext.toString('utf8')) as CallInsights | WeeklySummaryData;
}

async function getOrCreateAccountDEK(
  client: SupabaseClient,
  accountId: string
): Promise<Buffer> {
  const { data: existing } = await client
    .from('ultaura_account_crypto_keys')
    .select('*')
    .eq('account_id', accountId)
    .single();

  if (existing) {
    const wrapped = decodeByteaOrThrow('account.dek_wrapped', existing.dek_wrapped);
    const iv = decodeByteaOrThrow('account.dek_wrap_iv', existing.dek_wrap_iv, 12);
    const tag = decodeByteaOrThrow('account.dek_wrap_tag', existing.dek_wrap_tag, 16);
    return unwrapDEK(
      wrapped,
      iv,
      tag,
      {
        algorithm: INSIGHTS_ALG,
        authTagLength: 16,
      }
    );
  }

  const dek = crypto.randomBytes(32);
  const { wrapped, iv, tag } = wrapDEKWithCurrentKey(dek, {
    algorithm: INSIGHTS_ALG,
    authTagLength: 16,
    ivLength: 12,
  });

  const { error } = await client
    .from('ultaura_account_crypto_keys')
    .insert({
      account_id: accountId,
      dek_wrapped: encodeBytea(wrapped),
      dek_wrap_iv: encodeBytea(iv),
      dek_wrap_tag: encodeBytea(tag),
      dek_kid: 'kek_v1',
      dek_alg: 'AES-256-GCM',
    });

  if (error) {
    logger.error({ error, accountId }, 'Failed to create account DEK');
    throw new Error('Failed to create account encryption key');
  }

  return dek;
}

function buildInsightsAAD(accountId: string, lineId: string, callSessionId: string): Buffer {
  return Buffer.from(
    JSON.stringify({
      account_id: accountId,
      line_id: lineId,
      call_session_id: callSessionId,
      type: 'call_insight',
    }),
    'utf8'
  );
}

function buildWeeklySummaryAAD(accountId: string, lineId: string, weekStartDate: string): Buffer {
  return Buffer.from(
    JSON.stringify({
      account_id: accountId,
      line_id: lineId,
      week_start: weekStartDate,
      type: 'weekly_summary',
    }),
    'utf8'
  );
}

function buildWeeklySummaryAADLegacy(
  accountId: string,
  lineId: string,
  summaryId: string,
  weekStartDate: string
): Buffer {
  const weekEndDate =
    DateTime.fromISO(weekStartDate, { zone: 'utc' }).plus({ days: 6 }).toISODate() ||
    weekStartDate;
  return Buffer.from(
    JSON.stringify({
      account_id: accountId,
      line_id: lineId,
      summary_id: summaryId,
      week_start_date: weekStartDate,
      week_end_date: weekEndDate,
      type: 'weekly_summary',
    }),
    'utf8'
  );
}

function isCallAnswered(session: {
  answered_by: string | null;
  seconds_connected: number | null;
}): boolean {
  const { answered_by, seconds_connected } = session;
  return (
    answered_by === 'human' ||
    answered_by === 'unknown' ||
    (answered_by === null && (seconds_connected ?? 0) > 0)
  );
}

function toSeverityLabel(severity: number): 'mild' | 'moderate' | 'significant' {
  if (severity >= 3) return 'significant';
  if (severity === 2) return 'moderate';
  return 'mild';
}

function summarizeMood(counts: { positive: number; neutral: number; low: number }, hasCalls: boolean) {
  const total = counts.positive + counts.neutral + counts.low;
  if (total === 0) {
    return hasCalls ? 'Not enough insight data this week.' : 'No call activity this week.';
  }

  const hasPositive = counts.positive > 0;
  const hasLow = counts.low > 0;

  if (hasPositive && hasLow) {
    return 'Mixed week';
  }

  if (counts.low / total >= 0.6) {
    return 'Low week';
  }

  if (counts.positive / total >= 0.6) {
    return 'Positive week';
  }

  return 'Neutral week';
}

function computeSegmentStats(
  rows: Array<{ segment_type: string; senior_response: string | null }>
): Map<SegmentType, { enjoyed: number; total: number }> {
  const stats = new Map<SegmentType, { enjoyed: number; total: number }>();
  for (const row of rows) {
    const type = row.segment_type as SegmentType;
    const entry = stats.get(type) ?? { enjoyed: 0, total: 0 };
    entry.total += 1;
    if (row.senior_response === 'enjoyed') {
      entry.enjoyed += 1;
    }
    stats.set(type, entry);
  }
  return stats;
}

function computePreferredSegmentType(
  rows: Array<{ segment_type: string; senior_response: string | null }>
): SegmentType | null {
  if (!rows.length) return null;

  const stats = computeSegmentStats(rows);
  let preferred: SegmentType | null = null;
  let bestRate = -1;
  let bestCount = 0;

  stats.forEach((entry, type) => {
    const rate = entry.total ? entry.enjoyed / entry.total : 0;
    if (rate > bestRate || (rate === bestRate && entry.total > bestCount)) {
      preferred = type;
      bestRate = rate;
      bestCount = entry.total;
    }
  });

  return preferred;
}

function computeFavoriteSegments(
  rows: Array<{ segment_type: string; senior_response: string | null }>,
  limit: number = 3
): string[] {
  if (!rows.length) return [];

  const stats = computeSegmentStats(rows);
  return Array.from(stats.entries())
    .map(([type, entry]) => ({
      type,
      enjoymentRate: entry.total ? entry.enjoyed / entry.total : 0,
      total: entry.total,
    }))
    .sort((a, b) => b.enjoymentRate - a.enjoymentRate || b.total - a.total)
    .slice(0, limit)
    .map((entry) => entry.type);
}

function computeInboundTrend(
  sessions: CallSessionRow[],
  windowStart: DateTime,
  windowMid: DateTime,
  windowEnd: DateTime,
  timezone: string
): 'increasing' | 'stable' | 'decreasing' {
  const firstInbound = sessions.filter(
    (session) =>
      session.direction === 'inbound' &&
      isWithinWindow(session.created_at, windowStart, windowMid, timezone)
  ).length;

  const secondInbound = sessions.filter(
    (session) =>
      session.direction === 'inbound' &&
      isWithinWindow(session.created_at, windowMid, windowEnd, timezone)
  ).length;

  if (secondInbound > firstInbound + 1) {
    return 'increasing';
  }

  if (secondInbound + 1 < firstInbound) {
    return 'decreasing';
  }

  return 'stable';
}

interface DecryptedInsightEntry {
  callSessionId: string;
  createdAt: string;
  insights: CallInsights;
}

function isWithinWindow(value: string, start: DateTime, end: DateTime, timezone: string): boolean {
  const date = DateTime.fromISO(value).setZone(timezone);
  return date >= start && date < end;
}

function filterInsightEntries(
  entries: DecryptedInsightEntry[],
  options: {
    start: DateTime;
    end: DateTime;
    timezone: string;
    minConfidence?: number | null;
  }
): DecryptedInsightEntry[] {
  const { start, end, timezone, minConfidence = null } = options;
  return entries.filter((entry) => {
    if (minConfidence !== null && entry.insights.confidence_overall < minConfidence) {
      return false;
    }
    return isWithinWindow(entry.createdAt, start, end, timezone);
  });
}

function getConcernSeverityMap(insights: CallInsights[]): Map<ConcernCode, number> {
  const map = new Map<ConcernCode, number>();
  for (const insight of insights) {
    for (const concern of insight.concerns || []) {
      const existing = map.get(concern.code) || 0;
      if (concern.severity > existing) {
        map.set(concern.code, concern.severity);
      }
    }
  }
  return map;
}

function hasSocialNeed(insights: CallInsights[]): boolean {
  return insights.some((insight) =>
    (insight.follow_up_reasons || []).includes('wants_more_contact')
  );
}

function sanitizeInsightTopics(
  insight: CallInsights,
  storedPrivateTopicCodes: string[],
  lineId: string
): Array<{ code: TopicCode; weight: number }> {
  const allPrivate = new Set<string>([
    ...storedPrivateTopicCodes,
    ...(insight.private_topics ?? []),
  ]);

  const foundPrivate = (insight.topics ?? []).filter((topic) => allPrivate.has(topic.code));
  if (foundPrivate.length > 0) {
    logger.warn(
      { lineId, privateTopicsFound: foundPrivate.map((topic) => topic.code) },
      'Private topic codes found in stored insight - filtering for payer'
    );
  }

  return (insight.topics ?? []).filter((topic) => !allPrivate.has(topic.code));
}

async function getAuthorizedLine(lineId: string): Promise<LineRow | null> {
  const client = getSupabaseServerActionClient();
  await requireSession(client);

  const { data, error } = await client
    .from('ultaura_lines')
    .select('*')
    .eq('id', lineId)
    .single();

  if (error) {
    if ((error as { code?: string })?.code === 'PGRST116') {
      return null;
    }

    logger.error({ error, lineId }, 'Failed to fetch line');
    return null;
  }

  return data;
}

async function getAdminClient(): Promise<SupabaseClient> {
  return getSupabaseServerActionClient({ admin: true }) as SupabaseClient;
}

async function decryptInsights(
  client: SupabaseClient,
  accountId: string,
  lineId: string,
  callSessionId: string,
  encrypted: EncryptedPayloadInput
): Promise<CallInsights> {
  const decoded = decodeEncryptedPayload('insights', encrypted);

  // Seed/test data fallback: all-zero IV + tag means plaintext JSON (not encrypted)
  if (decoded.iv.every((b) => b === 0) && decoded.tag.every((b) => b === 0)) {
    return JSON.parse(decoded.ciphertext.toString('utf8')) as CallInsights;
  }

  const dek = await getOrCreateAccountDEK(client, accountId);
  const aad = buildInsightsAAD(accountId, lineId, callSessionId);
  return decryptValue(
    dek,
    decoded.ciphertext,
    decoded.iv,
    decoded.tag,
    aad
  ) as CallInsights;
}

async function decryptWeeklySummary(
  client: SupabaseClient,
  accountId: string,
  lineId: string,
  summary: WeeklySummaryRow
): Promise<WeeklySummaryData> {
  const dek = await getOrCreateAccountDEK(client, accountId);
  const encrypted = decodeEncryptedPayload('weekly_summary', {
    ciphertext: summary.summary_ciphertext,
    iv: summary.summary_iv,
    tag: summary.summary_tag,
  });

  try {
    const aad = buildWeeklySummaryAAD(accountId, lineId, summary.week_start_date);
    return decryptValue(dek, encrypted.ciphertext, encrypted.iv, encrypted.tag, aad) as WeeklySummaryData;
  } catch {
    const legacyAad = buildWeeklySummaryAADLegacy(
      accountId,
      lineId,
      summary.id,
      summary.week_start_date
    );
    return decryptValue(
      dek,
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.tag,
      legacyAad
    ) as WeeklySummaryData;
  }
}

export async function getNotificationPreferences(
  accountId: string,
  lineId: string
): Promise<NotificationPreferencesRow | null> {
  const line = await getAuthorizedLine(lineId);
  if (!line || line.account_id !== accountId) {
    return null;
  }

  const client = await getAdminClient();
  const { data: existing, error } = await client
    .from('ultaura_notification_preferences')
    .select('*')
    .eq('account_id', accountId)
    .eq('line_id', lineId)
    .maybeSingle();

  if (error) {
    logger.error({ error, accountId, lineId }, 'Failed to fetch notification preferences');
  }

  if (existing) {
    return existing as NotificationPreferencesRow;
  }

  const { data: account } = await client
    .from('ultaura_accounts')
    .select('user_type')
    .eq('id', accountId)
    .maybeSingle();

  const defaultWeeklySummaryEnabled = account?.user_type === 'family_managed';

  const defaultPrefs = {
    account_id: accountId,
    line_id: lineId,
    weekly_summary_enabled: defaultWeeklySummaryEnabled,
    weekly_summary_format: 'email' as const,
    weekly_summary_day: 'sunday' as const,
    weekly_summary_time: '18:00',
    alert_missed_calls_enabled: true,
    alert_missed_calls_threshold: 3,
    health_mention_alerts: true,
    mood_drop_alerts: true,
    cognitive_concern_alerts: true,
    alert_delivery_method: 'email' as const,
  };

  const { data: created, error: insertError } = await client
    .from('ultaura_notification_preferences')
    .insert(defaultPrefs)
    .select('*')
    .single();

  if (insertError) {
    if ((insertError as { code?: string })?.code === '23505') {
      const { data: retry } = await client
        .from('ultaura_notification_preferences')
        .select('*')
        .eq('account_id', accountId)
        .eq('line_id', lineId)
        .maybeSingle();

      if (retry) {
        return retry as NotificationPreferencesRow;
      }
    }

    logger.error({ error: insertError, accountId, lineId }, 'Failed to create notification preferences');
    return defaultPrefs as NotificationPreferencesRow;
  }

  return created as NotificationPreferencesRow;
}

export async function getInsightPrivacy(
  lineId: string
): Promise<InsightPrivacySettings | null> {
  const line = await getAuthorizedLine(lineId);
  if (!line) {
    return null;
  }

  const client = await getAdminClient();
  const { data, error } = await client
    .from('ultaura_insight_privacy')
    .select('id, line_id, insights_enabled, is_paused, paused_at, paused_reason, created_at, updated_at')
    .eq('line_id', lineId)
    .maybeSingle();

  if (error) {
    logger.error({ error, lineId }, 'Failed to fetch insight privacy');
    return null;
  }

  return (data as InsightPrivacySettings | null) ?? null;
}

export async function getLineInsights(
  lineId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<
  Array<{
    id: string;
    callSessionId: string;
    createdAt: string;
    durationSeconds: number | null;
    extractionMethod: string;
    insights: CallInsights;
  }>
> {
  const line = await getAuthorizedLine(lineId);
  if (!line) {
    return [];
  }

  const client = await getAdminClient();
  const gate = await getSharingGate(client, lineId, line.account_id);

  if (!gate.isSelfUser || !gate.canAccessNonSafety) {
    return [];
  }

  let query = client
    .from('ultaura_call_insights')
    .select('*')
    .eq('line_id', lineId)
    .order('created_at', { ascending: false });

  if (options?.startDate) {
    query = query.gte('created_at', options.startDate.toISOString());
  }
  if (options?.endDate) {
    query = query.lte('created_at', options.endDate.toISOString());
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    logger.error({ error, lineId }, 'Failed to fetch call insights');
    return [];
  }

  const results = [] as Array<{
    id: string;
    callSessionId: string;
    createdAt: string;
    durationSeconds: number | null;
    extractionMethod: string;
    insights: CallInsights;
  }>;

  for (const row of data || []) {
    try {
      const insights = await decryptInsights(
        client,
        line.account_id,
        row.line_id,
        row.call_session_id,
        {
          ciphertext: row.insights_ciphertext,
          iv: row.insights_iv,
          tag: row.insights_tag,
        }
      );

      results.push({
        id: row.id,
        callSessionId: row.call_session_id,
        createdAt: row.created_at,
        durationSeconds: row.duration_seconds,
        extractionMethod: row.extraction_method,
        insights,
      });
    } catch (decryptError) {
      logger.warn({ decryptError, lineId }, 'Failed to decrypt call insights');
    }
  }

  return results;
}

export async function getLineBaseline(lineId: string): Promise<LineBaselineRow | null> {
  const line = await getAuthorizedLine(lineId);
  if (!line) {
    return null;
  }

  const client = await getAdminClient();
  const gate = await getSharingGate(client, lineId, line.account_id);
  if (!gate.canAccessNonSafety || (!gate.isSelfUser && gate.isFamilyOutputSuppressed) || !gate.allowMood) {
    return null;
  }

  const { data, error } = await client
    .from('ultaura_line_baselines')
    .select('*')
    .eq('line_id', lineId)
    .maybeSingle();

  if (error) {
    logger.error({ error, lineId }, 'Failed to fetch line baseline');
    return null;
  }

  return data as LineBaselineRow | null;
}

function applyWeeklySummaryTier(
  summary: WeeklySummaryData,
  tier: SharingTier
): WeeklySummaryData {
  const allowsMood = tier !== 'tier_1';
  const allowsTopics = tier === 'tier_3' || tier === 'tier_4';
  const allowsConcerns = tier === 'tier_4';

  return {
    ...summary,
    sharingTier: tier,
    engagementNote: allowsMood ? summary.engagementNote : null,
    moodSummary: allowsMood ? summary.moodSummary : null,
    moodShiftNote: allowsMood ? summary.moodShiftNote : null,
    moodDistribution: allowsMood ? summary.moodDistribution : null,
    topTopics: allowsTopics ? summary.topTopics : [],
    concerns: allowsConcerns ? summary.concerns : [],
    needsFollowUp: allowsConcerns ? summary.needsFollowUp : false,
    followUpReasons: allowsConcerns ? summary.followUpReasons : [],
    socialNeedNote: allowsConcerns ? summary.socialNeedNote : null,
  };
}

export async function getWeeklySummary(
  lineId: string,
  weekStartDate: Date
): Promise<WeeklySummaryData | null> {
  const line = await getAuthorizedLine(lineId);
  if (!line) {
    return null;
  }

  const client = await getAdminClient();
  const gate = await getSharingGate(client, lineId, line.account_id);

  if (!gate.canAccessNonSafety) {
    return null;
  }

  if (!gate.isSelfUser && gate.isFamilyOutputSuppressed) {
    return null;
  }

  const { data, error } = await client
    .from('ultaura_weekly_summaries')
    .select('*')
    .eq('line_id', lineId)
    .eq('week_start_date', weekStartDate.toISOString().slice(0, 10))
    .maybeSingle();

  if (error || !data) {
    if (error) {
      logger.error({ error, lineId }, 'Failed to fetch weekly summary');
    }
    return null;
  }

  try {
    const summary = await decryptWeeklySummary(
      client,
      line.account_id,
      lineId,
      data as WeeklySummaryRow
    );
    if (gate.isSelfUser) {
      return summary;
    }
    return applyWeeklySummaryTier(summary, gate.effectiveTier);
  } catch (decryptError) {
    logger.warn({ decryptError, lineId }, 'Failed to decrypt weekly summary');
    return null;
  }
}

export async function getInsightsDashboard(lineId: string): Promise<InsightsDashboard | null> {
  const line = await getAuthorizedLine(lineId);
  if (!line) {
    return null;
  }

  const client = await getAdminClient();
  const gate = await getSharingGate(client, lineId, line.account_id);

  // Only block if insights are disabled entirely
  if (!gate.insightsEnabled) {
    return null;
  }

  if (!gate.canAccessNonSafety) {
    return null;
  }

  if (!gate.isSelfUser && gate.isFamilyOutputSuppressed) {
    return null;
  }

  const { data: privacy } = await client
    .from('ultaura_insight_privacy')
    .select('insights_enabled, is_paused, paused_reason, paused_at')
    .eq('line_id', lineId)
    .maybeSingle();

  const now = DateTime.now().setZone(line.timezone);
  const todayStart = now.startOf('day');
  const weekEnd = todayStart;
  const weekStart = weekEnd.minus({ days: 7 });
  const priorWeekStart = weekStart.minus({ days: 7 });
  const priorTwoWeekStart = weekStart.minus({ days: 14 });
  const baselineStart = weekStart.minus({ days: 14 });
  const baselineEnd = weekStart;
  const socialBaselineStart = weekStart.minus({ days: 28 });
  const socialBaselineEnd = weekStart.minus({ days: 14 });
  const thirtyDayStart = todayStart.minus({ days: 29 });

  const sessionWindowStartUtc = thirtyDayStart.toUTC().toISO();
  const sessionWindowEndUtc = now.toUTC().toISO();
  const insightWindowStartUtc = socialBaselineStart.toUTC().toISO();
  const insightWindowEndUtc = now.toUTC().toISO();
  const weekStartUtc = weekStart.toUTC().toISO();
  const weekEndUtc = weekEnd.toUTC().toISO();
  const priorWeekStartUtc = priorWeekStart.toUTC().toISO();

  if (
    !sessionWindowStartUtc ||
    !sessionWindowEndUtc ||
    !insightWindowStartUtc ||
    !insightWindowEndUtc ||
    !weekStartUtc ||
    !weekEndUtc ||
    !priorWeekStartUtc
  ) {
    throw new Error('Failed to compute insights dashboard window');
  }

  const [
    sessions,
    insightsRows,
    baseline,
    previewRows,
    segmentRows,
    storyArcs,
    voiceConsent,
  ] = await Promise.all([
    client
      .from('ultaura_call_sessions')
      .select('*')
      .eq('line_id', lineId)
      .gte('created_at', sessionWindowStartUtc)
      .lt('created_at', sessionWindowEndUtc),
    client
      .from('ultaura_call_insights')
      .select('*')
      .eq('line_id', lineId)
      .gte('created_at', insightWindowStartUtc)
      .lt('created_at', insightWindowEndUtc),
    client
      .from('ultaura_line_baselines')
      .select('*')
      .eq('line_id', lineId)
      .maybeSingle(),
    client
      .from('ultaura_call_previews')
      .select('*')
      .eq('line_id', lineId)
      .gte('created_at', sessionWindowStartUtc),
    client
      .from('ultaura_segment_engagement')
      .select('*')
      .eq('line_id', lineId)
      .gte('created_at', sessionWindowStartUtc),
    client
      .from('ultaura_story_arcs')
      .select('*')
      .eq('line_id', lineId)
      .eq('status', 'active'),
    client
      .from('ultaura_line_voice_consent')
      .select('sharing_consent, sharing_tier')
      .eq('line_id', lineId)
      .maybeSingle(),
  ]);

  if (sessions.error) {
    logger.error({ error: sessions.error, lineId }, 'Failed to fetch call sessions for insights');
    return null;
  }

  if (insightsRows.error) {
    logger.error({ error: insightsRows.error, lineId }, 'Failed to fetch call insights for dashboard');
    return null;
  }

  if (previewRows.error) {
    logger.error({ error: previewRows.error, lineId }, 'Failed to fetch call previews for dashboard');
  }

  if (segmentRows.error) {
    logger.error({ error: segmentRows.error, lineId }, 'Failed to fetch segment engagement for dashboard');
  }

  if (storyArcs.error) {
    logger.error({ error: storyArcs.error, lineId }, 'Failed to fetch story arcs for dashboard');
  }

  if (voiceConsent.error) {
    logger.error({ error: voiceConsent.error, lineId }, 'Failed to fetch sharing consent for dashboard');
  }

  const userType: 'self' | 'family_managed' = gate.isSelfUser ? 'self' : 'family_managed';
  const sharingConsent = (voiceConsent.data?.sharing_consent ?? 'pending') as VoiceConsentStatus;
  const sharingTier = (voiceConsent.data?.sharing_tier ?? 'tier_1') as SharingTier;
  const isFamilyManaged = userType === 'family_managed';
  const effectiveTier = gate.effectiveTier;
  const allowMood = gate.allowMood;
  const allowTopics = gate.allowTopics;
  const allowConcerns = gate.allowConcerns;
  const allowRetention =
    gate.canAccessNonSafety &&
    (gate.isSelfUser || effectiveTier === 'tier_3' || effectiveTier === 'tier_4');

  const sessionList = (sessions.data || []) as CallSessionRow[];
  const insightsList = insightsRows.data || [];
  const previewList = previewRows.data || [];
  const segmentList = segmentRows.data || [];
  const activeStoryArcs = storyArcs.data || [];

  const decryptedInsights: DecryptedInsightEntry[] = [];

  for (const row of insightsList) {
    try {
      const insights = await decryptInsights(
        client,
        line.account_id,
        row.line_id,
        row.call_session_id,
        {
          ciphertext: row.insights_ciphertext,
          iv: row.insights_iv,
          tag: row.insights_tag,
        }
      );
      decryptedInsights.push({
        callSessionId: row.call_session_id,
        createdAt: row.created_at,
        insights,
      });
    } catch (decryptError) {
      logger.warn({ decryptError, lineId }, 'Failed to decrypt dashboard insights');
    }
  }

  const insightsBySession = new Map(
    decryptedInsights.map((entry) => [entry.callSessionId, entry.insights])
  );

  const thirtyDaySessions = sessionList.filter((session) => !session.is_test_call);

  const dayBuckets = new Map<string, { scheduled: number; reminder: number; inbound: number }>();
  for (let i = 0; i < 30; i += 1) {
    const date = thirtyDayStart.plus({ days: i });
    const key = date.toISODate() || '';
    if (key) {
      dayBuckets.set(key, { scheduled: 0, reminder: 0, inbound: 0 });
    }
  }

  for (const session of thirtyDaySessions) {
    const localDate = DateTime.fromISO(session.created_at).setZone(line.timezone).toISODate();
    if (!localDate || !dayBuckets.has(localDate)) {
      continue;
    }

    const bucket = dayBuckets.get(localDate)!;
    if (session.direction === 'inbound') {
      bucket.inbound += 1;
    } else if (session.is_reminder_call) {
      bucket.reminder += 1;
    } else {
      bucket.scheduled += 1;
    }
  }

  const callActivity = Array.from(dayBuckets.entries()).map(([date, counts]) => ({
    date,
    ...counts,
  }));

  const moodTrend = filterInsightEntries(decryptedInsights, {
    start: thirtyDayStart,
    end: now,
    timezone: line.timezone,
    minConfidence: 0.5,
  }).map((entry) => ({
    callSessionId: entry.callSessionId,
    occurredAt: entry.createdAt,
    mood: entry.insights.mood_overall,
  }));

  const weekSessions = thirtyDaySessions.filter((session) =>
    DateTime.fromISO(session.created_at) >= DateTime.fromISO(weekStartUtc) &&
    DateTime.fromISO(session.created_at) < DateTime.fromISO(weekEndUtc)
  );
  const priorWeekSessions = thirtyDaySessions.filter((session) =>
    DateTime.fromISO(session.created_at) >= DateTime.fromISO(priorWeekStartUtc) &&
    DateTime.fromISO(session.created_at) < DateTime.fromISO(weekStartUtc)
  );

  const scheduledWeek = weekSessions.filter((session) =>
    session.scheduler_idempotency_key?.startsWith('schedule:')
  );
  const answeredScheduledWeek = scheduledWeek.filter((session) =>
    isCallAnswered({ answered_by: session.answered_by, seconds_connected: session.seconds_connected })
  );

  const scheduledCalls = scheduledWeek.length;
  const answeredCalls = answeredScheduledWeek.length;
  const missedCalls = Math.max(0, scheduledCalls - answeredCalls);
  const inboundCallsWeek = weekSessions.filter((session) => session.direction === 'inbound').length;

  const answeredAllWeek = weekSessions.filter((session) =>
    isCallAnswered({ answered_by: session.answered_by, seconds_connected: session.seconds_connected })
  );
  const avgDurationMinutes = answeredAllWeek.length
    ? Math.round(
        answeredAllWeek.reduce((sum, session) => sum + (session.seconds_connected ?? 0), 0) /
          answeredAllWeek.length /
          60
      )
    : null;

  const priorScheduled = priorWeekSessions.filter((session) =>
    session.scheduler_idempotency_key?.startsWith('schedule:')
  );
  const priorAnsweredScheduled = priorScheduled.filter((session) =>
    isCallAnswered({ answered_by: session.answered_by, seconds_connected: session.seconds_connected })
  );

  const answeredDelta = priorScheduled.length > 0 ? answeredCalls - priorAnsweredScheduled.length : null;

  const priorAnsweredAll = priorWeekSessions.filter((session) =>
    isCallAnswered({ answered_by: session.answered_by, seconds_connected: session.seconds_connected })
  );
  const priorAvgDurationMinutes = priorAnsweredAll.length
    ? Math.round(
        priorAnsweredAll.reduce((sum, session) => sum + (session.seconds_connected ?? 0), 0) /
          priorAnsweredAll.length /
          60
      )
    : null;

  const durationDeltaMinutes =
    priorAvgDurationMinutes === null || avgDurationMinutes === null
      ? null
      : avgDurationMinutes - priorAvgDurationMinutes;

  const weekInsightEntries = filterInsightEntries(decryptedInsights, {
    start: weekStart,
    end: weekEnd,
    timezone: line.timezone,
    minConfidence: 0.5,
  });
  const weekInsights = weekInsightEntries.map((entry) => entry.insights);
  const baselineInsights = filterInsightEntries(decryptedInsights, {
    start: baselineStart,
    end: baselineEnd,
    timezone: line.timezone,
    minConfidence: 0.5,
  }).map((entry) => entry.insights);
  const priorWeekInsights = filterInsightEntries(decryptedInsights, {
    start: priorWeekStart,
    end: weekStart,
    timezone: line.timezone,
    minConfidence: 0.5,
  }).map((entry) => entry.insights);
  const priorTwoWeekInsights = filterInsightEntries(decryptedInsights, {
    start: priorTwoWeekStart,
    end: priorWeekStart,
    timezone: line.timezone,
    minConfidence: 0.5,
  }).map((entry) => entry.insights);
  const socialBaselineInsights = filterInsightEntries(decryptedInsights, {
    start: socialBaselineStart,
    end: socialBaselineEnd,
    timezone: line.timezone,
    minConfidence: 0.5,
  }).map((entry) => entry.insights);

  const engagementScores = weekInsights.map((entry) => entry.engagement_score);
  const avgEngagementScore = engagementScores.length
    ? engagementScores.reduce((sum, value) => sum + value, 0) / engagementScores.length
    : null;

  let engagementNote: string | null = null;
  if (
    baseline.data?.avg_engagement !== null &&
    baseline.data?.avg_engagement !== undefined &&
    avgEngagementScore !== null &&
    engagementScores.length >= 2 &&
    avgEngagementScore - baseline.data.avg_engagement <= -2.5
  ) {
    engagementNote = `down ${Math.abs(avgEngagementScore - baseline.data.avg_engagement).toFixed(1)} points from typical`;
  }

  const moodCounts = weekInsights.reduce(
    (acc, insight) => {
      acc[insight.mood_overall] += 1;
      return acc;
    },
    { positive: 0, neutral: 0, low: 0 }
  );

  const moodSummary = summarizeMood(moodCounts, weekSessions.length > 0);
  const weekLowCount = moodCounts.low;
  const baselineLowCount = baselineInsights.filter((insight) => insight.mood_overall === 'low').length;
  const moodShiftNote =
    weekLowCount >= 3 && baselineLowCount <= 1
      ? 'Low mood calls were higher than typical this week.'
      : null;

  const storedPrivateTopicCodes = await getPrivateTopicCodes(client, lineId);
  const topicWeights = new Map<TopicCode, number>();

  for (const insight of weekInsights) {
    const filteredTopics = sanitizeInsightTopics(insight, storedPrivateTopicCodes, lineId);
    for (const topic of filteredTopics) {
      topicWeights.set(topic.code, (topicWeights.get(topic.code) || 0) + topic.weight);
    }
  }

  const topics = Array.from(topicWeights.entries())
    .map(([code, weight]) => ({
      code,
      label: INSIGHTS.TOPIC_LABELS[code],
      weight: Number(weight.toFixed(3)),
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);

  const concernMap = new Map<ConcernCode, { severity: number; isNovel: boolean }>();
  for (const insight of weekInsights) {
    for (const concern of insight.concerns || []) {
      const existing = concernMap.get(concern.code);
      const isNovel = concern.is_novel || existing?.isNovel || false;
      const severity = Math.max(existing?.severity || 0, concern.severity);
      concernMap.set(concern.code, { severity, isNovel });
    }
  }

  const currentConcernCodes = new Set(concernMap.keys());
  const baselineConcernMap = getConcernSeverityMap(baselineInsights);

  const currentConcerns = Array.from(concernMap.entries()).map(([code, data]) => {
    const novelty: 'new' | 'recurring' = data.isNovel ? 'new' : 'recurring';
    return {
      code,
      label: INSIGHTS.CONCERN_LABELS[code],
      severity: toSeverityLabel(data.severity),
      novelty,
    };
  });

  const resolvedConcerns = Array.from(baselineConcernMap.entries())
    .filter(([code]) => !currentConcernCodes.has(code))
    .map(([code, severity]) => ({
      code,
      label: INSIGHTS.CONCERN_LABELS[code],
      severity: toSeverityLabel(severity),
      novelty: 'resolved' as const,
    }));

  const concerns = [...currentConcerns, ...resolvedConcerns];

  const followUpSet = new Set<FollowUpReasonCode>();
  for (const insight of weekInsights) {
    if (!insight.needs_follow_up) {
      continue;
    }
    for (const reason of insight.follow_up_reasons || []) {
      followUpSet.add(reason);
    }
  }

  const followUpReasons = Array.from(followUpSet).map((reason) => INSIGHTS.FOLLOW_UP_REASON_LABELS[reason]);
  const needsFollowUp = followUpReasons.length > 0;

  const socialNeedNote =
    hasSocialNeed(weekInsights) &&
    hasSocialNeed(priorWeekInsights) &&
    hasSocialNeed(priorTwoWeekInsights) &&
    !hasSocialNeed(socialBaselineInsights)
      ? 'Social connection: may benefit from extra contact.'
      : null;

  const currentAnswerRate = scheduledCalls > 0 ? answeredCalls / scheduledCalls : 0;
  const baselineAnswerRate = baseline.data?.answer_rate ?? null;
  const answerRateDrop =
    baselineAnswerRate !== null ? Math.max(0, baselineAnswerRate - currentAnswerRate) : 0;
  const showMissedCallsWarning =
    baselineAnswerRate !== null && answerRateDrop >= 0.2 && missedCalls >= 2;

  const callHistory = [...thirtyDaySessions]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((session) => {
      const insight = insightsBySession.get(session.id);
      const moodOverall =
        insight && insight.confidence_overall >= 0.5 ? insight.mood_overall : null;
      return {
        ...session,
        mood_overall: moodOverall,
      };
    });

  const previewOutcomes = previewList.filter((row) => row.follow_through_response !== null);
  const previewEngaged = previewOutcomes.filter((row) => row.followed_through === true).length;
  const callPreviewFollowThrough = previewOutcomes.length
    ? Math.round((previewEngaged / previewOutcomes.length) * 100)
    : 0;

  const segmentCompleted = segmentList.filter((row) => row.completed === true).length;
  const segmentCompletionRate = segmentList.length
    ? Math.round((segmentCompleted / segmentList.length) * 100)
    : 0;

  const segmentDurations = segmentList
    .map((row) => row.duration_seconds)
    .filter((value): value is number => typeof value === 'number');
  const averageSegmentDuration = segmentDurations.length
    ? Math.round(segmentDurations.reduce((sum, value) => sum + value, 0) / segmentDurations.length)
    : 0;

  const preferredSegmentType = computePreferredSegmentType(segmentList);
  const favoriteSegments = computeFavoriteSegments(segmentList);

  const inboundCallCount = thirtyDaySessions.filter((session) => session.direction === 'inbound').length;

  const trendWindowStart = todayStart.minus({ days: 28 });
  const trendWindowMid = todayStart.minus({ days: 14 });
  const inboundCallTrend = computeInboundTrend(
    thirtyDaySessions,
    trendWindowStart,
    trendWindowMid,
    todayStart,
    line.timezone
  );

  const activeStoryArcSummaries = activeStoryArcs.map((arc) => ({
    id: arc.id,
    title: arc.title,
    progress: arc.total_chapters
      ? Math.round((arc.current_chapter / arc.total_chapters) * 100)
      : 0,
  }));

  const retention = allowRetention
    ? {
        retentionFeatures: {
          callPreviewEnabled: previewList.length > 0,
          segmentsEnabled: segmentList.length > 0,
          favoriteSegments,
          activeStoryArcs: activeStoryArcSummaries,
        },
        engagementMetrics: {
          callPreviewFollowThrough,
          segmentCompletionRate,
          preferredSegmentType,
          averageSegmentDuration,
        },
        inboundMetrics: {
          inboundCallCount,
          inboundCallTrend,
        },
      }
    : undefined;

  const filteredCallHistory = allowMood
    ? callHistory
    : callHistory.map((session) => ({ ...session, mood_overall: null }));

  return {
    lineId: line.id,
    lineShortId: line.short_id,
    lineName: line.display_name,
    timezone: line.timezone,
    status: line.status,
    userType,
    sharingConsent,
    sharingTier,
    insightsEnabled: privacy?.insights_enabled ?? true,
    isPaused: privacy?.is_paused ?? false,
    pausedReason: privacy?.paused_reason ?? null,
    retention,
    summary: {
      scheduledCalls,
      answeredCalls,
      answeredDelta,
      avgDurationMinutes,
      durationDeltaMinutes,
      moodSummary: allowMood ? moodSummary : null,
      moodShiftNote: allowMood ? moodShiftNote : null,
      engagementNote: allowMood ? engagementNote : null,
      showMissedCallsWarning,
      missedCalls,
      inboundCalls: inboundCallsWeek,
      needsFollowUp: allowConcerns ? needsFollowUp : false,
      followUpReasons: allowConcerns ? followUpReasons : [],
      socialNeedNote: allowConcerns ? socialNeedNote : null,
    },
    moodTrend: allowMood ? moodTrend : [],
    topics: allowTopics ? topics : [],
    concerns: allowConcerns ? concerns : [],
    callActivity,
    callHistory: filteredCallHistory,
  };
}

const MOOD_SNAPSHOT_VALUES: MoodSnapshotMood[] = [
  'positive',
  'neutral',
  'low',
  'anxious',
  'sad',
  'frustrated',
];
const ENERGY_LEVEL_VALUES: MoodEnergyLevel[] = ['high', 'normal', 'low', 'very_low'];
const TRAJECTORY_VALUES: MoodTrajectory[] = ['improved', 'declined', 'stable'];

function initializeCountMap<T extends string>(values: T[]): Record<T, number> {
  return values.reduce((acc, value) => {
    acc[value] = 0;
    return acc;
  }, {} as Record<T, number>);
}

function pickMoodSnapshot(
  entry: MoodSnapshotRow
): MoodSnapshotMood | null {
  return (entry.mood_end || entry.mood_start || entry.mood_mid || null) as MoodSnapshotMood | null;
}

export async function getEmotionalTrends(
  lineId: string,
  days: number = 14
): Promise<EmotionalTrendsData> {
  const emptyResult: EmotionalTrendsData = {
    entries: [],
    distribution: initializeCountMap(MOOD_SNAPSHOT_VALUES),
    energyLevels: initializeCountMap(ENERGY_LEVEL_VALUES),
    trajectories: initializeCountMap(TRAJECTORY_VALUES),
  };
  const line = await getAuthorizedLine(lineId);
  if (!line) {
    return emptyResult;
  }

  const client = await getAdminClient();
  const gate = await getSharingGate(client, lineId, line.account_id);
  if (!gate.canAccessNonSafety || (!gate.isSelfUser && gate.isFamilyOutputSuppressed) || !gate.allowMood) {
    return emptyResult;
  }
  const now = DateTime.now().setZone(line.timezone);
  const start = now.minus({ days });
  const startUtc = start.toUTC().toISO();

  if (!startUtc) {
    return emptyResult;
  }

  const { data: rows, error } = await client
    .from('ultaura_mood_snapshots')
    .select('call_session_id, created_at, mood_start, mood_mid, mood_end, energy_level, mood_trajectory')
    .eq('line_id', lineId)
    .gte('created_at', startUtc)
    .order('created_at', { ascending: true });

  if (error) {
    logger.error({ error, lineId }, 'Failed to fetch mood snapshots');
  }

  const entries: EmotionalTrendEntry[] = [];
  const distribution = initializeCountMap(MOOD_SNAPSHOT_VALUES);
  const energyLevels = initializeCountMap(ENERGY_LEVEL_VALUES);
  const trajectories = initializeCountMap(TRAJECTORY_VALUES);

  for (const row of rows ?? []) {
    const moodValue = pickMoodSnapshot(row as MoodSnapshotRow);
    if (moodValue && distribution[moodValue] !== undefined) {
      distribution[moodValue] += 1;
    }

    if (row.energy_level && energyLevels[row.energy_level as MoodEnergyLevel] !== undefined) {
      energyLevels[row.energy_level as MoodEnergyLevel] += 1;
    }

    if (row.mood_trajectory && trajectories[row.mood_trajectory as MoodTrajectory] !== undefined) {
      trajectories[row.mood_trajectory as MoodTrajectory] += 1;
    }

    entries.push({
      callSessionId: row.call_session_id,
      occurredAt: row.created_at,
      moodStart: row.mood_start as MoodSnapshotMood | null,
      moodMid: row.mood_mid as MoodSnapshotMood | null,
      moodEnd: row.mood_end as MoodSnapshotMood | null,
      energyLevel: row.energy_level as MoodEnergyLevel | null,
      trajectory: row.mood_trajectory as MoodTrajectory | null,
    });
  }

  return { entries, distribution, energyLevels, trajectories };
}

export async function getMoodCalendar(
  lineId: string,
  month: string
): Promise<MoodCalendarData> {
  const emptyResult: MoodCalendarData = { month, days: [] };
  const line = await getAuthorizedLine(lineId);
  if (!line) {
    return emptyResult;
  }

  const client = await getAdminClient();
  const gate = await getSharingGate(client, lineId, line.account_id);
  if (!gate.canAccessNonSafety || (!gate.isSelfUser && gate.isFamilyOutputSuppressed) || !gate.allowMood) {
    return emptyResult;
  }
  const parsedMonth = DateTime.fromFormat(month, 'yyyy-MM', { zone: line.timezone });
  const monthStart = parsedMonth.isValid
    ? parsedMonth.startOf('month')
    : DateTime.now().setZone(line.timezone).startOf('month');
  const monthEnd = monthStart.endOf('month');
  const startUtc = monthStart.toUTC().toISO();
  const endUtc = monthEnd.toUTC().toISO();

  if (!startUtc || !endUtc) {
    return { month: monthStart.toFormat('yyyy-MM'), days: [] };
  }

  const { data: rows, error } = await client
    .from('ultaura_mood_snapshots')
    .select('created_at, mood_start, mood_mid, mood_end')
    .eq('line_id', lineId)
    .gte('created_at', startUtc)
    .lte('created_at', endUtc)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ error, lineId }, 'Failed to fetch mood calendar data');
  }

  const moodByDate = new Map<string, MoodSnapshotMood>();
  for (const row of rows ?? []) {
    const localDate = DateTime.fromISO(row.created_at).setZone(line.timezone).toISODate();
    if (!localDate || moodByDate.has(localDate)) {
      continue;
    }

    const moodValue = pickMoodSnapshot(row as MoodSnapshotRow);
    if (moodValue) {
      moodByDate.set(localDate, moodValue);
    }
  }

  const days: MoodCalendarDay[] = [];
  const totalDays = monthStart.daysInMonth ?? 30;
  for (let day = 1; day <= totalDays; day += 1) {
    const date = monthStart.set({ day }).toISODate();
    if (!date) continue;
    days.push({
      date,
      mood: moodByDate.get(date) ?? null,
    });
  }

  return { month: monthStart.toFormat('yyyy-MM'), days };
}

export async function getSafetyEvents(
  lineId: string,
  options?: { limit?: number; includeAllTiers?: boolean }
): Promise<Array<{ id: string; occurredAt: string; severity: 'low' | 'medium' | 'high'; actionTaken: string | null; eventType: string | null }>> {
  const line = await getAuthorizedLine(lineId);
  if (!line) {
    return [];
  }

  const client = await getAdminClient();
  const limit = options?.limit ?? 10;
  let query = client
    .from('ultaura_safety_events')
    .select('id, tier, action_taken, created_at, signals')
    .eq('line_id', lineId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!options?.includeAllTiers) {
    query = query.eq('tier', 'high').eq('signals->>verifier_result', 'confirm');
  } else {
    query = query.or('tier.neq.high,signals->>verifier_result.eq.confirm');
  }

  const { data, error } = await query;
  if (error) {
    logger.error({ error, lineId }, 'Failed to fetch safety events');
    return [];
  }

  return (data ?? []).map((row) => {
    const signals = row.signals as Record<string, unknown> | null;
    const eventType = typeof signals?.type === 'string' ? signals.type : null;
    return {
      id: row.id,
      occurredAt: row.created_at,
      severity: row.tier as 'low' | 'medium' | 'high',
      actionTaken: row.action_taken ?? null,
      eventType,
    };
  });
}

export async function getConversationHighlights(
  lineId: string,
  limit: number = 10
): Promise<ConversationHighlightsData> {
  const emptyResult: ConversationHighlightsData = { highlights: [] };
  const line = await getAuthorizedLine(lineId);
  if (!line) {
    return emptyResult;
  }

  const client = await getAdminClient();
  const gate = await getSharingGate(client, lineId, line.account_id);
  if (!gate.canAccessNonSafety || (!gate.isSelfUser && gate.isFamilyOutputSuppressed) || !gate.allowTopics) {
    return emptyResult;
  }
  const { data: sessions, error: sessionError } = await client
    .from('ultaura_call_sessions')
    .select('id, created_at, answered_by, seconds_connected, is_test_call, is_reminder_call')
    .eq('line_id', lineId)
    .order('created_at', { ascending: false })
    .limit(limit * 2);

  if (sessionError) {
    logger.error({ error: sessionError, lineId }, 'Failed to fetch call sessions for highlights');
    return emptyResult;
  }

  const answeredSessions = (sessions ?? [])
    .filter((session) =>
      !session.is_test_call &&
      !session.is_reminder_call &&
      isCallAnswered(session)
    )
    .slice(0, limit);

  const callSessionIds = answeredSessions.map((session) => session.id);
  if (callSessionIds.length === 0) {
    return emptyResult;
  }

  const includeArtifacts = gate.isSelfUser;
  const [insightRows, memoryRows, eventRows] = await Promise.all([
    client
      .from('ultaura_call_insights')
      .select('call_session_id, created_at, insights_ciphertext, insights_iv, insights_tag')
      .in('call_session_id', callSessionIds),
    includeArtifacts
      ? client
          .from('ultaura_memories')
          .select('id, key, privacy_scope, created_in_call_session_id')
          .in('created_in_call_session_id', callSessionIds)
      : Promise.resolve({ data: [] }),
    includeArtifacts
      ? client
          .from('ultaura_call_events')
          .select('call_session_id, payload')
          .eq('type', 'tool_call')
          .in('call_session_id', callSessionIds)
      : Promise.resolve({ data: [] }),
  ]);

  const insightsByCall = new Map<string, CallInsights>();
  for (const row of insightRows.data ?? []) {
    try {
      const insights = await decryptInsights(
        client,
        line.account_id,
        lineId,
        row.call_session_id,
        {
          ciphertext: row.insights_ciphertext,
          iv: row.insights_iv,
          tag: row.insights_tag,
        }
      );
      insightsByCall.set(row.call_session_id, insights);
    } catch (decryptError) {
      logger.warn({ decryptError, lineId }, 'Failed to decrypt insights for highlights');
    }
  }

  const memoryKeysByCall = new Map<string, string[]>();
  for (const row of memoryRows.data ?? []) {
    if (row.privacy_scope === 'line_only') {
      continue;
    }
    const callSessionId = row.created_in_call_session_id;
    if (!callSessionId) continue;
    const entries = memoryKeysByCall.get(callSessionId) ?? [];
    entries.push(row.key);
    memoryKeysByCall.set(callSessionId, entries);
  }

  const milestoneIdsByCall = new Map<string, Set<string>>();
  for (const row of eventRows.data ?? []) {
    const payload = row.payload as Record<string, unknown> | null;
    const tool = typeof payload?.tool === 'string' ? payload.tool : null;
    if (!tool || (tool !== 'store_milestone' && tool !== 'mark_milestone_celebrated')) {
      continue;
    }
    const milestoneId = typeof payload?.milestoneId === 'string' ? payload.milestoneId : null;
    if (!milestoneId) {
      continue;
    }
    const set = milestoneIdsByCall.get(row.call_session_id) ?? new Set<string>();
    set.add(milestoneId);
    milestoneIdsByCall.set(row.call_session_id, set);
  }

  const milestoneIds = Array.from(new Set(
    Array.from(milestoneIdsByCall.values()).flatMap((set) => Array.from(set))
  ));

  const milestoneTitleMap = new Map<string, string>();
  if (milestoneIds.length > 0) {
    const { data: milestones, error: milestoneError } = await client
      .from('ultaura_milestones')
      .select('id, title')
      .in('id', milestoneIds);

    if (milestoneError) {
      logger.error({ error: milestoneError, lineId }, 'Failed to fetch milestone titles');
    }

    for (const milestone of milestones ?? []) {
      milestoneTitleMap.set(milestone.id, milestone.title);
    }
  }

  const storedPrivateTopicCodes = await getPrivateTopicCodes(client, lineId);
  const highlights = answeredSessions.map((session) => {
    const insight = insightsByCall.get(session.id);
    const filteredTopics = insight
      ? sanitizeInsightTopics(insight, storedPrivateTopicCodes, lineId)
      : [];
    const topics = filteredTopics
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map((topic) => INSIGHTS.TOPIC_LABELS[topic.code as TopicCode] ?? topic.code);

    const milestoneSet = includeArtifacts ? milestoneIdsByCall.get(session.id) : null;
    const milestones = milestoneSet
      ? Array.from(milestoneSet)
          .map((id) => milestoneTitleMap.get(id))
          .filter((title): title is string => Boolean(title))
      : [];

    return {
      callSessionId: session.id,
      occurredAt: session.created_at,
      mood: insight?.mood_overall ?? null,
      topics,
      newMemoryKeys: includeArtifacts ? (memoryKeysByCall.get(session.id) ?? []) : [],
      milestones,
    };
  });

  return { highlights };
}

export async function getMemoryActivity(
  lineId: string,
  limit: number = 20
): Promise<MemoryActivityData> {
  const emptyResult: MemoryActivityData = { items: [] };
  const line = await getAuthorizedLine(lineId);
  if (!line) {
    return emptyResult;
  }

  const client = await getAdminClient();
  const gate = await getSharingGate(client, lineId, line.account_id);
  if (!gate.canAccessNonSafety || (!gate.isSelfUser && gate.isFamilyOutputSuppressed) || !gate.allowConcerns) {
    return emptyResult;
  }

  let query = client
    .from('ultaura_memories')
    .select('id, type, key, created_at, privacy_scope')
    .eq('line_id', lineId)
    .eq('active', true);

  if (!gate.isSelfUser) {
    query = query.neq('privacy_scope', 'line_only');
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error, lineId }, 'Failed to fetch memory activity');
    return emptyResult;
  }

  const items: MemoryActivityItem[] = (data ?? []).map((row) => ({
    memoryId: row.id,
    type: row.type as MemoryType,
    key: row.key,
    createdAt: row.created_at,
    isPrivate: row.privacy_scope === 'line_only',
  }));

  return { items };
}

export async function getRelationshipIndicators(
  lineId: string
): Promise<RelationshipIndicatorsData> {
  const emptyResult: RelationshipIndicatorsData = { indicators: [] };
  const line = await getAuthorizedLine(lineId);
  if (!line) {
    return emptyResult;
  }

  const client = await getAdminClient();
  const gate = await getSharingGate(client, lineId, line.account_id);
  if (!gate.canAccessNonSafety || (!gate.isSelfUser && gate.isFamilyOutputSuppressed) || !gate.allowConcerns) {
    return emptyResult;
  }
  const { data, error } = await client
    .from('ultaura_relationships')
    .select('name, relation_type, relation_role, sentiment, times_mentioned, last_mentioned_at')
    .eq('line_id', lineId)
    .order('times_mentioned', { ascending: false })
    .limit(20);

  if (error) {
    logger.error({ error, lineId }, 'Failed to fetch relationship indicators');
    return emptyResult;
  }

  const now = DateTime.now();
  const thirtyDaysAgo = now.minus({ days: 30 });

  const indicators: RelationshipIndicator[] = (data ?? []).map((row) => {
    const lastMentionedAt = row.last_mentioned_at;
    const recentlyMentioned = lastMentionedAt
      ? DateTime.fromISO(lastMentionedAt) >= thirtyDaysAgo
      : false;

    return {
      name: row.name,
      relationType: row.relation_type || 'unknown',
      relationRole: row.relation_role || 'relationship',
      sentiment: (row.sentiment || 'neutral') as RelationshipIndicator['sentiment'],
      mentionCount30d: recentlyMentioned ? (row.times_mentioned ?? 1) : 0,
      lastMentionedAt: lastMentionedAt ?? null,
    };
  });

  return { indicators };
}

export async function updateNotificationPreferences(
  accountId: string,
  lineId: string,
  preferences: Partial<NotificationPreferencesRow>
): Promise<void> {
  const line = await getAuthorizedLine(lineId);
  if (!line || line.account_id !== accountId) {
    throw new Error('Line not found or access denied');
  }

  const updates = Object.fromEntries(
    Object.entries(preferences).filter(([, value]) => value !== undefined)
  );

  if (Object.keys(updates).length === 0) {
    return;
  }

  const client = await getAdminClient();
  const existing = await getNotificationPreferences(accountId, lineId);
  const base = existing ?? {};

  const { error } = await client
    .from('ultaura_notification_preferences')
    .upsert({
      account_id: accountId,
      line_id: lineId,
      ...base,
      ...updates,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'account_id,line_id' });

  if (error) {
    logger.error({ error, accountId, lineId }, 'Failed to update notification preferences');
    throw new Error('Failed to update notification preferences');
  }
}

async function fetchInsightPrivacyBase(
  client: SupabaseClient,
  lineId: string
): Promise<{
  insights_enabled: boolean;
  is_paused: boolean;
  paused_reason: string | null;
  paused_at: string | null;
  private_topic_codes: unknown[];
}> {
  const { data: existing, error } = await client
    .from('ultaura_insight_privacy')
    .select('insights_enabled, is_paused, paused_reason, paused_at, private_topic_codes')
    .eq('line_id', lineId)
    .maybeSingle();

  if (error) {
    logger.error({ error, lineId }, 'Failed to fetch insight privacy');
    throw new Error('Failed to fetch insight privacy');
  }

  return {
    insights_enabled: existing?.insights_enabled ?? true,
    is_paused: existing?.is_paused ?? false,
    paused_reason: existing?.paused_reason ?? null,
    paused_at: existing?.paused_at ?? null,
    private_topic_codes: existing?.private_topic_codes ?? [],
  };
}

async function upsertInsightPrivacy(
  client: SupabaseClient,
  lineId: string,
  data: Record<string, unknown>
): Promise<void> {
  const { error } = await client
    .from('ultaura_insight_privacy')
    .upsert(
      { line_id: lineId, ...data, updated_at: new Date().toISOString() },
      { onConflict: 'line_id' }
    );

  if (error) {
    logger.error({ error, lineId }, 'Failed to update insight privacy');
    throw new Error('Failed to update insight privacy');
  }
}

export async function updateInsightPrivacy(
  lineId: string,
  settings: Partial<InsightPrivacyRow>
): Promise<void> {
  const line = await getAuthorizedLine(lineId);
  if (!line) {
    throw new Error('Line not found');
  }

  const client = await getAdminClient();
  const { data: account } = await client
    .from('ultaura_accounts')
    .select('user_type')
    .eq('id', line.account_id)
    .single();

  const isSelfUser = account?.user_type === 'self';
  const allowedSettings: Partial<InsightPrivacyRow> = {};

  if (settings.private_topic_codes !== undefined) {
    throw new Error(
      'Cannot update senior-controlled field: private_topic_codes. This setting can only be changed via voice.'
    );
  }

  if (settings.insights_enabled !== undefined) {
    if (!isSelfUser) {
      throw new Error(
        'Cannot update senior-controlled field: insights_enabled. This setting can only be changed via voice.'
      );
    }
    allowedSettings.insights_enabled = settings.insights_enabled;
  }

  if (settings.is_paused !== undefined) {
    allowedSettings.is_paused = settings.is_paused;
  }
  if (settings.paused_at !== undefined) {
    allowedSettings.paused_at = settings.paused_at;
  }
  if (settings.paused_reason !== undefined) {
    allowedSettings.paused_reason = settings.paused_reason;
  }

  if (Object.keys(allowedSettings).length === 0) {
    return;
  }

  const base = await fetchInsightPrivacyBase(client, lineId);
  await upsertInsightPrivacy(client, lineId, { ...base, ...allowedSettings });
}

export async function setPauseMode(
  lineId: string,
  enabled: boolean,
  reason?: string
): Promise<void> {
  const line = await getAuthorizedLine(lineId);
  if (!line) {
    throw new Error('Line not found');
  }

  const userClient = getSupabaseServerActionClient();
  const session = await requireSession(userClient);
  const actorUserId = session?.user?.id ?? null;

  const client = await getAdminClient();
  const base = await fetchInsightPrivacyBase(client, lineId);
  const oldPaused = base.is_paused;
  const pauseUpdate = enabled
    ? { is_paused: true, paused_at: new Date().toISOString(), paused_reason: reason || null }
    : { is_paused: false, paused_at: null, paused_reason: null };

  await upsertInsightPrivacy(client, lineId, { ...base, ...pauseUpdate });

  await logConsentAudit({
    accountId: line.account_id,
    lineId,
    actorUserId,
    actorType: 'payer',
    action: 'pause_mode_changed',
    oldValue: { is_paused: oldPaused },
    newValue: { is_paused: enabled, reason: reason || null },
  }, client);
}
