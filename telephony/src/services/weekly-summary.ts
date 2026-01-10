import crypto from 'crypto';
import { DateTime } from 'luxon';
import type { CallInsights, ConcernCode, FollowUpReasonCode, TopicCode } from '@ultaura/types';
import { getSupabaseClient, CallSessionRow, LineRow } from '../utils/supabase.js';
import { decryptInsights } from '../utils/insights-crypto.js';
import { encryptMemoryValue, getOrCreateAccountDEK } from '../utils/encryption.js';
import { getInternalApiSecret } from '../utils/env.js';
import { logger } from '../utils/logger.js';
import { getBaselineWindow, isCallAnswered } from './baseline.js';

type CallSessionSummaryRow = Pick<
  CallSessionRow,
  | 'id'
  | 'created_at'
  | 'ended_at'
  | 'seconds_connected'
  | 'answered_by'
  | 'direction'
  | 'scheduler_idempotency_key'
  | 'is_reminder_call'
  | 'is_test_call'
  | 'end_reason'
>;

export interface WeeklySummaryData {
  lineId: string;
  lineName: string;
  accountId: string;
  billingEmail: string;
  weekStartDate: string;
  weekEndDate: string;
  timezone: string;
  scheduledCalls: number;
  answeredCalls: number;
  missedCalls: number;
  showMissedCallsWarning: boolean;
  answerTrend: 'up' | 'down' | 'stable' | null;
  answerTrendValue: number | null;
  avgDurationMinutes: number | null;
  durationTrend: 'up' | 'down' | 'stable' | null;
  durationTrendValue: number | null;
  engagementNote: string | null;
  moodSummary: string | null;
  moodShiftNote: string | null;
  moodDistribution: {
    positive: number;
    neutral: number;
    low: number;
  } | null;
  socialNeedNote: string | null;
  topTopics: Array<{
    code: string;
    label: string;
    weight: number;
  }>;
  concerns: Array<{
    code: string;
    label: string;
    severity: 'mild' | 'moderate' | 'significant';
    novelty: 'new' | 'recurring' | 'resolved';
  }>;
  needsFollowUp: boolean;
  followUpReasons: string[];
  isPaused: boolean;
  pausedNote: string | null;
  dashboardUrl: string;
  settingsUrl: string;
}

export interface MissedCallsAlertPayload {
  lineId: string;
  accountId: string;
  lineName: string;
  consecutiveMissedCount: number;
  lastAttemptAt: string;
  dashboardUrl: string;
  settingsUrl: string;
}

interface NotificationPreferencesRow {
  weekly_summary_enabled: boolean;
  weekly_summary_format: 'email' | 'sms' | 'both';
  weekly_summary_day: string;
  weekly_summary_time: string;
  alert_missed_calls_enabled: boolean;
  alert_missed_calls_threshold: number;
}

interface InsightPrivacyRow {
  insights_enabled: boolean;
  is_paused: boolean;
  paused_reason: string | null;
  private_topic_codes: string[];
}

type WeeklySummaryLine = Pick<LineRow, 'id' | 'account_id' | 'display_name' | 'timezone' | 'short_id' | 'last_weekly_summary_at'>;

interface DecryptedInsightEntry {
  insights: CallInsights;
  durationSeconds: number | null;
  createdAt: string;
}

const TOPIC_LABELS: Record<TopicCode, string> = {
  family: 'Family',
  friends: 'Friends',
  activities: 'Activities',
  interests: 'Interests',
  memories: 'Memories',
  plans: 'Plans',
  daily_life: 'Daily Life',
  entertainment: 'Entertainment',
  feelings: 'Feelings',
  requests: 'Requests',
};

const CONCERN_LABELS: Record<ConcernCode, string> = {
  loneliness: 'Loneliness',
  sadness: 'Sadness',
  anxiety: 'Anxiety',
  sleep: 'Sleep Trouble',
  pain: 'Pain',
  fatigue: 'Fatigue',
  appetite: 'Appetite',
};

const FOLLOW_UP_LABELS: Record<FollowUpReasonCode, string> = {
  loneliness: 'Loneliness',
  sadness: 'Sadness',
  anxiety: 'Anxiety',
  sleep: 'Sleep Trouble',
  pain: 'Pain',
  fatigue: 'Fatigue',
  appetite: 'Appetite',
  wants_more_contact: 'Asked for more contact',
  missed_routine: 'Missed routine / schedule confusion',
};

