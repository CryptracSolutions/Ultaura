import crypto from 'crypto';
import type { SafetyCategory, SafetyTier } from '@ultaura/types';
import { SAFETY_CATEGORY_TIERS } from '@ultaura/types';
import { logger } from '../utils/logger.js';
import type { ClassifierResult } from './safety-classifier.js';
import {
  incrementVerifierDisagreements,
  observeVerifierLatency,
  type VerifierDecision,
  type VerifierSource,
} from './safety-metrics.js';
import { SAFETY_CLASSIFIER_RUBRIC_PROMPT } from './safety-rubric.js';

const MODERATION_TIMEOUT_MS = 1000;
const LLM_CLASSIFIER_TIMEOUT_MS = 3000;
const LLM_CLASSIFIER_MAX_RETRIES = 1;
const VERIFIER_CACHE_TTL_MS = 20_000;
const LLM_VERIFIER_TIMEOUT_MS = 1500;

export interface ModerationResult {
  available: boolean;
  flagged: boolean;
  categories: {
    selfHarm: boolean;
    selfHarmIntent: boolean;
    selfHarmInstructions: boolean;
    violence: boolean;
  };
  scores: Record<string, number>;
}

export interface VerifierResult {
  decision: VerifierDecision;
  confidence: number;
  latencyMs: number;
}

interface VerifierCacheEntry {
  inFlight?: Promise<VerifierResult>;
  result?: VerifierResult;
  contextHash?: string;
  completedAt?: number;
}

const verifierCache = new Map<string, VerifierCacheEntry>();

function isVerifierGateEnabled(): boolean {
  return process.env.ULTAURA_SAFETY_VERIFIER_GATE_ENABLED !== 'false';
}

function hashContext(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (error.name === 'AbortError') {
    return false;
  }
  return error instanceof TypeError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runModerationCheck(
  text: string,
  languageCode: string,
  timeoutMs: number = MODERATION_TIMEOUT_MS
): Promise<ModerationResult> {
  void languageCode;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('OpenAI API key not configured for moderation');
    return {
      available: false,
      flagged: false,
      categories: { selfHarm: false, selfHarmIntent: false, selfHarmInstructions: false, violence: false },
      scores: {},
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: text }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.error({ status: response.status }, 'Moderation API error');
      return {
        available: false,
        flagged: false,
        categories: { selfHarm: false, selfHarmIntent: false, selfHarmInstructions: false, violence: false },
        scores: {},
      };
    }

    const data = await response.json() as any;
    const result = data.results?.[0];

    if (!result) {
      return {
        available: true,
        flagged: false,
        categories: { selfHarm: false, selfHarmIntent: false, selfHarmInstructions: false, violence: false },
        scores: {},
      };
    }

    return {
      available: true,
      flagged: result.flagged,
      categories: {
        selfHarm: result.categories['self-harm'] ?? false,
        selfHarmIntent: result.categories['self-harm/intent'] ?? false,
        selfHarmInstructions: result.categories['self-harm/instructions'] ?? false,
        violence: result.categories.violence ?? false,
      },
      scores: result.category_scores ?? {},
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn('Moderation API timeout');
    } else {
      logger.error({ error }, 'Moderation API failed');
    }
    return {
      available: false,
      flagged: false,
      categories: { selfHarm: false, selfHarmIntent: false, selfHarmInstructions: false, violence: false },
      scores: {},
    };
  }
}

