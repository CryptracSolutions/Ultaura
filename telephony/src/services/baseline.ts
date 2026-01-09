import { DateTime } from 'luxon';
import type { CallInsights, ConcernCode } from '@ultaura/types';
import { getSupabaseClient } from '../utils/supabase.js';
import { decryptInsights } from '../utils/insights-crypto.js';
import { logger } from '../utils/logger.js';

const BASELINE_MIN_CALLS = 3;

interface BaselineWindow {
  weekStart: DateTime;
  weekEnd: DateTime;
  baselineStart: DateTime;
  baselineEnd: DateTime;
}

export function getBaselineWindow(timezone: string, now?: DateTime): BaselineWindow {
  const current = (now ?? DateTime.now()).setZone(timezone);
  const weekEnd = current.startOf('day');
  const weekStart = weekEnd.minus({ days: 7 });
  const baselineEnd = weekStart;
  const baselineStart = baselineEnd.minus({ days: 14 });

  return { weekStart, weekEnd, baselineStart, baselineEnd };
}

export function calculateMoodDistribution(insights: CallInsights[]): {
  positive: number;
  neutral: number;
  low: number;
} {
  const total = insights.length;
  if (total === 0) {
    return { positive: 0, neutral: 0, low: 0 };
  }

  const counts = insights.reduce(
    (acc, insight) => {
      acc[insight.mood_overall] += 1;
      return acc;
    },
    { positive: 0, neutral: 0, low: 0 }
  );

  return {
    positive: counts.positive / total,
    neutral: counts.neutral / total,
    low: counts.low / total,
  };
}

export function isCallAnswered(session: {
  answered_by: string | null;
  seconds_connected: number | null;
}): boolean {
  if (session.answered_by === 'human') return true;
  if (session.answered_by === 'unknown') return true;
  if (session.answered_by === null && (session.seconds_connected ?? 0) > 0) return true;
  return false;
}

export function calculateAnswerRateFromSessions(sessions: Array<{
  answered_by: string | null;
  seconds_connected: number | null;
}>): number {
  if (!sessions.length) return 0;
  const answered = sessions.filter(isCallAnswered).length;
  return answered / sessions.length;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export async function recalculateBaseline(
  lineId: string,
  accountId: string,
  timezone: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { baselineStart, baselineEnd } = getBaselineWindow(timezone);
  const baselineStartUtc = baselineStart.toUTC().toISO();
  const baselineEndUtc = baselineEnd.toUTC().toISO();

  if (!baselineStartUtc || !baselineEndUtc) {
    logger.warn({ lineId, timezone }, 'Failed to compute baseline window');
    return;
  }

  const { data: insightRows, error: insightError } = await supabase
    .from('ultaura_call_insights')
    .select(
      'call_session_id, line_id, account_id, insights_ciphertext, insights_iv, insights_tag, duration_seconds'
    )
    .eq('line_id', lineId)
    .gte('created_at', baselineStartUtc)
    .lt('created_at', baselineEndUtc);

  if (insightError) {
    logger.error({ error: insightError, lineId }, 'Failed to fetch insights for baseline');
    return;
  }

  const decryptedInsights: Array<{ insights: CallInsights; durationSeconds: number | null }> = [];

  for (const row of insightRows ?? []) {
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

      if (insights.confidence_overall < 0.5) {
        continue;
      }

      decryptedInsights.push({ insights, durationSeconds: row.duration_seconds });
    } catch (error) {
      logger.warn({ error, lineId }, 'Failed to decrypt insight row');
    }
  }

  const baselineCallCount = decryptedInsights.length;

  if (baselineCallCount < BASELINE_MIN_CALLS) {
    await supabase
      .from('ultaura_line_baselines')
      .upsert({
        line_id: lineId,
        updated_at: new Date().toISOString(),
        avg_engagement: null,
        avg_duration_seconds: null,
        calls_per_week: null,
        answer_rate: null,
        mood_distribution: { positive: 0, neutral: 0, low: 0 },
        recent_concern_codes: [],
        baseline_call_count: baselineCallCount,
      }, { onConflict: 'line_id' });
    return;
  }

  const insights = decryptedInsights.map((entry) => entry.insights);
  const engagementScores = insights.map((entry) => entry.engagement_score);
  const durations = decryptedInsights
    .map((entry) => entry.durationSeconds)
    .filter((value): value is number => typeof value === 'number');

  const avgEngagement = engagementScores.length
    ? roundTo(engagementScores.reduce((sum, value) => sum + value, 0) / engagementScores.length, 2)
    : null;
  const avgDurationSeconds = durations.length
    ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : null;

  const moodDistribution = calculateMoodDistribution(insights);

  const recentConcernCodes = new Set<ConcernCode>();
  for (const insight of insights) {
    for (const concern of insight.concerns || []) {
      recentConcernCodes.add(concern.code as ConcernCode);
    }
  }

  const { data: sessionRows, error: sessionError } = await supabase
    .from('ultaura_call_sessions')
    .select('answered_by, seconds_connected')
    .eq('line_id', lineId)
    .like('scheduler_idempotency_key', 'schedule:%')
    .gte('created_at', baselineStartUtc)
    .lt('created_at', baselineEndUtc);

  if (sessionError) {
    logger.error({ error: sessionError, lineId }, 'Failed to fetch sessions for answer rate');
  }

  const answerRate = sessionRows
    ? roundTo(calculateAnswerRateFromSessions(sessionRows), 3)
    : 0;

  await supabase
    .from('ultaura_line_baselines')
    .upsert({
      line_id: lineId,
      updated_at: new Date().toISOString(),
      avg_engagement: avgEngagement,
      avg_duration_seconds: avgDurationSeconds,
      calls_per_week: roundTo(baselineCallCount / 2, 2),
      answer_rate: answerRate,
      mood_distribution: moodDistribution,
      recent_concern_codes: Array.from(recentConcernCodes),
      baseline_call_count: baselineCallCount,
    }, { onConflict: 'line_id' });
}

export async function recalculateBaselinesForAllLines(): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: lines, error: lineError } = await supabase
    .from('ultaura_lines')
    .select('id, account_id, timezone');

  if (lineError) {
    logger.error({ error: lineError }, 'Failed to fetch lines for baseline recalculation');
    return;
  }

  const { data: privacyRows, error: privacyError } = await supabase
    .from('ultaura_insight_privacy')
    .select('line_id, insights_enabled');

  if (privacyError) {
    logger.error({ error: privacyError }, 'Failed to fetch insight privacy for baselines');
    return;
  }

  const enabledLines = new Set(
    (privacyRows || [])
      .filter((row) => row.insights_enabled)
      .map((row) => row.line_id)
  );

  for (const line of lines || []) {
    if (!enabledLines.has(line.id)) {
      continue;
    }

    await recalculateBaseline(line.id, line.account_id, line.timezone);
  }
}