function mapWeekday(day: string): number {
  switch (day) {
    case 'monday':
      return 1;
    case 'tuesday':
      return 2;
    case 'wednesday':
      return 3;
    case 'thursday':
      return 4;
    case 'friday':
      return 5;
    case 'saturday':
      return 6;
    case 'sunday':
    default:
      return 7;
  }
}

function getAppBaseUrl(): string {
  return (
    process.env.ULTAURA_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

function parseTime(value: string): { hour: number; minute: number } {
  const [hourStr, minuteStr] = value.split(':');
  const hour = Number.parseInt(hourStr, 10);
  const minute = Number.parseInt(minuteStr, 10);
  return {
    hour: Number.isFinite(hour) ? hour : 18,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

function getWeekEndDate(weekStartDate: string): string {
  const date = DateTime.fromISO(weekStartDate, { zone: 'utc' });
  return date.plus({ days: 6 }).toISODate() || weekStartDate;
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

function toSeverityLabel(severity: number): 'mild' | 'moderate' | 'significant' {
  if (severity >= 3) return 'significant';
  if (severity === 2) return 'moderate';
  return 'mild';
}

function summarizeMood(counts: { positive: number; neutral: number; low: number }, hasCalls: boolean): string {
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

function formatTrend(value: number | null): 'up' | 'down' | 'stable' | null {
  if (value === null) return null;
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'stable';
}

async function decryptInsightsForWindow(options: {
  lineId: string;
  accountId: string;
  startUtc: string;
  endUtc: string;
}): Promise<DecryptedInsightEntry[]> {
  const supabase = getSupabaseClient();
  const { lineId, accountId, startUtc, endUtc } = options;

  const { data: insightRows, error } = await supabase
    .from('ultaura_call_insights')
    .select(
      'call_session_id, line_id, created_at, insights_ciphertext, insights_iv, insights_tag, duration_seconds'
    )
    .eq('line_id', lineId)
    .gte('created_at', startUtc)
    .lt('created_at', endUtc);

  if (error) {
    logger.error({ error, lineId }, 'Failed to fetch weekly insights');
    return [];
  }

  const decrypted: DecryptedInsightEntry[] = [];

  for (const row of insightRows || []) {
    try {
      const insights = await decryptInsights(
        accountId,
        row.line_id,
        row.call_session_id,
        {
          ciphertext: row.insights_ciphertext,
          iv: row.insights_iv,
          tag: row.insights_tag,
        }
      );

      decrypted.push({
        insights,
        durationSeconds: row.duration_seconds,
        createdAt: row.created_at,
      });
    } catch (error) {
      logger.warn({ error, lineId }, 'Failed to decrypt insight row');
    }
  }

  return decrypted;
}

async function fetchCallSessions(options: {
  lineId: string;
  startUtc: string;
  endUtc: string;
}): Promise<CallSessionSummaryRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ultaura_call_sessions')
    .select(
      'id, created_at, ended_at, seconds_connected, answered_by, direction, scheduler_idempotency_key, is_reminder_call, is_test_call, end_reason'
    )
    .eq('line_id', options.lineId)
    .gte('created_at', options.startUtc)
    .lt('created_at', options.endUtc);

  if (error) {
    logger.error({ error, lineId: options.lineId }, 'Failed to fetch call sessions');
    return [];
  }

  return data || [];
}

function getBaselineConcerns(options: {
  insights: CallInsights[];
}): Map<ConcernCode, number> {
  const baselineMap = new Map<ConcernCode, number>();

  for (const insights of options.insights) {
    for (const concern of insights.concerns || []) {
      const existing = baselineMap.get(concern.code) || 0;
      if (concern.severity > existing) {
        baselineMap.set(concern.code, concern.severity);
      }
    }
  }

  return baselineMap;
}

function getTopicWeights(options: {
  insights: CallInsights[];
  privateTopicCodes: Set<string>;
}): Array<{ code: TopicCode; weight: number }> {
  const weights = new Map<TopicCode, number>();

  for (const insight of options.insights) {
    const callPrivateTopics = new Set<string>([...options.privateTopicCodes, ...insight.private_topics]);

    for (const topic of insight.topics || []) {
      if (callPrivateTopics.has(topic.code)) {
        continue;
      }

      weights.set(topic.code, (weights.get(topic.code) || 0) + topic.weight);
    }
  }

  return Array.from(weights.entries())
    .map(([code, weight]) => ({ code, weight }))
    .sort((a, b) => b.weight - a.weight);
}

function isWithinWindow(value: string, start: DateTime, end: DateTime, timezone: string): boolean {
  const date = DateTime.fromISO(value).setZone(timezone);
  return date >= start && date < end;
}

function filterInsightsForWindow(entries: DecryptedInsightEntry[], options: {
  start: DateTime;
  end: DateTime;
  timezone: string;
}): CallInsights[] {
  return entries
    .filter((entry) => entry.insights.confidence_overall >= 0.5)
    .filter((entry) => isWithinWindow(entry.createdAt, options.start, options.end, options.timezone))
    .map((entry) => entry.insights);
}

function hasSocialNeed(insights: CallInsights[]): boolean {
  return insights.some((insight) =>
    (insight.follow_up_reasons || []).includes('wants_more_contact')
  );
}

async function storeWeeklySummary(options: {
  lineId: string;
  accountId: string;
  weekStartDate: string;
  summary: WeeklySummaryData;
}): Promise<string | null> {
  const supabase = getSupabaseClient();

  const { data: existing, error: existingError } = await supabase
    .from('ultaura_weekly_summaries')
    .select('id, email_sent_at')
    .eq('line_id', options.lineId)
    .eq('week_start_date', options.weekStartDate)
    .maybeSingle();

  if (existingError) {
    logger.error(
      { error: existingError, lineId: options.lineId },
      'Failed to check existing weekly summary'
    );
  }

  if (existing?.email_sent_at) {
    return null;
  }

  const summaryId = existing?.id ?? crypto.randomUUID();

  const dek = await getOrCreateAccountDEK(supabase, options.accountId);
  const aad = buildWeeklySummaryAAD(options.accountId, options.lineId, options.weekStartDate);

  const { ciphertext, iv, tag } = encryptMemoryValue(dek, options.summary, aad);

  if (existing) {
    const { error } = await supabase
      .from('ultaura_weekly_summaries')
      .update({
        summary_ciphertext: ciphertext,
        summary_iv: iv,
        summary_tag: tag,
        summary_alg: 'aes-256-gcm',
        summary_kid: 'kek_v1',
      })
      .eq('id', summaryId);

    if (error) {
      logger.error({ error, lineId: options.lineId }, 'Failed to update weekly summary');
      return null;
    }

    return summaryId;
  }

  const { error: insertError } = await supabase
    .from('ultaura_weekly_summaries')
    .insert({
      id: summaryId,
      line_id: options.lineId,
      account_id: options.accountId,
      week_start_date: options.weekStartDate,
      summary_ciphertext: ciphertext,
      summary_iv: iv,
      summary_tag: tag,
      summary_alg: 'aes-256-gcm',
      summary_kid: 'kek_v1',
    });

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: retry } = await supabase
        .from('ultaura_weekly_summaries')
        .select('id, email_sent_at')
        .eq('line_id', options.lineId)
        .eq('week_start_date', options.weekStartDate)
        .maybeSingle();

      if (retry && !retry.email_sent_at) {
        const retryId = retry.id;
        const retryAad = buildWeeklySummaryAAD(
          options.accountId,
          options.lineId,
          options.weekStartDate
        );
        const retryEncrypted = encryptMemoryValue(dek, options.summary, retryAad);
        const { error: retryError } = await supabase
          .from('ultaura_weekly_summaries')
          .update({
            summary_ciphertext: retryEncrypted.ciphertext,
            summary_iv: retryEncrypted.iv,
            summary_tag: retryEncrypted.tag,
            summary_alg: 'aes-256-gcm',
            summary_kid: 'kek_v1',
          })
          .eq('id', retryId);

        if (retryError) {
          logger.error({ error: retryError, lineId: options.lineId }, 'Failed to refresh weekly summary');
          return null;
        }

        return retryId;
      }

      return null;
    }

    logger.error({ error: insertError, lineId: options.lineId }, 'Failed to store weekly summary');
    return null;
  }

  return summaryId;
}

async function markWeeklySummarySent(summaryId: string, sentAt: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('ultaura_weekly_summaries')
    .update({ email_sent_at: sentAt })
    .eq('id', summaryId);

  if (error) {
    logger.error({ error, summaryId }, 'Failed to mark weekly summary as sent');
  }
}

async function updateLineLastSummary(lineId: string, sentAt: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('ultaura_lines')
    .update({ last_weekly_summary_at: sentAt })
    .eq('id', lineId);

  if (error) {
    logger.error({ error, lineId }, 'Failed to update last weekly summary timestamp');
  }
}

async function sendWeeklySummaryEmail(summary: WeeklySummaryData): Promise<boolean> {
  const url = `${getAppBaseUrl()}/api/telephony/weekly-summary`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': getInternalApiSecret(),
      },
      body: JSON.stringify(summary),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      logger.error({ status: response.status, body }, 'Weekly summary email failed');
      return false;
    }

    return true;
  } catch (error) {
    logger.error({ error }, 'Weekly summary email request failed');
    return false;
  }
}

