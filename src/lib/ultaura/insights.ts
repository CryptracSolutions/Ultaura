'use server';

import crypto from 'crypto';
import { DateTime } from 'luxon';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CallInsights, ConcernCode, FollowUpReasonCode, TopicCode } from '@ultaura/types';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import requireSession from '~/lib/user/require-session';
import getLogger from '~/core/logger';
import type {
  CallSessionRow,
  InsightPrivacyRow,
  InsightsDashboard,
  LineBaselineRow,
  LineRow,
  NotificationPreferencesRow,
  WeeklySummaryData,
  WeeklySummaryRow,
} from './types';
import { INSIGHTS } from './constants';

const logger = getLogger();

interface EncryptedPayload {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  tag: Uint8Array;
}

const INSIGHTS_ALG = 'aes-256-gcm';

function getKEK(): Buffer {
  const kekHex = process.env.ULTAURA_ENCRYPTION_KEY;

  if (!kekHex) {
    throw new Error('Missing ULTAURA_ENCRYPTION_KEY environment variable');
  }

  if (kekHex.length !== 64) {
    throw new Error('ULTAURA_ENCRYPTION_KEY must be 64 hex characters');
  }

  return Buffer.from(kekHex, 'hex');
}

function unwrapDEK(wrapped: Buffer, iv: Buffer, tag: Buffer): Buffer {
  const kek = getKEK();
  const decipher = crypto.createDecipheriv(INSIGHTS_ALG, kek, iv, {
    authTagLength: 16,
  });

  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(wrapped), decipher.final()]);
}