export async function runLLMClassifier(
  contextText: string,
  languageCode: string,
  moderationResult: ModerationResult,
  deadlineMs?: number
): Promise<ClassifierResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('OpenAI API key not configured for classifier');
    return null;
  }

  const systemPrompt = SAFETY_CLASSIFIER_RUBRIC_PROMPT;
  const userPrompt = `Language: ${languageCode}\nModeration flags: ${JSON.stringify(moderationResult.categories)}\n\nContext:\n${contextText}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= LLM_CLASSIFIER_MAX_RETRIES; attempt++) {
    const remaining = deadlineMs ? deadlineMs - Date.now() : LLM_CLASSIFIER_TIMEOUT_MS;
    if (remaining <= 0) {
      throw new Error('classifier_timeout');
    }

    const controller = new AbortController();
    const timeoutMs = Math.min(LLM_CLASSIFIER_TIMEOUT_MS, remaining);
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.ULTAURA_SAFETY_CLASSIFIER_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 200,
          temperature: 0,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        return null;
      }

      return parseClassifierResponse(content);
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error instanceof Error ? error : new Error(String(error));

      const isAbort = lastError.name === 'AbortError';
      const retryable = isNetworkError(lastError);
      if (isAbort) {
        logger.warn({ attempt }, 'LLM classifier timeout');
      } else {
        logger.warn({ attempt, error: lastError }, 'LLM classifier failed');
      }

      if (attempt < LLM_CLASSIFIER_MAX_RETRIES && retryable) {
        const backoffMs = 150 + Math.floor(Math.random() * 150);
        await sleep(backoffMs);
        continue;
      }
    }
  }

  logger.error({ error: lastError }, 'LLM classifier failed after retries');
  return null;
}

function parseClassifierResponse(content: string): ClassifierResult | null {
  try {
    const parsed = JSON.parse(content);

    if (!parsed.category || typeof parsed.confidence !== 'number') {
      return null;
    }

    return {
      category: parsed.category as SafetyCategory,
      tier: (parsed.tier as SafetyTier | null) ?? null,
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
      actionTaken: parsed.actionTaken || 'none',
      signals: {
        imminent_risk: parsed.signals?.imminent_risk ?? false,
        has_plan_or_means: parsed.signals?.has_plan_or_means ?? false,
        rationale_codes: parsed.signals?.rationale_codes ?? [],
      },
    };
  } catch (error) {
    logger.error({ error }, 'Failed to parse classifier response');
    return null;
  }
}

export async function verifyHighTierEvent(options: {
  callSessionId: string;
  contextWindowText: string;
  languageCode: string;
  category?: SafetyCategory;
  source: VerifierSource;
}): Promise<VerifierResult> {
  if (!isVerifierGateEnabled()) {
    logger.warn({ callSessionId: options.callSessionId }, 'Safety verifier gate disabled');
    return { decision: 'uncertain', confidence: 0, latencyMs: 0 };
  }

  const contextHash = hashContext(`${options.category ?? 'unknown'}:${options.contextWindowText}`);
  const cached = verifierCache.get(options.callSessionId);
  if (cached?.inFlight && cached.contextHash === contextHash) {
    return cached.inFlight;
  }
  if (cached?.result && cached.contextHash === contextHash && cached.completedAt) {
    if (Date.now() - cached.completedAt < VERIFIER_CACHE_TTL_MS) {
      return cached.result;
    }
  }

  const inFlight: Promise<VerifierResult> = (async (): Promise<VerifierResult> => {
    const startTime = Date.now();
    try {
      const moderationResult = await runModerationCheck(
        options.contextWindowText,
        options.languageCode
      );

      let decision: VerifierDecision;
      let confidence: number;
      const category = options.category;

      if (!moderationResult.available) {
        decision = 'uncertain';
        confidence = 0;
        const latencyMs = Date.now() - startTime;
        observeVerifierLatency(latencyMs);
        incrementVerifierDisagreements(options.source, decision);
        return { decision, confidence, latencyMs };
      }

      const isSelfHarmCategory = category === 'SUICIDAL_IDEATION' || category === 'SELF_HARM';
      const isPhysicalDanger = category === 'PHYSICAL_DANGER';
      const isAbuseConcern = category === 'ABUSE_CONCERN';
      const isEmergencyCategory = category === 'MEDICAL_EMERGENCY';

      if (isSelfHarmCategory) {
        if (moderationResult.categories.selfHarmIntent || moderationResult.categories.selfHarm) {
          decision = 'confirm';
          confidence = Math.max(
            moderationResult.scores['self-harm/intent'] ?? 0,
            moderationResult.scores['self-harm'] ?? 0
          );
        } else if (moderationResult.flagged && moderationResult.categories.violence) {
          decision = 'uncertain';
          confidence = moderationResult.scores.violence ?? 0.5;
        } else if (!moderationResult.flagged) {
          decision = 'clear';
          confidence = 1 - (moderationResult.scores['self-harm'] ?? 0);
        } else {
          decision = 'uncertain';
          confidence = 0.5;
        }
      } else if (isPhysicalDanger) {
        if (moderationResult.categories.violence) {
          decision = 'confirm';
          confidence = moderationResult.scores.violence ?? 0.6;
        } else {
          decision = 'uncertain';
          confidence = moderationResult.scores.violence ?? 0;
        }
      } else if (isAbuseConcern || isEmergencyCategory) {
        if (isAbuseConcern && moderationResult.categories.violence) {
          decision = 'confirm';
          confidence = moderationResult.scores.violence ?? 0.6;
        } else {
          const llmDeadline = Date.now() + LLM_VERIFIER_TIMEOUT_MS;
          const llmResult = await runLLMClassifier(
            options.contextWindowText,
            options.languageCode,
            moderationResult,
            llmDeadline
          );

          const llmTier = llmResult
            ? (llmResult.category === 'GENERAL_CONCERN'
              ? llmResult.tier
              : SAFETY_CATEGORY_TIERS[llmResult.category])
            : null;

          if (llmResult && llmResult.category === category && llmTier === 'high') {
            decision = 'confirm';
            confidence = llmResult.confidence;
          } else {
            decision = 'uncertain';
            confidence = llmResult?.confidence ?? 0;
          }
        }
      } else {
        if (moderationResult.categories.selfHarmIntent || moderationResult.categories.selfHarm) {
          decision = 'confirm';
          confidence = Math.max(
            moderationResult.scores['self-harm/intent'] ?? 0,
            moderationResult.scores['self-harm'] ?? 0
          );
        } else if (moderationResult.flagged && moderationResult.categories.violence) {
          decision = 'uncertain';
          confidence = moderationResult.scores.violence ?? 0.5;
        } else if (!moderationResult.flagged) {
          decision = 'clear';
          confidence = 1 - (moderationResult.scores['self-harm'] ?? 0);
        } else {
          decision = 'uncertain';
          confidence = 0.5;
        }
      }

      if (decision !== 'confirm') {
        incrementVerifierDisagreements(options.source, decision);
      }

      const latencyMs = Date.now() - startTime;
      observeVerifierLatency(latencyMs);
      return { decision, confidence, latencyMs };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      observeVerifierLatency(latencyMs);
      logger.error({ error }, 'Safety verifier failed');
      incrementVerifierDisagreements(options.source, 'uncertain');
      return { decision: 'uncertain', confidence: 0, latencyMs };
    }
  })();

  verifierCache.set(options.callSessionId, { inFlight, contextHash });

  const result = await inFlight;
  const current = verifierCache.get(options.callSessionId);
  if (current?.inFlight === inFlight) {
    verifierCache.set(options.callSessionId, {
      result,
      contextHash,
      completedAt: Date.now(),
    });
  }
  return result;
}