export async function getNotificationPreferences(
  accountId: string,
  lineId: string
): Promise<NotificationPreferencesRow> {
  const supabase = getSupabaseClient();

  const { data: existing, error } = await supabase
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

  const { data: created, error: insertError } = await supabase
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
    if (insertError.code === '23505') {
      const { data: retry } = await supabase
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
    };
  }

  return created as NotificationPreferencesRow;
}

async function getInsightPrivacy(lineId: string): Promise<InsightPrivacyRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ultaura_insight_privacy')
    .select('insights_enabled, is_paused, paused_reason, private_topic_codes')
    .eq('line_id', lineId)
    .maybeSingle();

  if (error) {
    logger.error({ error, lineId }, 'Failed to fetch insight privacy');
    return null;
  }

  return (data as InsightPrivacyRow | null) ?? null;
}

async function getBaselineStats(lineId: string): Promise<{
  avgEngagement: number | null;
  answerRate: number | null;
}> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('ultaura_line_baselines')
    .select('avg_engagement, answer_rate')
    .eq('line_id', lineId)
    .maybeSingle();

  if (error) {
    logger.error({ error, lineId }, 'Failed to fetch baseline stats');
    return { avgEngagement: null, answerRate: null };
  }

  return {
    avgEngagement: data?.avg_engagement ?? null,
    answerRate: data?.answer_rate ?? null,
  };
}