function decryptValue(
  dek: Buffer,
  ciphertext: Buffer,
  iv: Buffer,
  tag: Buffer,
  aad: Buffer
): CallInsights | WeeklySummaryData {
  const decipher = crypto.createDecipheriv(INSIGHTS_ALG, dek, iv, {
    authTagLength: 16,
  });

  decipher.setAuthTag(tag);
  decipher.setAAD(aad);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
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
    return unwrapDEK(
      Buffer.from(existing.dek_wrapped),
      Buffer.from(existing.dek_wrap_iv),
      Buffer.from(existing.dek_wrap_tag)
    );
  }

  const dek = crypto.randomBytes(32);
  const kek = getKEK();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(INSIGHTS_ALG, kek, iv, { authTagLength: 16 });
  const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();

  const { error } = await client
    .from('ultaura_account_crypto_keys')
    .insert({
      account_id: accountId,
      dek_wrapped: wrapped,
      dek_wrap_iv: iv,
      dek_wrap_tag: tag,
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

function getWeekEndDate(weekStartDate: string): string {
  const date = DateTime.fromISO(weekStartDate, { zone: 'utc' });
  return date.plus({ days: 6 }).toISODate() || weekStartDate;
}

function buildWeeklySummaryAAD(
  accountId: string,
  lineId: string,
  summaryId: string,
  weekStartDate: string
): Buffer {
  return Buffer.from(
    JSON.stringify({
      account_id: accountId,
      line_id: lineId,
      summary_id: summaryId,
      week_start_date: weekStartDate,
      week_end_date: getWeekEndDate(weekStartDate),
      type: 'weekly_summary',
    }),
    'utf8'
  );
}

function isCallAnswered(session: {
  answered_by: string | null;
  seconds_connected: number | null;
}): boolean {
  if (session.answered_by === 'human') return true;
  if (session.answered_by === 'unknown') return true;
  if (session.answered_by === null && (session.seconds_connected ?? 0) > 0) return true;
  return false;
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
  const minConfidence = options.minConfidence ?? null;
  return entries.filter((entry) => {
    if (minConfidence !== null && entry.insights.confidence_overall < minConfidence) {
      return false;
    }
    return isWithinWindow(entry.createdAt, options.start, options.end, options.timezone);
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
  encrypted: EncryptedPayload
): Promise<CallInsights> {
  const dek = await getOrCreateAccountDEK(client, accountId);
  const aad = buildInsightsAAD(accountId, lineId, callSessionId);
  return decryptValue(
    dek,
    Buffer.from(encrypted.ciphertext),
    Buffer.from(encrypted.iv),
    Buffer.from(encrypted.tag),
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
  const aad = buildWeeklySummaryAAD(accountId, lineId, summary.id, summary.week_start_date);
  return decryptValue(
    dek,
    Buffer.from(summary.summary_ciphertext),
    Buffer.from(summary.summary_iv),
    Buffer.from(summary.summary_tag),
    aad
  ) as WeeklySummaryData;
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

  const { data: created, error: insertError } = await client
    .from('ultaura_notification_preferences')
    .insert({
      account_id: accountId,
      line_id: lineId,
      weekly_summary_enabled: true,
      weekly_summary_format: 'email',
      weekly_summary_day: 'sunday',
      weekly_summary_time: '18:00',
      alert_missed_calls_enabled: true,
      alert_missed_calls_threshold: 3,
    })
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
    return {
      weekly_summary_enabled: true,
      weekly_summary_format: 'email',
      weekly_summary_day: 'sunday',
      weekly_summary_time: '18:00',
      alert_missed_calls_enabled: true,
      alert_missed_calls_threshold: 3,
    } as NotificationPreferencesRow;
  }

  return created as NotificationPreferencesRow;
}

export async function getInsightPrivacy(lineId: string): Promise<InsightPrivacyRow | null> {
  const line = await getAuthorizedLine(lineId);
  if (!line) {
    return null;
  }

  const client = await getAdminClient();
  const { data, error } = await client
    .from('ultaura_insight_privacy')
    .select('*')
    .eq('line_id', lineId)
    .maybeSingle();

  if (error) {
    logger.error({ error, lineId }, 'Failed to fetch insight privacy');
    return null;
  }

  return data as InsightPrivacyRow | null;
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
  const { data, error } = await client
    .from('ultaura_line_baselines')
    .select('*')
    .eq('line_id', lineId)
    .maybeSingle();

  if (error) {
    logger.error({ error, lineId }, 'Failed to fetch line baseline');
    return null;
  }

  return (data as LineBaselineRow | null) ?? null;
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
    return await decryptWeeklySummary(client, line.account_id, lineId, data as WeeklySummaryRow);
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
  const { data: privacy } = await client
    .from('ultaura_insight_privacy')
    .select('insights_enabled, is_paused, paused_reason, private_topic_codes')
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

  const [sessions, insightsRows, baseline] = await Promise.all([
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
  ]);

  if (sessions.error) {
    logger.error({ error: sessions.error, lineId }, 'Failed to fetch call sessions for insights');
    return null;
  }

  if (insightsRows.error) {
    logger.error({ error: insightsRows.error, lineId }, 'Failed to fetch call insights for dashboard');
    return null;
  }

  const sessionList = (sessions.data || []) as CallSessionRow[];
  const insightsList = insightsRows.data || [];

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

  const insightsBySession = new Map<string, CallInsights>();
  decryptedInsights.forEach((entry) => {
    insightsBySession.set(entry.callSessionId, entry.insights);
  });

  const filteredSessions = sessionList.filter((session) => !session.is_test_call);
  const thirtyDaySessions = filteredSessions;

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

  const weekSessions = filteredSessions.filter((session) =>
    DateTime.fromISO(session.created_at) >= DateTime.fromISO(weekStartUtc) &&
    DateTime.fromISO(session.created_at) < DateTime.fromISO(weekEndUtc)
  );
  const priorWeekSessions = filteredSessions.filter((session) =>
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

  const privateTopics = new Set((privacy?.private_topic_codes as string[]) || []);
  const topicWeights = new Map<TopicCode, number>();

  for (const insight of weekInsights) {
    const callPrivateTopics = new Set<string>([
      ...privateTopics,
      ...insight.private_topics,
    ]);

    for (const topic of insight.topics || []) {
      if (callPrivateTopics.has(topic.code)) {
        continue;
      }
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

  const currentConcerns = Array.from(concernMap.entries())
    .filter(([, data]) => !(data.isNovel && data.severity < 2))
    .map(([code, data]) => ({
      code,
      label: INSIGHTS.CONCERN_LABELS[code],
      severity: toSeverityLabel(data.severity),
      novelty: data.isNovel ? 'new' : 'recurring',
    }));

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

  const callHistory = [...weekSessions]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)
    .map((session) => ({
      ...session,
      mood_overall: insightsBySession.get(session.id)?.mood_overall ?? null,
    }));

  return {
    lineId: line.id,
    lineShortId: line.short_id,
    lineName: line.display_name,
    timezone: line.timezone,
    status: line.status,
    insightsEnabled: privacy?.insights_enabled ?? true,
    isPaused: privacy?.is_paused ?? false,
    pausedReason: privacy?.paused_reason ?? null,
    privateTopicCodes: (privacy?.private_topic_codes as string[]) || [],
    summary: {
      scheduledCalls,
      answeredCalls,
      answeredDelta,
      avgDurationMinutes,
      durationDeltaMinutes,
      moodSummary,
      moodShiftNote,
      engagementNote,
      showMissedCallsWarning,
      missedCalls,
      needsFollowUp,
      followUpReasons,
      socialNeedNote,
    },
    moodTrend,
    topics,
    concerns,
    callActivity,
    callHistory,
  };
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
  const base = existing ?? {
    weekly_summary_enabled: true,
    weekly_summary_format: 'email',
    weekly_summary_day: 'sunday',
    weekly_summary_time: '18:00',
    alert_missed_calls_enabled: true,
    alert_missed_calls_threshold: 3,
  };

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

export async function updateInsightPrivacy(
  lineId: string,
  settings: Partial<InsightPrivacyRow>
): Promise<void> {
  const line = await getAuthorizedLine(lineId);
  if (!line) {
    throw new Error('Line not found');
  }

  const client = await getAdminClient();
  const { data: existing, error: fetchError } = await client
    .from('ultaura_insight_privacy')
    .select('insights_enabled, is_paused, paused_reason, paused_at, private_topic_codes')
    .eq('line_id', lineId)
    .maybeSingle();

  if (fetchError) {
    logger.error({ error: fetchError, lineId }, 'Failed to fetch insight privacy');
    throw new Error('Failed to update insight privacy');
  }

  const base = {
    insights_enabled: existing?.insights_enabled ?? true,
    is_paused: existing?.is_paused ?? false,
    paused_reason: existing?.paused_reason ?? null,
    paused_at: existing?.paused_at ?? null,
    private_topic_codes: existing?.private_topic_codes ?? [],
  };

  const updates = Object.fromEntries(
    Object.entries(settings).filter(([, value]) => value !== undefined)
  );

  const { error } = await client
    .from('ultaura_insight_privacy')
    .upsert({
      line_id: lineId,
      ...base,
      ...updates,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'line_id' });

  if (error) {
    logger.error({ error, lineId }, 'Failed to update insight privacy');
    throw new Error('Failed to update insight privacy');
  }
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

  const client = await getAdminClient();
  const { data: existing, error: fetchError } = await client
    .from('ultaura_insight_privacy')
    .select('insights_enabled, is_paused, paused_reason, paused_at, private_topic_codes')
    .eq('line_id', lineId)
    .maybeSingle();

  if (fetchError) {
    logger.error({ error: fetchError, lineId }, 'Failed to fetch insight privacy for pause mode');
    throw new Error('Failed to update pause mode');
  }

  const base = {
    insights_enabled: existing?.insights_enabled ?? true,
    is_paused: existing?.is_paused ?? false,
    paused_reason: existing?.paused_reason ?? null,
    paused_at: existing?.paused_at ?? null,
    private_topic_codes: existing?.private_topic_codes ?? [],
  };

  const update = enabled
    ? {
        is_paused: true,
        paused_at: new Date().toISOString(),
        paused_reason: reason || null,
      }
    : {
        is_paused: false,
        paused_at: null,
        paused_reason: null,
      };

  const { error } = await client
    .from('ultaura_insight_privacy')
    .upsert({
      line_id: lineId,
      ...base,
      ...update,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'line_id' });

  if (error) {
    logger.error({ error, lineId }, 'Failed to update pause mode');
    throw new Error('Failed to update pause mode');
  }
}
