import { LogCallInsightsInputSchema } from '@ultaura/schemas/telephony';
import { logger } from '../server.js';
import { getSupabaseClient, CallSessionRow } from '../utils/supabase.js';
import type { EphemeralBuffer } from './ephemeral-buffer.js';
import { storeCallInsights, DuplicateInsightError } from './insights.js';

const INSIGHTS_FALLBACK_PROMPT = `You are analyzing a conversation summary to extract insights.

Return a JSON object ONLY (no markdown, no explanation) with these keys:
- mood_overall: positive | neutral | low
- mood_intensity: 0-3
- engagement_score: 1-10
- social_need_level: 0-3
- topics: [{ code, weight }]
- private_topics: [topic_code]
- concerns: [{ code, severity, confidence }]
- needs_follow_up: boolean
- follow_up_reasons: [code]
- confidence_overall: 0-1

Topic codes: family, friends, activities, interests, memories, plans, daily_life, entertainment, feelings, requests.
Concern codes: loneliness, sadness, anxiety, sleep, pain, fatigue, appetite.
Follow-up codes: any concern code + wants_more_contact, missed_routine.

Rules:
- DO NOT include quotes, names, places, or identifying details
- Use only allowed codes
- Topic weights should sum to approximately 1.0
- Severity: 1=mild, 2=moderate, 3=significant
- If unsure, lower confidence_overall
- If no concerns, return concerns: []
- If no private topics, return private_topics: []

CONVERSATION SUMMARY:
`;

const LogCallInsightsDataSchema = LogCallInsightsInputSchema.omit({
  callSessionId: true,
  lineId: true,
});

function parseJson(content: string): unknown | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

async function extractInsightsFromText(turnText: string) {
  if (!process.env.XAI_API_KEY) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.XAI_GROK_MODEL || 'grok-3-fast',
        messages: [
          { role: 'system', content: INSIGHTS_FALLBACK_PROMPT },
          { role: 'user', content: turnText },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Grok fallback insights API error');
      return null;
    }

    const data = await response.json() as any;
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = parseJson(content);
    if (!parsed) {
      logger.warn({ content }, 'Failed to parse fallback insights JSON');
      return null;
    }

    const validated = LogCallInsightsDataSchema.safeParse(parsed);
    if (!validated.success) {
      logger.warn({ issues: validated.error.issues }, 'Fallback insights validation failed');
      return null;
    }

    return validated.data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      logger.warn('Fallback insights extraction timed out after 30s');
    } else {
      logger.warn({ error }, 'Fallback insights extraction failed');
    }
    return null;
  }
}

export async function extractFallbackInsightsFromBuffer(
  buffer: EphemeralBuffer | null,
  session: CallSessionRow,
  durationSeconds: number
): Promise<void> {
  if (!buffer || buffer.turns.length === 0) {
    return;
  }

  if (session.is_test_call) {
    return;
  }

  if (durationSeconds < 180) {
    return;
  }

  const supabase = getSupabaseClient();
  const { data: privacy, error: privacyError } = await supabase
    .from('ultaura_insight_privacy')
    .select('insights_enabled')
    .eq('line_id', session.line_id)
    .maybeSingle();

  if (privacyError) {
    logger.error({ error: privacyError, lineId: session.line_id }, 'Failed to check insight privacy');
    return;
  }

  if (privacy && privacy.insights_enabled === false) {
    return;
  }

  const { data: existing, error: existingError } = await supabase
    .from('ultaura_call_insights')
    .select('id')
    .eq('call_session_id', session.id)
    .maybeSingle();

  if (existingError) {
    logger.error({ error: existingError, callSessionId: session.id }, 'Failed to check existing insights');
    return;
  }

  if (existing) {
    return;
  }

  const turnText = buffer.turns
    .map(t => `[${t.speaker.toUpperCase()}] ${t.summary}`)
    .join('\n');

  const extracted = await extractInsightsFromText(turnText);
  if (!extracted) {
    return;
  }

  try {
    await storeCallInsights(
      session.account_id,
      session.line_id,
      session.id,
      extracted,
      {
        extractionMethod: 'post_call_fallback',
        durationSeconds,
      }
    );
  } catch (error) {
    if (error instanceof DuplicateInsightError || (error as { code?: string })?.code === 'already_recorded') {
      return;
    }
    logger.error({ error, callSessionId: session.id }, 'Failed to store fallback insights');
  }
}
