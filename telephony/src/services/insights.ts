import type { CallInsights, ConcernCode, TopicCode } from '@ultaura/types';
import type { LogCallInsightsInput } from '@ultaura/schemas/telephony';
import { getSupabaseClient } from '../utils/supabase.js';
import { encryptInsights } from '../utils/insights-crypto.js';
import { getPrivateTopics } from './insight-state.js';

export type LogCallInsightsData = Omit<LogCallInsightsInput, 'callSessionId' | 'lineId'>;

export interface StoredInsightsResult {
  id: string;
  hasConcerns: boolean;
}

export class DuplicateInsightError extends Error {
  code = 'already_recorded' as const;

  constructor() {
    super('Call insights already recorded');
    this.name = 'DuplicateInsightError';
  }
}

function uniqueTopics(values: TopicCode[]): TopicCode[] {
  return Array.from(new Set(values));
}

export async function storeCallInsights(
  accountId: string,
  lineId: string,
  callSessionId: string,
  data: LogCallInsightsData,
  options: {
    extractionMethod: 'tool_call' | 'post_call_fallback';
    durationSeconds?: number | null;
  }
): Promise<StoredInsightsResult> {
  const supabase = getSupabaseClient();

  const { data: baseline, error: baselineError } = await supabase
    .from('ultaura_line_baselines')
    .select('baseline_call_count, recent_concern_codes')
    .eq('line_id', lineId)
    .maybeSingle();

  if (baselineError) {
    throw baselineError;
  }

  const baselineCallCount = baseline?.baseline_call_count ?? 0;
  const baselineAvailable = baselineCallCount >= 3;
  const hasBaseline = baselineAvailable && data.confidence_overall >= 0.5;

  const baselineConcernCodes = new Set<ConcernCode>(
    (baseline?.recent_concern_codes ?? []) as ConcernCode[]
  );

  const concerns = (data.concerns ?? []).map((concern) => ({
    ...concern,
    is_novel: baselineAvailable ? !baselineConcernCodes.has(concern.code) : false,
  }));

  const sessionPrivateTopics = getPrivateTopics(callSessionId);
  const mergedPrivateTopics = uniqueTopics([
    ...sessionPrivateTopics,
    ...(data.private_topics ?? []),
  ]);

  const insights: CallInsights = {
    mood_overall: data.mood_overall,
    mood_intensity: data.mood_intensity,
    engagement_score: data.engagement_score,
    social_need_level: data.social_need_level,
    topics: data.topics,
    private_topics: mergedPrivateTopics,
    concerns,
    needs_follow_up: data.needs_follow_up,
    follow_up_reasons: data.follow_up_reasons ?? [],
    confidence_overall: data.confidence_overall,
  };

  const encrypted = await encryptInsights(accountId, lineId, callSessionId, insights);
  const durationSeconds =
    typeof options.durationSeconds === 'number'
      ? Math.round(options.durationSeconds)
      : null;

  const { data: inserted, error } = await supabase
    .from('ultaura_call_insights')
    .insert({
      call_session_id: callSessionId,
      line_id: lineId,
      account_id: accountId,
      insights_ciphertext: encrypted.ciphertext,
      insights_iv: encrypted.iv,
      insights_tag: encrypted.tag,
      insights_alg: encrypted.alg,
      insights_kid: encrypted.kid,
      extraction_method: options.extractionMethod,
      duration_seconds: durationSeconds,
      has_concerns: concerns.length > 0,
      needs_follow_up: data.needs_follow_up,
      has_baseline: hasBaseline,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new DuplicateInsightError();
    }
    throw error;
  }

  return {
    id: inserted.id,
    hasConcerns: concerns.length > 0,
  };
}

export async function updateInsightsDuration(
  callSessionId: string,
  durationSeconds: number | null
): Promise<void> {
  if (durationSeconds === null || Number.isNaN(durationSeconds)) {
    return;
  }

  const supabase = getSupabaseClient();
  const rounded = Math.round(durationSeconds);

  await supabase
    .from('ultaura_call_insights')
    .update({ duration_seconds: rounded })
    .eq('call_session_id', callSessionId);
}
