import { DateTime } from 'luxon';
import type { CallInsights } from '@ultaura/types';
import { getSupabaseClient, LineRow } from '../utils/supabase.js';
import { decryptInsights } from '../utils/insights-crypto.js';
import { logger } from '../utils/logger.js';

const ROLLUP_WINDOW_DAYS = 30;
const MIN_CALLS_FOR_PREFERENCES = 3;
const MIN_SEGMENTS_FOR_PREFERENCES = 3;

type TimeOfDay = 'morning' | 'afternoon' | 'evening';
type LineSeed = Pick<LineRow, 'id' | 'account_id' | 'timezone'>;

function isCallAnswered(session: {
  answered_by: string | null;
  seconds_connected: number | null;
}): boolean {
  if (session.answered_by === 'human') return true;
  if (session.answered_by === 'unknown') return true;
  if (session.answered_by === null && (session.seconds_connected ?? 0) > 0) return true;
  return false;
}

function getTimeOfDay(date: DateTime): TimeOfDay {
  if (date.hour < 12) return 'morning';
  if (date.hour < 17) return 'afternoon';
  return 'evening';
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number | null {
  if (values.length === 0) return null;
  const avg = average(values) ?? 0;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function mapEngagementToEnergy(score: number | null): 'high' | 'moderate' | 'low' {
  if (score === null || Number.isNaN(score)) return 'moderate';
  if (score >= 7) return 'high';
  if (score >= 4) return 'moderate';
  return 'low';
}

function mapEngagementToPersonaEnergy(
  avgScore: number | null,
  variability: number | null
): 'high' | 'moderate' | 'low' | 'variable' {
  if (variability !== null && variability >= 2.5) {
    return 'variable';
  }
  if (avgScore === null || Number.isNaN(avgScore)) return 'moderate';
  if (avgScore >= 7) return 'high';
  if (avgScore >= 4) return 'moderate';
  return 'low';
}

function pickTopDays(values: Map<number, number>, count: number, descending: boolean): number[] {
  return Array.from(values.entries())
    .sort((a, b) => descending ? b[1] - a[1] : a[1] - b[1])
    .slice(0, count)
    .map(([day]) => day);
}

async function decryptInsightsBatch(
  accountId: string,
  lineId: string,
  rows: Array<{
    call_session_id: string;
    insights_ciphertext: Uint8Array;
    insights_iv: Uint8Array;
    insights_tag: Uint8Array;
  }>
): Promise<Map<string, CallInsights>> {
  const result = new Map<string, CallInsights>();

  for (const row of rows) {
    try {
      const insights = await decryptInsights(accountId, lineId, row.call_session_id, {
        ciphertext: row.insights_ciphertext,
        iv: row.insights_iv,
        tag: row.insights_tag,
      });
      result.set(row.call_session_id, insights);
    } catch (error) {
      logger.warn({ error, callSessionId: row.call_session_id, lineId }, 'Failed to decrypt insights');
    }
  }

  return result;
}

async function recalculateRollupsForLine(line: LineSeed): Promise<void> {
  const supabase = getSupabaseClient();
  const windowStart = DateTime.utc().minus({ days: ROLLUP_WINDOW_DAYS }).toISO();
  const nowIso = new Date().toISOString();

  if (!windowStart) {
    return;
  }

  const [
    sessionRows,
    insightRows,
    moodRows,
    segmentRows,
    existingDaily,
    existingEmotion,
    existingPersona,
  ] = await Promise.all([
    supabase
      .from('ultaura_call_sessions')
      .select('id, created_at, started_at, answered_by, seconds_connected, is_test_call, is_reminder_call')
      .eq('line_id', line.id)
      .gte('created_at', windowStart),
    supabase
      .from('ultaura_call_insights')
      .select('call_session_id, insights_ciphertext, insights_iv, insights_tag, duration_seconds')
      .eq('line_id', line.id)
      .gte('created_at', windowStart),
    supabase
      .from('ultaura_mood_snapshots')
      .select('created_at, mood_start, mood_mid, mood_end')
      .eq('line_id', line.id)
      .gte('created_at', windowStart),
    supabase
      .from('ultaura_segment_engagement')
      .select('segment_type, senior_response, created_at')
      .eq('line_id', line.id)
      .gte('created_at', windowStart),
    supabase
      .from('ultaura_daily_rhythms')
      .select('*')
      .eq('line_id', line.id)
      .maybeSingle(),
    supabase
      .from('ultaura_emotional_patterns')
      .select('*')
      .eq('line_id', line.id)
      .maybeSingle(),
    supabase
      .from('ultaura_persona_adaptations')
      .select('*')
      .eq('line_id', line.id)
      .maybeSingle(),
  ]);

  if (sessionRows.error || insightRows.error || moodRows.error || segmentRows.error) {
    logger.error({
      lineId: line.id,
      sessionError: sessionRows.error,
      insightError: insightRows.error,
      moodError: moodRows.error,
      segmentError: segmentRows.error,
    }, 'Failed to load rollup data');
    return;
  }

  const sessions = (sessionRows.data ?? [])
    .filter((session) =>
      !session.is_test_call &&
      !session.is_reminder_call &&
      isCallAnswered(session)
    );

  const sessionMap = new Map(sessions.map((session) => [session.id, session]));
  const insightsMap = await decryptInsightsBatch(
    line.account_id,
    line.id,
    insightRows.data ?? []
  );

  const engagementByTime: Record<TimeOfDay, number[]> = {
    morning: [],
    afternoon: [],
    evening: [],
  };
  const durationByTime: Record<TimeOfDay, number[]> = {
    morning: [],
    afternoon: [],
    evening: [],
  };
  const startMinutesByTime: Record<TimeOfDay, number[]> = {
    morning: [],
    afternoon: [],
    evening: [],
  };
  const engagementValues: number[] = [];
  const dayOfWeekEngagement = new Map<number, number[]>();
  const durations: number[] = [];

  for (const [callSessionId, insights] of insightsMap.entries()) {
    const session = sessionMap.get(callSessionId);
    if (!session) continue;

    const startedAt = session.started_at ?? session.created_at;
    if (!startedAt) continue;

    const localTime = DateTime.fromISO(startedAt).setZone(line.timezone);
    const timeOfDay = getTimeOfDay(localTime);
    const engagement = insights.engagement_score;

    engagementByTime[timeOfDay].push(engagement);
    engagementValues.push(engagement);

    const duration = session.seconds_connected ?? null;
    if (typeof duration === 'number') {
      durationByTime[timeOfDay].push(duration);
      durations.push(duration);
    }

    const minutes = (localTime.hour * 60) + localTime.minute;
    startMinutesByTime[timeOfDay].push(minutes);

    const dayIndex = localTime.weekday % 7;
    const dayEntries = dayOfWeekEngagement.get(dayIndex) ?? [];
    dayEntries.push(engagement);
    dayOfWeekEngagement.set(dayIndex, dayEntries);
  }

  const timeOfDayAverages = {
    morning: average(engagementByTime.morning),
    afternoon: average(engagementByTime.afternoon),
    evening: average(engagementByTime.evening),
  };

  const bestTimeOfDay = (Object.entries(timeOfDayAverages)
    .filter(([, value]) => value !== null)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] ?? null) as TimeOfDay | null;

  const worstTimeOfDay = (Object.entries(timeOfDayAverages)
    .filter(([, value]) => value !== null)
    .sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0))[0]?.[0] ?? null) as TimeOfDay | null;

  const averageStartTime = (timeOfDay: TimeOfDay) => {
    const values = startMinutesByTime[timeOfDay];
    const avgMinutes = average(values);
    if (avgMinutes === null) return null;
    const hours = Math.floor(avgMinutes / 60);
    const minutes = Math.round(avgMinutes % 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  };

  const avgDurationByTime = {
    morning: average(durationByTime.morning),
    afternoon: average(durationByTime.afternoon),
    evening: average(durationByTime.evening),
  };

  const dayOfWeekAverage = new Map<number, number>();
  for (const [day, values] of dayOfWeekEngagement.entries()) {
    const avg = average(values);
    if (avg !== null) {
      dayOfWeekAverage.set(day, avg);
    }
  }

  const dayKeys = Array.from(dayOfWeekAverage.keys());
  const bestDays = dayKeys.length >= 3 ? pickTopDays(dayOfWeekAverage, 2, true) : null;
  const avoidDays = dayKeys.length >= 3 ? pickTopDays(dayOfWeekAverage, 2, false) : null;

  const dailyRhythmPayload = {
    line_id: line.id,
    updated_at: nowIso,
    morning_energy: mapEngagementToEnergy(timeOfDayAverages.morning ?? null),
    afternoon_energy: mapEngagementToEnergy(timeOfDayAverages.afternoon ?? null),
    evening_energy: mapEngagementToEnergy(timeOfDayAverages.evening ?? null),
    morning_routine_summary: existingDaily.data?.morning_routine_summary ?? null,
    afternoon_routine_summary: existingDaily.data?.afternoon_routine_summary ?? null,
    evening_routine_summary: existingDaily.data?.evening_routine_summary ?? null,
    best_engagement_time: bestTimeOfDay ? averageStartTime(bestTimeOfDay) : existingDaily.data?.best_engagement_time ?? null,
    worst_engagement_time: worstTimeOfDay ? averageStartTime(worstTimeOfDay) : existingDaily.data?.worst_engagement_time ?? null,
    avg_duration_by_time: avgDurationByTime,
    best_days_of_week: bestDays ?? existingDaily.data?.best_days_of_week ?? null,
    avoid_days_of_week: avoidDays ?? existingDaily.data?.avoid_days_of_week ?? null,
  };

  const moodCounts = new Map<string, number>();
  const moodRowsData = moodRows.data ?? [];
  for (const row of moodRowsData) {
    const mood = row.mood_end || row.mood_start || row.mood_mid;
    if (!mood) continue;
    moodCounts.set(mood, (moodCounts.get(mood) ?? 0) + 1);
  }

  const dominantMood = Array.from(moodCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const moodVariability = (() => {
    const uniqueCount = moodCounts.size;
    if (uniqueCount <= 1) return 'stable';
    if (uniqueCount === 2) return 'moderate';
    return 'high';
  })();

  const emotionalPatternPayload = {
    line_id: line.id,
    updated_at: nowIso,
    dominant_mood: dominantMood,
    mood_variability: moodVariability,
    best_time_of_day: bestTimeOfDay,
    worst_time_of_day: worstTimeOfDay,
    positive_triggers: existingEmotion.data?.positive_triggers ?? null,
    negative_triggers: existingEmotion.data?.negative_triggers ?? null,
    effective_techniques: existingEmotion.data?.effective_techniques ?? null,
    ineffective_techniques: existingEmotion.data?.ineffective_techniques ?? null,
  };

  const avgEngagement = average(engagementValues);
  const engagementStdDev = standardDeviation(engagementValues);
  const avgDurationSeconds = average(durations) ?? null;
  const callsAnalyzed = engagementValues.length;

  const segmentStats = new Map<string, { total: number; enjoyed: number }>();
  for (const row of segmentRows.data ?? []) {
    const entry = segmentStats.get(row.segment_type) ?? { total: 0, enjoyed: 0 };
    entry.total += 1;
    if (row.senior_response === 'enjoyed') {
      entry.enjoyed += 1;
    }
    segmentStats.set(row.segment_type, entry);
  }

  const storyStats = segmentStats.get('story');
  const storyEnjoyment = storyStats && storyStats.total > 0
    ? storyStats.enjoyed / storyStats.total
    : null;

  const hasEnoughCalls = callsAnalyzed >= MIN_CALLS_FOR_PREFERENCES;
  const prefersStories = storyStats && storyStats.total >= MIN_SEGMENTS_FOR_PREFERENCES
    ? (storyEnjoyment ?? 0) >= 0.6
    : existingPersona.data?.prefers_stories ?? true;

  const prefersShortExchanges = hasEnoughCalls
    ? (avgDurationSeconds ?? 0) > 0 && (avgDurationSeconds ?? 0) <= 360
    : existingPersona.data?.prefers_short_exchanges ?? false;

  const personaPayload = {
    line_id: line.id,
    updated_at: nowIso,
    formality_level: existingPersona.data?.formality_level ?? 'warm',
    humor_level: existingPersona.data?.humor_level ?? 'light',
    directness_level: existingPersona.data?.directness_level ?? 'balanced',
    vocabulary_complexity: existingPersona.data?.vocabulary_complexity ?? 'standard',
    regional_expressions: existingPersona.data?.regional_expressions ?? [],
    preferred_phrases: existingPersona.data?.preferred_phrases ?? [],
    avoided_phrases: existingPersona.data?.avoided_phrases ?? [],
    prefers_short_exchanges: prefersShortExchanges,
    prefers_stories: prefersStories,
    asks_many_questions: existingPersona.data?.asks_many_questions ?? true,
    typical_energy: mapEngagementToPersonaEnergy(avgEngagement ?? null, engagementStdDev ?? null),
    morning_energy: mapEngagementToEnergy(timeOfDayAverages.morning ?? null),
    afternoon_energy: mapEngagementToEnergy(timeOfDayAverages.afternoon ?? null),
    evening_energy: mapEngagementToEnergy(timeOfDayAverages.evening ?? null),
    calls_analyzed: callsAnalyzed,
    confidence_score: Math.min(1, callsAnalyzed / 20),
  };

  await Promise.all([
    supabase
      .from('ultaura_daily_rhythms')
      .upsert(dailyRhythmPayload, { onConflict: 'line_id' }),
    supabase
      .from('ultaura_emotional_patterns')
      .upsert(emotionalPatternPayload, { onConflict: 'line_id' }),
    supabase
      .from('ultaura_persona_adaptations')
      .upsert(personaPayload, { onConflict: 'line_id' }),
  ]);
}

export async function runPersonaAnalyzerForAllLines(): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: lines, error: lineError } = await supabase
    .from('ultaura_lines')
    .select('id, account_id, timezone');

  if (lineError) {
    logger.error({ error: lineError }, 'Failed to fetch lines for persona analyzer');
    return;
  }

  const { data: privacyRows, error: privacyError } = await supabase
    .from('ultaura_insight_privacy')
    .select('line_id, insights_enabled, is_paused');

  if (privacyError) {
    logger.error({ error: privacyError }, 'Failed to fetch insight privacy for persona analyzer');
    return;
  }

  const eligibleLines = new Set(
    (privacyRows ?? [])
      .filter((row) => row.insights_enabled && !row.is_paused)
      .map((row) => row.line_id)
  );

  for (const line of lines ?? []) {
    if (!eligibleLines.has(line.id)) {
      continue;
    }

    try {
      await recalculateRollupsForLine(line as LineSeed);
    } catch (error) {
      logger.warn({ error, lineId: line.id }, 'Failed to run persona analyzer for line');
    }
  }
}