function getFollowUpReasons(insights: CallInsights[]): string[] {
  const reasonSet = new Set<FollowUpReasonCode>();

  for (const insight of insights) {
    if (!insight.needs_follow_up) {
      continue;
    }

    for (const reason of insight.follow_up_reasons || []) {
      reasonSet.add(reason);
    }
  }

  return Array.from(reasonSet).map((reason) => FOLLOW_UP_LABELS[reason]);
}

async function aggregateWeeklySummary(options: {
  line: WeeklySummaryLine;
  account: { id: string; billing_email: string | null };
  preferences: NotificationPreferencesRow;
  privacy: InsightPrivacyRow | null;
  window: ReturnType<typeof getBaselineWindow>;
}): Promise<WeeklySummaryData> {
  const { line, account, privacy, window } = options;
  const weekStartDate = window.weekStart.toISODate();
  if (!weekStartDate) {
    throw new Error('Failed to compute week start date.');
  }
  const weekEndDate = getWeekEndDate(weekStartDate);

  const weekStartUtc = window.weekStart.toUTC().toISO();
  const weekEndUtc = window.weekEnd.toUTC().toISO();
  const priorWeekStartUtc = window.weekStart.minus({ days: 7 }).toUTC().toISO();
  const socialBaselineStart = window.weekStart.minus({ days: 28 });
  const socialBaselineEnd = window.weekStart.minus({ days: 14 });
  const insightWindowStartUtc = socialBaselineStart.toUTC().toISO();

  if (
    !weekStartUtc ||
    !weekEndUtc ||
    !priorWeekStartUtc ||
    !insightWindowStartUtc
  ) {
    throw new Error('Failed to compute weekly summary window.');
  }

  const [
    insightEntries,
    currentSessions,
    priorSessions,
  ] = await Promise.all([
    decryptInsightsForWindow({
      lineId: line.id,
      accountId: account.id,
      startUtc: insightWindowStartUtc,
      endUtc: weekEndUtc,
    }),
    fetchCallSessions({
      lineId: line.id,
      startUtc: weekStartUtc,
      endUtc: weekEndUtc,
    }),
    fetchCallSessions({
      lineId: line.id,
      startUtc: priorWeekStartUtc,
      endUtc: weekStartUtc,
    }),
  ]);

  const weekInsights = filterInsightsForWindow(insightEntries, {
    start: window.weekStart,
    end: window.weekEnd,
    timezone: line.timezone,
  });
  const baselineInsights = filterInsightsForWindow(insightEntries, {
    start: window.baselineStart,
    end: window.baselineEnd,
    timezone: line.timezone,
  });
  const priorWeekInsights = filterInsightsForWindow(insightEntries, {
    start: window.weekStart.minus({ days: 7 }),
    end: window.weekStart,
    timezone: line.timezone,
  });
  const priorTwoWeekInsights = filterInsightsForWindow(insightEntries, {
    start: window.weekStart.minus({ days: 14 }),
    end: window.weekStart.minus({ days: 7 }),
    timezone: line.timezone,
  });
  const socialBaselineInsights = filterInsightsForWindow(insightEntries, {
    start: socialBaselineStart,
    end: socialBaselineEnd,
    timezone: line.timezone,
  });
	  const baselineConcerns = getBaselineConcerns({ insights: baselineInsights });

  const filteredSessions = currentSessions.filter((session) => !session.is_test_call);
  const priorSessionsFiltered = priorSessions.filter((session) => !session.is_test_call);

  const scheduledSessions = filteredSessions.filter(
    (session) => session.scheduler_idempotency_key?.startsWith('schedule:')
  );
  const answeredScheduled = scheduledSessions.filter((session) =>
    isCallAnswered({ answered_by: session.answered_by, seconds_connected: session.seconds_connected })
  );

  const scheduledCalls = scheduledSessions.length;
  const answeredCalls = answeredScheduled.length;
  const missedCalls = Math.max(0, scheduledCalls - answeredCalls);

  const answeredAll = filteredSessions.filter((session) =>
    isCallAnswered({ answered_by: session.answered_by, seconds_connected: session.seconds_connected })
  );

  const avgDurationMinutes =
    answeredAll.length > 0
      ? Math.round(
          answeredAll.reduce((sum, session) => sum + (session.seconds_connected ?? 0), 0) /
            answeredAll.length /
            60
        )
      : null;

  const priorScheduled = priorSessionsFiltered.filter(
    (session) => session.scheduler_idempotency_key?.startsWith('schedule:')
  );
  const priorAnsweredScheduled = priorScheduled.filter((session) =>
    isCallAnswered({ answered_by: session.answered_by, seconds_connected: session.seconds_connected })
  );

  const priorAnsweredCount = priorScheduled.length > 0 ? priorAnsweredScheduled.length : null;
  const answerTrendValue = priorAnsweredCount === null ? null : answeredCalls - priorAnsweredCount;

  const priorAnsweredAll = priorSessionsFiltered.filter((session) =>
    isCallAnswered({ answered_by: session.answered_by, seconds_connected: session.seconds_connected })
  );
  const priorAvgDurationMinutes =
    priorAnsweredAll.length > 0
      ? Math.round(
          priorAnsweredAll.reduce((sum, session) => sum + (session.seconds_connected ?? 0), 0) /
            priorAnsweredAll.length /
            60
        )
      : null;

  const durationTrendValue =
    priorAvgDurationMinutes === null || avgDurationMinutes === null
      ? null
      : avgDurationMinutes - priorAvgDurationMinutes;

  const { avgEngagement, answerRate } = await getBaselineStats(line.id);

  const engagementScores = weekInsights.map((entry) => entry.engagement_score);
  const avgEngagementScore = engagementScores.length
    ? engagementScores.reduce((sum, value) => sum + value, 0) / engagementScores.length
    : null;

  let engagementNote: string | null = null;
  if (
    avgEngagement !== null &&
    avgEngagementScore !== null &&
    engagementScores.length >= 2 &&
    avgEngagementScore - avgEngagement <= -2.5
  ) {
    engagementNote = `down ${Math.abs(avgEngagementScore - avgEngagement).toFixed(1)} points from typical`;
  }

  const moodCounts = weekInsights.reduce(
    (acc, insight) => {
      acc[insight.mood_overall] += 1;
      return acc;
    },
    { positive: 0, neutral: 0, low: 0 }
  );

  const moodSummary = summarizeMood(moodCounts, filteredSessions.length > 0);
  const weekLowCount = moodCounts.low;
  const baselineLowCount = baselineInsights.filter((insight) => insight.mood_overall === 'low').length;
  const moodShiftNote =
    weekLowCount >= 3 && baselineLowCount <= 1
      ? 'Low mood calls were higher than typical this week.'
      : null;
  const moodDistribution =
    weekInsights.length > 0
      ? {
          positive: moodCounts.positive,
          neutral: moodCounts.neutral,
          low: moodCounts.low,
        }
      : null;

  const privateTopics = new Set<string>(privacy?.private_topic_codes || []);
  const topicWeights = getTopicWeights({ insights: weekInsights, privateTopicCodes: privateTopics });
  const topTopics = topicWeights.slice(0, 5).map((topic) => ({
    code: topic.code,
    label: TOPIC_LABELS[topic.code],
    weight: Number(topic.weight.toFixed(3)),
  }));

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
  const resolvedConcerns = Array.from(baselineConcerns.entries())
    .filter(([code]) => !currentConcernCodes.has(code))
    .map(([code, severity]) => ({
      code,
      label: CONCERN_LABELS[code],
      severity: toSeverityLabel(severity),
      novelty: 'resolved' as const,
    }));

  const currentConcerns = Array.from(concernMap.entries()).map(([code, data]) => ({
    code,
    label: CONCERN_LABELS[code],
    severity: toSeverityLabel(data.severity),
    novelty: data.isNovel ? ('new' as const) : ('recurring' as const),
  }));

  const concerns = [...currentConcerns, ...resolvedConcerns];

  const followUpReasons = getFollowUpReasons(weekInsights);
  const needsFollowUp = followUpReasons.length > 0;

  const socialNeedNote =
    hasSocialNeed(weekInsights) &&
    hasSocialNeed(priorWeekInsights) &&
    hasSocialNeed(priorTwoWeekInsights) &&
    !hasSocialNeed(socialBaselineInsights)
      ? 'Social connection: may benefit from extra contact.'
      : null;

  const currentAnswerRate = scheduledCalls > 0 ? answeredCalls / scheduledCalls : 0;
  const answerRateDrop =
    answerRate !== null ? Math.max(0, answerRate - currentAnswerRate) : 0;
  const showMissedCallsWarning =
    answerRate !== null && answerRateDrop >= 0.2 && missedCalls >= 2;

  const dashboardUrl = `${getAppBaseUrl()}/dashboard/insights?line=${line.short_id}`;
  const settingsUrl = `${getAppBaseUrl()}/dashboard/lines/${line.short_id}/settings`;

  return {
    lineId: line.id,
    lineName: line.display_name,
    accountId: account.id,
    billingEmail: account.billing_email || '',
    weekStartDate,
    weekEndDate,
    timezone: line.timezone,
    scheduledCalls,
    answeredCalls,
    missedCalls,
    showMissedCallsWarning,
    answerTrend: formatTrend(answerTrendValue),
    answerTrendValue,
    avgDurationMinutes,
    durationTrend: formatTrend(durationTrendValue),
    durationTrendValue,
    engagementNote,
    moodSummary,
    moodShiftNote,
    moodDistribution,
    socialNeedNote,
    topTopics,
    concerns,
    needsFollowUp,
    followUpReasons,
    isPaused: privacy?.is_paused ?? false,
    pausedNote: (privacy?.is_paused ?? false)
      ? privacy?.paused_reason || 'Calls are currently paused for this line.'
      : null,
    dashboardUrl,
    settingsUrl,
  };
}

