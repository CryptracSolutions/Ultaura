import { logger } from '../utils/logger.js';
import { getFormattedTurns } from './ephemeral-buffer.js';
import { HANDOFF_SUMMARY_TIMEOUT_MS } from '../utils/constants.js';
import { startSpan, SpanStatusCode } from '../observability/tracing.js';

export const HANDOFF_FALLBACK_SUMMARY = 'The conversation has been ongoing. Continue naturally.';

export interface HandoffSummary {
  text: string;
  source: 'ai' | 'fallback';
  generatedAt: number;
  turnCount: number;
}

export async function generateHandoffSummary(
  callSessionId: string
): Promise<HandoffSummary> {
  const span = startSpan('handoff.summary');
  span?.setAttribute('handoff.call_session_id', callSessionId);

  const consentTurns = getFormattedTurns(callSessionId, { consentOnly: true });

  if (!consentTurns) {
    span?.setAttribute('handoff.summary_source', 'fallback');
    span?.end();
    return {
      text: HANDOFF_FALLBACK_SUMMARY,
      source: 'fallback',
      generatedAt: Date.now(),
      turnCount: 0,
    };
  }

  const turnLines = consentTurns.split('\n');
  span?.setAttribute('handoff.turn_count', turnLines.length);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HANDOFF_SUMMARY_TIMEOUT_MS);

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-3-fast',
        messages: [
          {
            role: 'system',
            content:
              'You are summarizing an ongoing phone conversation between an AI companion and a senior. ' +
              'Summarize in 300-500 words. Cover: key topics discussed, mood/energy of the senior, ' +
              'stories or threads in progress, any follow-ups mentioned, and where the conversation ' +
              'was heading. Write in present tense as if the conversation is still happening. ' +
              'Do NOT include greetings or sign-offs in your summary.',
          },
          {
            role: 'user',
            content: `Here is the conversation so far:\n\n${consentTurns}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`xAI API returned ${response.status}`);
    }

    const data = await response.json();
    const summaryText = data.choices?.[0]?.message?.content?.trim();

    if (!summaryText) {
      throw new Error('Empty summary response from xAI');
    }

    span?.setAttribute('handoff.summary_source', 'ai');
    span?.setAttribute('handoff.summary_length', summaryText.length);
    span?.setStatus({ code: SpanStatusCode.OK });
    span?.end();

    logger.info(
      { callSessionId, source: 'ai', turnCount: turnLines.length, summaryLength: summaryText.length },
      'Handoff summary generated via AI'
    );

    return {
      text: summaryText,
      source: 'ai',
      generatedAt: Date.now(),
      turnCount: turnLines.length,
    };
  } catch (error) {
    const fallbackTurns = getFormattedTurns(callSessionId, {
      consentOnly: true,
      maxTurns: 20,
    });

    span?.setAttribute('handoff.summary_source', 'fallback');
    span?.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : String(error) });
    span?.end();

    logger.warn(
      { callSessionId, error: error instanceof Error ? error.message : String(error) },
      'Handoff summary AI failed, using fallback turns'
    );

    return {
      text: fallbackTurns || HANDOFF_FALLBACK_SUMMARY,
      source: 'fallback',
      generatedAt: Date.now(),
      turnCount: turnLines.length,
    };
  }
}