export async function generateWeeklySummaryForLine(line: WeeklySummaryLine): Promise<void> {
  const supabase = getSupabaseClient();
  const preferences = await getNotificationPreferences(line.account_id, line.id);

  if (!preferences.weekly_summary_enabled) {
    return;
  }

  // TODO: Add SMS delivery when weekly summaries support sms/both formats.
  const privacy = await getInsightPrivacy(line.id);
  if (privacy?.insights_enabled === false) {
    return;
  }

  const lineTime = DateTime.now().setZone(line.timezone);
  const preferredWeekday = mapWeekday(preferences.weekly_summary_day);
  const { hour: preferredHour, minute: preferredMinute } = parseTime(
    preferences.weekly_summary_time
  );

  if (lineTime.weekday !== preferredWeekday) {
    return;
  }

  const preferredTime = lineTime.set({
    hour: preferredHour,
    minute: preferredMinute,
    second: 0,
    millisecond: 0,
  });

  if (lineTime < preferredTime) {
    return;
  }

  const window = getBaselineWindow(line.timezone, lineTime);
  const weekStart = window.weekStart;

  if (line.last_weekly_summary_at) {
    const lastSent = DateTime.fromISO(line.last_weekly_summary_at).setZone(line.timezone);
    if (lastSent >= weekStart) {
      return;
    }
  }

  const { data: account, error: accountError } = await supabase
    .from('ultaura_accounts')
    .select('id, billing_email')
    .eq('id', line.account_id)
    .single();

  if (accountError || !account?.billing_email) {
    logger.warn({ lineId: line.id }, 'Missing billing email for weekly summary');
    return;
  }

  let summary: WeeklySummaryData;

  try {
    summary = await aggregateWeeklySummary({
      line,
      account,
      preferences,
      privacy,
      window,
    });
  } catch (error) {
    logger.error({ error, lineId: line.id }, 'Failed to aggregate weekly summary');
    return;
  }

  const summaryId = await storeWeeklySummary({
    lineId: line.id,
    accountId: line.account_id,
    weekStartDate: summary.weekStartDate,
    summary,
  });

  if (!summaryId) {
    return;
  }

  const sentAt = lineTime.toISO() || new Date().toISOString();
  const emailOk = await sendWeeklySummaryEmail(summary);

  if (!emailOk) {
    return;
  }

  await Promise.all([
    markWeeklySummarySent(summaryId, sentAt),
    updateLineLastSummary(line.id, sentAt),
  ]);
}

async function sendMissedCallAlert(payload: MissedCallsAlertPayload): Promise<boolean> {
  const url = `${getAppBaseUrl()}/api/telephony/missed-calls`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': getInternalApiSecret(),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      logger.error({ status: response.status, body }, 'Missed call alert failed');
      return false;
    }

    return true;
  } catch (error) {
    logger.error({ error }, 'Missed call alert request failed');
    return false;
  }
}

export async function checkMissedCallAlert(options: {
  lineId: string;
  accountId: string;
  lineName: string;
  lineShortId: string;
  consecutiveMissedCalls: number;
  missedAlertSentAt: string | null;
  lastAttemptAt: string;
}): Promise<void> {
  const { lineId, accountId, lineName, lineShortId, consecutiveMissedCalls, missedAlertSentAt } = options;

  if (missedAlertSentAt) {
    return;
  }

  const [preferences, privacy] = await Promise.all([
    getNotificationPreferences(accountId, lineId),
    getInsightPrivacy(lineId),
  ]);

  if (!preferences.alert_missed_calls_enabled) {
    return;
  }

  if (consecutiveMissedCalls < preferences.alert_missed_calls_threshold) {
    return;
  }

  if (privacy?.insights_enabled === false || privacy?.is_paused) {
    return;
  }

  const payload: MissedCallsAlertPayload = {
    lineId,
    accountId,
    lineName,
    consecutiveMissedCount: consecutiveMissedCalls,
    lastAttemptAt: options.lastAttemptAt,
    dashboardUrl: `${getAppBaseUrl()}/dashboard/insights?line=${lineShortId}`,
    settingsUrl: `${getAppBaseUrl()}/dashboard/lines/${lineShortId}/settings`,
  };

  const ok = await sendMissedCallAlert(payload);
  if (!ok) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('ultaura_lines')
    .update({ missed_alert_sent_at: new Date().toISOString() })
    .eq('id', lineId);

  if (error) {
    logger.error({ error, lineId }, 'Failed to mark missed call alert as sent');
  }
}
