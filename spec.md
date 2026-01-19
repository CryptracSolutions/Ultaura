# Multilingual Trust & Safety Backstop Improvements - Technical Specification

## Table of Contents
1. [Objective and Scope](#1-objective-and-scope)
2. [Architecture Overview](#2-architecture-overview)
3. [Technical Requirements](#3-technical-requirements)
4. [Implementation Details](#4-implementation-details)
5. [File Changes](#5-file-changes)
6. [Database Changes](#6-database-changes)
7. [Testing Strategy](#7-testing-strategy)
8. [Edge Cases and Error Handling](#8-edge-cases-and-error-handling)
9. [Observability](#9-observability)
10. [Assumptions](#10-assumptions)

---

## 1. Objective and Scope

### 1.1 Objective
Expand Ultaura's trust & safety “backstop” so it is robust for multilingual calls: treat keywords/heuristics as *soft signals*, add periodic safety sweeps when language is unknown/non‑EN/ES, and gate trusted-contact SMS behind a fast second-pass verifier to reduce false positives.

### 1.2 Scope

**In Scope:**
- Expand keyword coverage to 10 languages: EN, ES, ZH (Chinese), TL (Tagalog), VI (Vietnamese), FR (French), AR (Arabic), KO (Korean), HI (Hindi), UR (Urdu)
- Implement lightweight heuristic patterns for detecting safety concerns
- Add Spanish exclusion patterns (narrow, idiom-focused) to reduce false positives
- Build async safety classifier with in-process job queue
- Implement periodic safety sweeps for **unknown/undetected** and **non-EN/ES** languages
- Add second-pass verification using OpenAI Moderation API
- Gate trusted-contact SMS notifications behind verification
- Add Prometheus metrics for observability
- Extend safety event signals with new fields

**Out of Scope:**
- Adding keyword exclusions for non-EN/ES languages (keywords are soft signals)
- Separate worker processes or Redis-based job queues
- Real-time blocking of Grok responses
- Changes to the Grok model prompts or tool definitions

### 1.3 Success Criteria
- Safety keyword detection works across all 10 supported languages
- False positive SMS notifications reduced via second-pass verification
- Periodic sweeps catch safety concerns in languages without keyword coverage
- System operates within latency budgets (1s moderation, 3s classifier)
- Feature can be toggled via environment variable

---

## 2. Architecture Overview

### 2.1 High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PRIMARY DETECTION                                   │
│  ┌─────────────┐    ┌──────────────────┐    ┌─────────────────────┐            │
│  │  Grok Model │───▶│ log_safety_concern│───▶│  Record Safety Event│            │
│  │  (realtime) │    │     (tool)       │    │  (zero extra latency)│            │
│  └─────────────┘    └──────────────────┘    └─────────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ If high tier
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         ASYNC SAFETY CLASSIFIER                                  │
│                                                                                  │
│  Triggers:                                                                       │
│  1. Model reports high tier ──────────────────────────────┐                     │
│  2. Soft signals (expanded keywords, heuristics) ─────────┤                     │
│  3. Periodic sweeps (60-120s for non-EN/ES) ──────────────┤                     │
│                                                            ▼                     │
│  ┌────────────────┐    ┌─────────────────────┐    ┌───────────────────┐        │
│  │  In-Process    │───▶│  OpenAI Moderation  │───▶│  LLM Rubric Pass  │        │
│  │  Job Queue     │    │  API (1s timeout)   │    │  (3s timeout)     │        │
│  └────────────────┘    └─────────────────────┘    └───────────────────┘        │
│                                                            │                     │
│                                                            ▼                     │
│                                    If high tier ──▶ Second-Pass Verifier        │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        SECOND-PASS VERIFICATION                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐       │
│  │  OpenAI Moderation API verifier                                       │       │
│  │  Input: flagged utterance + preceding assistant turn + context window │       │
│  └──────────────────────────────────────────────────────────────────────┘       │
│                              │                                                   │
│            ┌─────────────────┼─────────────────┐                                │
│            ▼                 ▼                 ▼                                │
│      ┌──────────┐      ┌──────────┐      ┌──────────┐                          │
│      │ Confirms │      │  Clears  │      │ Uncertain│                          │
│      │          │      │          │      │          │                          │
│      │ Send SMS │      │Block SMS │      │Hold SMS  │                          │
│      │notification│    │Log event │      │Escalate? │                          │
│      └──────────┘      └──────────┘      └──────────┘                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| `safety-keywords.ts` (new) | Refactored keyword matching logic, testable module |
| `safety-heuristics.ts` (new) | Lightweight pattern-based heuristic detection |
| `safety-classifier.ts` (new) | Async classifier job queue and LLM rubric runner |
| `safety-verifier.ts` (new) | OpenAI Moderation API verification |
| `safety-metrics.ts` (new) | Prometheus metric definitions and helpers |
| `grok-bridge.ts` (modified) | Integrate triggers, extract keyword scan logic |
| `safety-event.ts` (modified) | Add verifier gate before SMS notification |
| `keywords.ts` (modified) | Expand to 10 languages |
| `exclusions.ts` (modified) | Add Spanish exclusion patterns |

---

## 3. Technical Requirements

### 3.1 Supported Languages

| ISO Code | Language | Keyword Support | Exclusion Support |
|----------|----------|-----------------|-------------------|
| en | English | Yes (existing) | Yes (existing) |
| es | Spanish | Yes (expanded) | Yes (new) |
| zh | Chinese (Simplified) | Yes (new) | No |
| tl | Tagalog/Filipino | Yes (new) | No |
| vi | Vietnamese | Yes (new) | No |
| fr | French | Yes (new) | No |
| ar | Arabic | Yes (new) | No |
| ko | Korean | Yes (new) | No |
| hi | Hindi | Yes (new) | No |
| ur | Urdu | Yes (new) | No |

### 3.2 Soft Signal Triggers

Soft signals trigger the async classifier but do NOT directly escalate:

1. **Expanded keywords** in any of the 10 supported languages
2. **Heuristic patterns** (language-independent):
   - Repeated negation/hopelessness patterns
   - "Goodbye" + permanence constructions
   - "Can't go on"-style patterns
   - "Hurt myself" intent patterns
3. **Spanish exclusion patterns** reduce unnecessary classifier calls

### 3.3 Periodic Sweep Configuration

| Language Type | Sweep Interval | Context Window |
|---------------|----------------|----------------|
| Unknown/undetected (before report_conversation_language) | 60–90 seconds | 6-12 turns, 1-2k chars |
| EN/ES (after language confirmed) | No sweeps by default (keyword coverage sufficient) | N/A |
| Other supported (ZH, TL, VI, FR, AR, KO, HI, UR) | 120 seconds | 6-12 turns, 1-2k chars |
| Unsupported languages | 60 seconds | 6-12 turns, 1-2k chars |

### 3.4 Timeout and Retry Policy

| Operation | Timeout | Retry |
|-----------|---------|-------|
| OpenAI Moderation API | 1s strict | No retry, fail fast |
| LLM Rubric Classifier | 3s | 1 retry on network error only |
| Overall classifier job | 5s total | Job marked failed after timeout |

### 3.5 Concurrency Limits

- **Per-callSessionId**: At most 1 pending sweep job + 1 pending verify job
- **Global concurrency**: Maximum 3 concurrent classifier jobs per pod
- **Job queue size**: Bounded to 50 jobs (oldest dropped if full)

---

## 4. Implementation Details

### 4.1 Keyword Expansion Structure

```typescript
// packages/prompts/src/safety/keywords.ts

export interface LanguageKeywords {
  high: readonly string[];
  medium: readonly string[];
  low: readonly string[];
}

export const SAFETY_KEYWORDS_BY_LANGUAGE: Record<string, LanguageKeywords> = {
  en: { /* existing English keywords */ },
  es: { /* expanded Spanish keywords */ },
  zh: {
    high: [
      '自杀', '想死', '不想活', '结束生命', '自残',
      '伤害自己', '活着没意思', '不如死了',
    ],
    medium: [
      '绝望', '放弃', '没有希望', '活不下去',
      '没有意义', '太累了',
    ],
    low: [
      '孤独', '寂寞', '没人关心', '一个人',
    ],
  },
  tl: {
    high: [
      'pagpapakamatay', 'gusto kong mamatay', 'tapusin ang buhay',
      'saktan ang sarili', 'pumatay', 'ayaw ko nang mabuhay',
    ],
    medium: [
      'walang pag-asa', 'sumuko', 'hindi na kaya',
      'pagod na ako sa lahat',
    ],
    low: [
      'malungkot', 'nag-iisa', 'walang nagmamahal',
    ],
  },
  vi: {
    high: [
      'tự tử', 'muốn chết', 'kết thúc cuộc sống',
      'tự hại', 'không muốn sống',
    ],
    medium: [
      'tuyệt vọng', 'bỏ cuộc', 'không còn hy vọng',
      'chịu không nổi',
    ],
    low: [
      'cô đơn', 'một mình', 'không ai quan tâm',
    ],
  },
  fr: {
    high: [
      'suicide', 'me tuer', 'en finir', 'mourir',
      'me faire du mal', 'ne plus vivre',
    ],
    medium: [
      'sans espoir', 'abandonner', 'plus la peine',
      'n\'en peux plus',
    ],
    low: [
      'seul', 'seule', 'personne ne m\'aime', 'isolé',
    ],
  },
  ar: {
    high: [
      'انتحار', 'أريد الموت', 'إنهاء حياتي',
      'أؤذي نفسي', 'لا أريد أن أعيش',
    ],
    medium: [
      'يائس', 'استسلام', 'لا أمل', 'لا أستطيع المتابعة',
    ],
    low: [
      'وحيد', 'لا أحد يهتم', 'منعزل',
    ],
  },
  ko: {
    high: [
      '자살', '죽고 싶어', '삶을 끝내고', '자해',
      '살고 싶지 않아',
    ],
    medium: [
      '절망', '포기', '희망이 없어', '더 이상 못하겠어',
    ],
    low: [
      '외로워', '혼자', '아무도 신경 안 써',
    ],
  },
  hi: {
    high: [
      'आत्महत्या', 'मरना चाहता हूं', 'जीवन समाप्त',
      'खुद को नुकसान', 'जीना नहीं चाहता',
    ],
    medium: [
      'निराशा', 'हार मान', 'कोई उम्मीद नहीं',
      'सहन नहीं होता',
    ],
    low: [
      'अकेला', 'कोई परवाह नहीं करता', 'तन्हा',
    ],
  },
  ur: {
    high: [
      'خودکشی', 'مرنا چاہتا ہوں', 'زندگی ختم',
      'خود کو نقصان', 'جینا نہیں چاہتا',
    ],
    medium: [
      'مایوسی', 'ہار ماننا', 'کوئی امید نہیں',
      'برداشت نہیں ہوتا',
    ],
    low: [
      'اکیلا', 'کوئی پرواہ نہیں کرتا', 'تنہا',
    ],
  },
};

// Flattened for backward compatibility
export const SAFETY_KEYWORDS: Record<SafetyTier, readonly string[]> = {
  high: Object.values(SAFETY_KEYWORDS_BY_LANGUAGE).flatMap(lang => lang.high),
  medium: Object.values(SAFETY_KEYWORDS_BY_LANGUAGE).flatMap(lang => lang.medium),
  low: Object.values(SAFETY_KEYWORDS_BY_LANGUAGE).flatMap(lang => lang.low),
};
```

### 4.2 Spanish Exclusion Patterns

```typescript
// packages/prompts/src/safety/exclusions.ts

export const SAFETY_EXCLUSION_PATTERNS_EN = [
  // Common English false positives
  'killing time',
  'kill for a',
  'killing it',
  'drop dead gorgeous',
  'to die for',
  'dying to',
  'dead tired',
  'dead serious',
  'bored to death',
  'scared to death',
  // Non-safety "hurt" contexts
  'hurt feelings',
  'hurt my back',
  'hurt my knee',
  'hurt my leg',
  'hurt my arm',
  // Context exclusions (talking about others/media)
  'movie about',
  'book about',
  'article about',
  'news about',
  'show about',
  'heard about someone',
  'my friend',
  'my neighbor',
  'their friend',
  'his friend',
  'her friend',
] as const;

export const SAFETY_EXCLUSION_PATTERNS_ES = [
  // Narrow, idiom-focused exclusions to reduce obvious false positives.
  // Avoid excluding ambiguous threat phrases like "me mata" / "me vas a matar"
  // because they can also be literal (PHYSICAL_DANGER).
  'me muero de risa',
  'me muero de hambre',
  'me muero de sed',
  'me muero de frío',
  'me muero de calor',
  'me muero de sueño',
  'me muero de vergüenza',
  'morir de risa',
  'matando el tiempo',
] as const;

// Backwards compatibility export used by existing keyword scanner (EN-only today).
export const SAFETY_EXCLUSION_PATTERNS = [
  ...SAFETY_EXCLUSION_PATTERNS_EN,
  ...SAFETY_EXCLUSION_PATTERNS_ES,
] as const;
```

### 4.3 Safety Heuristics Module

```typescript
// telephony/src/services/safety-heuristics.ts

export interface HeuristicMatch {
  pattern: string;
  confidence: number;
  category: 'negation_hopelessness' | 'goodbye_permanence' | 'cant_go_on' | 'self_harm_intent';
}

export interface HeuristicResult {
  triggered: boolean;
  matches: HeuristicMatch[];
  totalConfidence: number;
}

const HEURISTIC_PATTERNS: Array<{
  pattern: RegExp;
  category: HeuristicMatch['category'];
  confidence: number;
  minMatches?: number;
}> = [
  // Repeated negation/hopelessness (requires 2+ occurrences in context)
  {
    pattern: /\b(no\s+point|nothing\s+matters?|doesn'?t\s+matter|never\s+get\s+better|always\s+(be\s+)?this\s+way)\b/gi,
    category: 'negation_hopelessness',
    confidence: 0.6,
    minMatches: 2,
  },
  // Goodbye + permanence constructions
  {
    pattern: /\b(goodbye|farewell|adios|final\s+goodbye|last\s+time|won'?t\s+see\s+you|before\s+i\s+go)\b.*\b(forever|final|last|end|never\s+again)\b/gi,
    category: 'goodbye_permanence',
    confidence: 0.7,
  },
  // "Can't go on" style patterns
  {
    pattern: /\b(can'?t\s+(go\s+on|take\s+(it\s+)?any\s*more|do\s+this\s+anymore|keep\s+(going|living))|too\s+much\s+to\s+bear|unbearable)\b/gi,
    category: 'cant_go_on',
    confidence: 0.65,
  },
  // Self-harm intent patterns
  {
    pattern: /\b(want\s+to\s+(hurt|harm|cut|end)|going\s+to\s+(hurt|harm)|thinking\s+(about|of)\s+(hurting|harming))\s*(myself|my\s+life)?\b/gi,
    category: 'self_harm_intent',
    confidence: 0.8,
  },
];

export function detectHeuristics(text: string): HeuristicResult {
  const matches: HeuristicMatch[] = [];
  const normalizedText = text.toLowerCase();

  for (const { pattern, category, confidence, minMatches = 1 } of HEURISTIC_PATTERNS) {
    const patternMatches = normalizedText.match(pattern) || [];
    if (patternMatches.length >= minMatches) {
      matches.push({
        pattern: patternMatches[0],
        confidence,
        category,
      });
    }
  }

  const totalConfidence = matches.length > 0
    ? Math.min(1, matches.reduce((sum, m) => sum + m.confidence, 0) / matches.length)
    : 0;

  return {
    triggered: matches.length > 0,
    matches,
    totalConfidence,
  };
}
```

### 4.4 Async Safety Classifier

```typescript
// telephony/src/services/safety-classifier.ts

import type { SafetyCategory, SafetyTier } from '@ultaura/types';
import type { TurnSummary } from './ephemeral-buffer.js';
import { logger } from '../server.js';
import { runModerationCheck, runLLMClassifier } from './safety-verifier.js';
import { incrementClassifierRuns, incrementClassifierTriggers, observeClassifierLatency } from './safety-metrics.js';

export interface ClassifierJob {
  id: string;
  callSessionId: string;
  lineId: string;
  languageCode: string;
  reason: 'high_verify' | 'periodic_sweep' | 'soft_signal';
  contextWindow: ContextWindow;
  enqueuedAt: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface ContextWindow {
  turns: TurnSummary[];
  totalChars: number;
  totalTurns: number;
  windowStartMs: number;
  windowEndMs: number;
}

export interface ClassifierResult {
  category: SafetyCategory;
  tier: SafetyTier | null;
  confidence: number;
  actionTaken: 'none' | 'suggested_988' | 'suggested_911';
  signals: {
    imminent_risk: boolean;
    has_plan_or_means: boolean;
    rationale_codes: string[];
  };
}

const MAX_QUEUE_SIZE = 50;
const MAX_CONCURRENT_JOBS = 3;
const CONTEXT_WINDOW_MAX_TURNS = 12;
const CONTEXT_WINDOW_MAX_CHARS = 2000;
const CONTEXT_WINDOW_DURATION_MS = 120_000; // 2 minutes

// In-memory job queue
const jobQueue: Map<string, ClassifierJob> = new Map();
const pendingJobs: Map<string, Set<string>> = new Map(); // callSessionId -> jobIds
let activeJobCount = 0;

function removeJob(jobId: string): void {
  const job = jobQueue.get(jobId);
  jobQueue.delete(jobId);
  if (!job) return;
  const sessionJobs = pendingJobs.get(job.callSessionId);
  if (sessionJobs) {
    sessionJobs.delete(jobId);
    if (sessionJobs.size === 0) pendingJobs.delete(job.callSessionId);
  }
}

export function buildContextWindow(
  turns: TurnSummary[],
  maxTurns: number = CONTEXT_WINDOW_MAX_TURNS,
  maxChars: number = CONTEXT_WINDOW_MAX_CHARS,
  windowDurationMs: number = CONTEXT_WINDOW_DURATION_MS
): ContextWindow {
  const now = Date.now();
  const cutoffTime = now - windowDurationMs;

  // Filter to recent turns
  const recentTurns = turns.filter(t => t.timestamp >= cutoffTime);

  // Take last N turns
  const windowTurns = recentTurns.slice(-maxTurns);

  // Truncate to max chars
  let totalChars = 0;
  const truncatedTurns: TurnSummary[] = [];

  for (let i = windowTurns.length - 1; i >= 0 && totalChars < maxChars; i--) {
    const turn = windowTurns[i];
    const turnChars = turn.summary.length;
    if (totalChars + turnChars <= maxChars) {
      truncatedTurns.unshift(turn);
      totalChars += turnChars;
    } else {
      // Truncate this turn to fit
      const remaining = maxChars - totalChars;
      truncatedTurns.unshift({
        ...turn,
        summary: turn.summary.slice(0, remaining),
      });
      totalChars = maxChars;
      break;
    }
  }

  return {
    turns: truncatedTurns,
    totalChars,
    totalTurns: truncatedTurns.length,
    windowStartMs: truncatedTurns[0]?.timestamp ?? now,
    windowEndMs: truncatedTurns[truncatedTurns.length - 1]?.timestamp ?? now,
  };
}

export function enqueueClassifierJob(
  callSessionId: string,
  lineId: string,
  languageCode: string,
  reason: ClassifierJob['reason'],
  contextWindow: ContextWindow
): string | null {
  // Dedupe: check if same reason job already pending OR processing for this session
  const sessionJobs = pendingJobs.get(callSessionId) || new Set();
  const existingJob = Array.from(sessionJobs).find(id => {
    const job = jobQueue.get(id);
    return job?.reason === reason && (job?.status === 'pending' || job?.status === 'processing');
  });

  if (existingJob) {
    logger.debug({ callSessionId, reason }, 'Deduplicated classifier job');
    return existingJob;
  }

  // Check queue size
  if (jobQueue.size >= MAX_QUEUE_SIZE) {
    // Drop oldest job
    const oldestId = Array.from(jobQueue.keys())[0];
    if (oldestId) {
      removeJob(oldestId);
      logger.warn({ droppedJobId: oldestId }, 'Dropped oldest classifier job due to queue full');
    }
  }

  const jobId = `${callSessionId}-${reason}-${Date.now()}`;
  const job: ClassifierJob = {
    id: jobId,
    callSessionId,
    lineId,
    languageCode,
    reason,
    contextWindow,
    enqueuedAt: Date.now(),
    status: 'pending',
  };

  jobQueue.set(jobId, job);
  sessionJobs.add(jobId);
  pendingJobs.set(callSessionId, sessionJobs);

  // Classifier job trigger metrics (low-cardinality labels only)
  incrementClassifierTriggers(reason);

  // Process async (fire and forget)
  processNextJob().catch(err => {
    logger.error({ error: err }, 'Error processing classifier job');
  });

  return jobId;
}

async function processNextJob(): Promise<void> {
  if (activeJobCount >= MAX_CONCURRENT_JOBS) {
    return;
  }

  // Find next pending job
  const nextJob = Array.from(jobQueue.values()).find(j => j.status === 'pending');
  if (!nextJob) {
    return;
  }

  nextJob.status = 'processing';
  activeJobCount++;

  const startTime = Date.now();

  try {
    const result = await runClassifier(nextJob);

    nextJob.status = 'completed';
    observeClassifierLatency(nextJob.reason, Date.now() - startTime);
    incrementClassifierRuns(nextJob.reason, 'ok');

    // Handle result
    if (result && result.tier === 'high') {
      // Trigger second-pass verification
      await handleHighTierResult(nextJob, result);
    }
  } catch (error) {
    nextJob.status = 'failed';
    incrementClassifierRuns(nextJob.reason, error instanceof Error && error.message.includes('timeout') ? 'timeout' : 'error');
    logger.error({ error, jobId: nextJob.id }, 'Classifier job failed');
  } finally {
    activeJobCount--;

    // Clean up
    jobQueue.delete(nextJob.id);
    const sessionJobs = pendingJobs.get(nextJob.callSessionId);
    if (sessionJobs) {
      sessionJobs.delete(nextJob.id);
      if (sessionJobs.size === 0) {
        pendingJobs.delete(nextJob.callSessionId);
      }
    }

    // Process next job
    processNextJob().catch(err => {
      logger.error({ error: err }, 'Error processing next classifier job');
    });
  }
}

async function runClassifier(job: ClassifierJob): Promise<ClassifierResult | null> {
  const contextText = job.contextWindow.turns
    .map(t => `${t.speaker}: ${t.summary}`)
    .join('\n');

  // Step 1: Run OpenAI Moderation API (cheap gate for periodic sweeps)
  const moderationResult = await runModerationCheck(contextText, job.languageCode);

  // For periodic sweeps, use moderation as the gate to control cost.
  // For soft signals (keywords/heuristics) and high_verify jobs, DO NOT gate on moderation
  // because many genuine concerns (hopelessness, passive ideation) will not be "flagged".
  if (job.reason === 'periodic_sweep' && !moderationResult.flagged) return null;

  // Step 2: Run LLM rubric classifier
  return runLLMClassifier(contextText, job.languageCode, moderationResult);
}

async function handleHighTierResult(job: ClassifierJob, result: ClassifierResult): Promise<void> {
  // This will be handled by safety-event.ts verifier gate
  logger.info({
    callSessionId: job.callSessionId,
    category: result.category,
    confidence: result.confidence,
    imminentRisk: result.signals.imminent_risk,
  }, 'High tier result from async classifier');
}

export function clearJobsForSession(callSessionId: string): void {
  const sessionJobs = pendingJobs.get(callSessionId);
  if (sessionJobs) {
    for (const jobId of sessionJobs) {
      jobQueue.delete(jobId);
    }
    pendingJobs.delete(callSessionId);
  }
}
```

### 4.5 Safety Verifier Module

```typescript
// telephony/src/services/safety-verifier.ts

import type { SafetyCategory, SafetyTier } from '@ultaura/types';
import { logger } from '../server.js';
import { incrementVerifierDisagreements, observeVerifierLatency } from './safety-metrics.js';
import { SAFETY_CLASSIFIER_RUBRIC_PROMPT } from './safety-rubric.js';

const MODERATION_TIMEOUT_MS = 1000;
const LLM_CLASSIFIER_TIMEOUT_MS = 3000;
const LLM_CLASSIFIER_MAX_RETRIES = 1;

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
  decision: 'confirm' | 'clear' | 'uncertain';
  confidence: number;
  latencyMs: number;
}

export async function runModerationCheck(
  text: string,
  languageCode: string
): Promise<ModerationResult> {
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
  const timeoutId = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);

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
        available: true,
        flagged: false,
        categories: { selfHarm: false, selfHarmIntent: false, selfHarmInstructions: false, violence: false },
        scores: {},
      };
    }

    const data = await response.json();
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
      available: true,
      flagged: false,
      categories: { selfHarm: false, selfHarmIntent: false, selfHarmInstructions: false, violence: false },
      scores: {},
    };
  }
}

export async function runLLMClassifier(
  contextText: string,
  languageCode: string,
  moderationResult: ModerationResult
): Promise<import('./safety-classifier.js').ClassifierResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('OpenAI API key not configured for classifier');
    return null;
  }

  // Single source of truth for the rubric prompt (do not duplicate across modules).
  const systemPrompt = SAFETY_CLASSIFIER_RUBRIC_PROMPT;
  const userPrompt = `Language: ${languageCode}\nModeration flags: ${JSON.stringify(moderationResult.categories)}\n\nContext:\n${contextText}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= LLM_CLASSIFIER_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_CLASSIFIER_TIMEOUT_MS);

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

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return null;
      }

      return parseClassifierResponse(content);
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error instanceof Error ? error : new Error(String(error));

      if (lastError.name === 'AbortError') {
        logger.warn({ attempt }, 'LLM classifier timeout');
      } else if (attempt < LLM_CLASSIFIER_MAX_RETRIES) {
        logger.warn({ attempt, error: lastError }, 'LLM classifier failed, retrying');
        continue;
      }
    }
  }

  logger.error({ error: lastError }, 'LLM classifier failed after retries');
  return null;
}

function parseClassifierResponse(content: string): import('./safety-classifier.js').ClassifierResult | null {
  try {
    const parsed = JSON.parse(content);

    // Validate required fields
    if (!parsed.category || typeof parsed.confidence !== 'number') {
      return null;
    }

    return {
      category: parsed.category as SafetyCategory,
      tier: parsed.tier as SafetyTier | null,
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
      actionTaken: parsed.actionTaken || 'none',
      signals: {
        imminent_risk: parsed.signals?.imminent_risk ?? false,
        has_plan_or_means: parsed.signals?.has_plan_or_means ?? false,
        rationale_codes: parsed.signals?.rationale_codes ?? [],
      },
    };
  } catch (error) {
    // SECURITY: never log model output if it might include user content.
    logger.error({ error }, 'Failed to parse classifier response');
    return null;
  }
}

export async function verifyHighTierEvent(
  contextWindowText: string,
  languageCode: string,
  source: 'model' | 'keyword_backstop' | 'sweep'
): Promise<VerifierResult> {
  const startTime = Date.now();

  // Verifier uses the same capped sliding window as sweeps (6–12 turns / <=2k chars).
  const moderationResult = await runModerationCheck(contextWindowText, languageCode);
  const latencyMs = Date.now() - startTime;

  observeVerifierLatency(latencyMs);

  // Decision logic
  let decision: VerifierResult['decision'];
  let confidence: number;

  // Hard gate: if verifier is unavailable, block SMS (uncertain) rather than failing open.
  if (!moderationResult.available) {
    decision = 'uncertain';
    confidence = 0;
    incrementVerifierDisagreements(source, decision);
    return { decision, confidence, latencyMs };
  }

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

  if (decision !== 'confirm') {
    incrementVerifierDisagreements(source, decision);
  }

  return { decision, confidence, latencyMs };
}
```

```typescript
// telephony/src/services/safety-rubric.ts
// Single source of truth for the rubric prompt used by the LLM classifier.

export const SAFETY_CLASSIFIER_RUBRIC_PROMPT = `You are a safety classifier for a senior companion service. Analyze the conversation context and output a JSON assessment.

Categories:
- SUICIDAL_IDEATION: Explicit thoughts of suicide or wanting to die
- SELF_HARM: Intent to hurt oneself physically
- HOPELESSNESS: Persistent despair, feeling life is not worth living
- ISOLATION_DISTRESS: Severe loneliness affecting wellbeing
- PHYSICAL_DANGER: Threat from others or environment
- MEDICAL_EMERGENCY: Acute medical crisis
- ABUSE_CONCERN: Signs of elder abuse
- COGNITIVE_DECLINE: Memory or confusion concerns
- GENERAL_CONCERN: Other safety concerns (requires tier)

Output JSON format:
{
  "category": "<CATEGORY>",
  "tier": "low" | "medium" | "high" | null,
  "confidence": 0.0-1.0,
  "actionTaken": "none" | "suggested_988" | "suggested_911",
  "signals": {
    "imminent_risk": boolean,
    "has_plan_or_means": boolean,
    "rationale_codes": ["explicit_intent", "timeframe_immediate", "plan_stated", "means_mentioned", "passive_ideation", "hopelessness_pattern"]
  }
}

Rules:
- tier is only required for GENERAL_CONCERN
- imminent_risk=true for: stated intent + near-term timeframe, ongoing act, medical emergency
- has_plan_or_means=true for: specific plan mentioned, access to means
- suggested_911 when imminent_risk=true OR ongoing act OR medical emergency
- suggested_988 for high-tier suicidal/self-harm without clear immediacy
- Be conservative: only flag genuine safety concerns, not normal sadness.`;
```

### 4.6 Safety Metrics Module

```typescript
// telephony/src/services/safety-metrics.ts

import { Counter, Histogram, Registry } from 'prom-client';
import { registry } from '../utils/metrics.js';

// Counters
export const safetyClassifierRunsTotal = new Counter({
  name: 'ultaura_safety_classifier_runs_total',
  help: 'Total safety classifier runs',
  labelNames: ['reason', 'result'],
  registers: [registry],
});

export const safetyClassifierTriggersTotal = new Counter({
  name: 'ultaura_safety_classifier_triggers_total',
  help: 'Total safety classifier triggers',
  labelNames: ['source', 'tier'],
  registers: [registry],
});

export const safetyVerifierDisagreementsTotal = new Counter({
  name: 'ultaura_safety_verifier_disagreements_total',
  help: 'Total verifier disagreements with initial assessment',
  labelNames: ['source', 'initial_tier', 'verifier'],
  registers: [registry],
});

export const safetyNotificationsBlockedTotal = new Counter({
  name: 'ultaura_safety_notifications_blocked_total',
  help: 'Total safety notifications blocked',
  labelNames: ['reason'],
  registers: [registry],
});

export const safetyNotificationsSentTotal = new Counter({
  name: 'ultaura_safety_notifications_sent_total',
  help: 'Total safety notifications sent',
  labelNames: ['channel', 'tier'],
  registers: [registry],
});

// Histograms
export const safetyClassifierLatencyMs = new Histogram({
  name: 'ultaura_safety_classifier_latency_ms',
  help: 'Safety classifier latency in milliseconds',
  labelNames: ['reason'],
  buckets: [100, 250, 500, 1000, 2000, 3000, 5000],
  registers: [registry],
});

export const safetyVerifierLatencyMs = new Histogram({
  name: 'ultaura_safety_verifier_latency_ms',
  help: 'Safety verifier latency in milliseconds',
  buckets: [50, 100, 250, 500, 1000, 1500],
  registers: [registry],
});

// Helper functions
export function incrementClassifierRuns(
  reason: 'high_verify' | 'periodic_sweep' | 'soft_signal',
  result: 'ok' | 'error' | 'timeout'
): void {
  safetyClassifierRunsTotal.inc({ reason, result });
}

// Keep labels low-cardinality: sources map to a small fixed set.
export function incrementClassifierTriggers(reason: 'high_verify' | 'periodic_sweep' | 'soft_signal'): void {
  const source = reason === 'periodic_sweep' ? 'sweep' : reason === 'high_verify' ? 'model' : 'heuristic';
  safetyClassifierTriggersTotal.inc({ source, tier: 'high' });
}

export function incrementVerifierDisagreements(
  source: 'model' | 'keyword_backstop' | 'sweep',
  verifier: 'clear' | 'confirm' | 'uncertain'
): void {
  safetyVerifierDisagreementsTotal.inc({ source, initial_tier: 'high', verifier });
}

export function incrementNotificationsBlocked(
  reason: 'verifier_clear' | 'uncertain' | 'rate_limited' | 'no_consent'
): void {
  safetyNotificationsBlockedTotal.inc({ reason });
}

export function incrementNotificationsSent(
  channel: 'sms',
  tier: 'high'
): void {
  safetyNotificationsSentTotal.inc({ channel, tier });
}

export function observeClassifierLatency(
  reason: 'high_verify' | 'periodic_sweep' | 'soft_signal',
  latencyMs: number
): void {
  safetyClassifierLatencyMs.observe({ reason }, latencyMs);
}

export function observeVerifierLatency(latencyMs: number): void {
  safetyVerifierLatencyMs.observe(latencyMs);
}
```

### 4.7 Refactored Keyword Scanner Module

```typescript
// telephony/src/services/safety-keywords.ts

import type { SafetyCategory, SafetyMatch, SafetyTier } from '@ultaura/types';
import { SAFETY_KEYWORDS_BY_LANGUAGE, KEYWORD_CATEGORIES } from '@ultaura/prompts/safety';
import { SAFETY_EXCLUSION_PATTERNS_EN, SAFETY_EXCLUSION_PATTERNS_ES } from '@ultaura/prompts/safety';

export interface KeywordScanResult {
  matches: SafetyMatch[];
  languageHint: string | null;
  exclusionsApplied: string[];
}

export function scanForSafetyKeywords(
  transcript: string,
  detectedLanguage: string | null,
  alreadyTriggeredTiers: Set<SafetyTier>
): KeywordScanResult {
  const text = transcript.toLowerCase().trim();
  const matches: SafetyMatch[] = [];
  const exclusionsApplied: string[] = [];
  let languageHint: string | null = null;

  // Determine which languages to scan.
  // - Always include EN and ES for code-switching.
  // - If language is unknown, add script-based fallbacks (so we don't scan every language blindly).
  const baseFallbacks = ['en', 'es'];
  const scriptHints: string[] = [];
  if (!detectedLanguage) {
    if (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(transcript)) scriptHints.push('zh');
    if (/\p{Script=Hangul}/u.test(transcript)) scriptHints.push('ko');
    if (/\p{Script=Arabic}/u.test(transcript)) scriptHints.push('ar', 'ur');
    if (/\p{Script=Devanagari}/u.test(transcript)) scriptHints.push('hi');
  }
  const languagesToScan = detectedLanguage
    ? Array.from(new Set([detectedLanguage, ...baseFallbacks]))
    : Array.from(new Set([...baseFallbacks, ...scriptHints]));

  for (const tier of ['high', 'medium', 'low'] as const) {
    if (alreadyTriggeredTiers.has(tier)) {
      continue;
    }

    let matchedTier = false;

    for (const langCode of languagesToScan) {
      const langKeywords = SAFETY_KEYWORDS_BY_LANGUAGE[langCode];
      if (!langKeywords) continue;

      const keywords = langKeywords[tier];

      for (const keyword of keywords) {
        const keywordMatch = findKeywordMatch(text, keyword);

        if (keywordMatch) {
          // Check exclusions
          const exclusionPatterns = langCode === 'es'
            ? [...SAFETY_EXCLUSION_PATTERNS_EN, ...SAFETY_EXCLUSION_PATTERNS_ES]
            : SAFETY_EXCLUSION_PATTERNS_EN;

          // If an exclusion overlaps, keep scanning for another occurrence of the same keyword.
          let currentMatch = keywordMatch;
          while (currentMatch) {
            const exclusion = isExcludedAtPosition(text, currentMatch.start, currentMatch.end, exclusionPatterns);
            if (!exclusion) {
              matches.push({ tier, matchedKeyword: keyword });
              languageHint = langCode;
              matchedTier = true;
              break;
            }
            exclusionsApplied.push(exclusion);
            currentMatch = findKeywordMatch(text, keyword, currentMatch.end);
          }

          if (matchedTier) break;
        }
      }

      if (matchedTier) break;
    }
  }

  return { matches, languageHint, exclusionsApplied };
}

export function findKeywordMatch(
  text: string,
  keyword: string,
  fromIndex = 0
): { start: number; end: number } | null {
  const normalizedText = text.toLowerCase();
  const normalizedKeyword = keyword.toLowerCase();

  // For non-ASCII keywords (CJK, Arabic, Devanagari, etc.), word boundaries are unreliable.
  // Use substring matching. These are *soft signals* and are always verified downstream.
  const isAsciiKeyword = /^[\x00-\x7F]+$/.test(normalizedKeyword);
  if (!isAsciiKeyword) {
    const idx = normalizedText.indexOf(normalizedKeyword, fromIndex);
    return idx === -1 ? null : { start: idx, end: idx + normalizedKeyword.length };
  }

  // For ASCII/Latin keywords, use Unicode-safe "letter boundaries" instead of \b.
  const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'giu');
  regex.lastIndex = fromIndex;
  const match = regex.exec(normalizedText);
  return match ? { start: match.index, end: match.index + match[0].length } : null;
}

export function isExcludedAtPosition(
  text: string,
  keywordStart: number,
  keywordEnd: number,
  exclusionPatterns: readonly string[]
): string | null {
  for (const pattern of exclusionPatterns) {
    const normalizedText = text.toLowerCase();
    const normalizedPattern = pattern.toLowerCase();

    const isAsciiPattern = /^[\x00-\x7F]+$/.test(normalizedPattern);
    if (!isAsciiPattern) {
      const idx = normalizedText.indexOf(normalizedPattern);
      if (idx !== -1) {
        const exclStart = idx;
        const exclEnd = idx + normalizedPattern.length;
        if (keywordStart < exclEnd && keywordEnd > exclStart) return pattern;
      }
      continue;
    }

    const escaped = normalizedPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'giu');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(normalizedText)) !== null) {
      const exclStart = match.index;
      const exclEnd = match.index + match[0].length;
      if (keywordStart < exclEnd && keywordEnd > exclStart) return pattern;
    }
  }

  return null;
}

export function getCategoryForKeyword(keyword: string): SafetyCategory {
  return KEYWORD_CATEGORIES[keyword] || 'GENERAL_CONCERN';
}
```

---

## 5. File Changes

### 5.1 New Files to Create

| File Path | Purpose |
|-----------|---------|
| `telephony/src/services/safety-classifier.ts` | Async classifier job queue and runner |
| `telephony/src/services/safety-verifier.ts` | OpenAI Moderation API verification |
| `telephony/src/services/safety-heuristics.ts` | Lightweight pattern-based heuristics |
| `telephony/src/services/safety-metrics.ts` | Prometheus metrics for safety system |
| `telephony/src/services/safety-keywords.ts` | Refactored keyword matching (extracted from grok-bridge.ts) |
| `telephony/src/services/safety-rubric.ts` | LLM classifier rubric prompt (single source of truth) |
| `telephony/src/__tests__/safety-keywords.test.ts` | Keyword unit tests |
| `telephony/src/__tests__/safety-heuristics.test.ts` | Heuristics unit tests |
| `telephony/src/__tests__/safety-verifier.test.ts` | Verifier unit tests |
| `supabase/migrations/YYYYMMDDHHMMSS_add_safety_verifier_fields.sql` | Database migration |

### 5.2 Files to Modify

| File Path | Changes |
|-----------|---------|
| `packages/prompts/src/safety/keywords.ts` | Expand to 10 languages with `SAFETY_KEYWORDS_BY_LANGUAGE` structure |
| `packages/prompts/src/safety/exclusions.ts` | Add `SAFETY_EXCLUSION_PATTERNS_EN` + `SAFETY_EXCLUSION_PATTERNS_ES` (keep combined export for backwards compatibility) |
| `packages/prompts/src/safety/index.ts` | Export new structures |
| `packages/types/src/safety.ts` | Add `SafetySignals` interface with new fields |
| `telephony/src/websocket/grok-bridge.ts` | Extract keyword logic, integrate async classifier triggers |
| `telephony/src/routes/tools/safety-event.ts` | Add verifier gate before SMS notification |
| `telephony/src/services/call-session.ts` | Update `recordSafetyEvent` to return inserted id; add helper to update signals for verifier outcome |
| `telephony/src/utils/env-validator.ts` | Validate new safety feature flags/models |
| `.env.ultaura.example` | Document new safety flags |

### 5.3 Detailed Changes for safety-event.ts

```typescript
// telephony/src/routes/tools/safety-event.ts - Key modifications

import { verifyHighTierEvent } from '../../services/safety-verifier.js';
import { incrementNotificationsBlocked, incrementNotificationsSent } from '../../services/safety-metrics.js';
import { getBuffer } from '../../services/ephemeral-buffer.js';
import { getGrokBridge } from '../../websocket/grok-bridge-registry.js';

// Inside the POST handler, modify the high-tier notification logic:

// Record the safety event once (existing behavior), but capture its id so we can update signals later.
// IMPORTANT: this requires updating recordSafetyEvent(...) to return the inserted row id.
const safetyEventId = await recordSafetyEvent({
  accountId,
  lineId,
  callSessionId,
  tier: effectiveTier,
  category,
  confidence: effectiveConfidence,
  signals: { source: sourceValue },
  actionTaken,
});

// For high-tier events, DO NOT block the tool response on external API calls.
// Run verifier + (maybe) SMS in the background, and update the existing safety event row.
if (effectiveTier === 'high') {
  logger.warn({ callSessionId, lineId, tier: effectiveTier, category, actionTaken }, 'HIGH SAFETY TIER EVENT');

  void (async () => {
    const buffer = getBuffer(callSessionId);
    const grokBridge = getGrokBridge(callSessionId);
    const languageCode = grokBridge?.getDetectedLanguage() ?? null;

    // Build a capped sliding window from the ephemeral buffer (no transcripts persisted).
    const turns = buffer?.turns ?? [];
    const contextWindowText = turns
      .slice(-12)
      .map((t) => `${t.speaker}: ${t.summary}`)
      .join('\n')
      .slice(0, 2000);

    const verifierResult = await verifyHighTierEvent(
      contextWindowText,
      (languageCode ?? 'unknown'),
      sourceValue
    );

    await updateSafetyEventSignals(safetyEventId, {
      verifier_result: verifierResult.decision,
      verifier_latency_ms: verifierResult.latencyMs,
      context_window_stats: {
        turns: turns.length,
        chars: turns.reduce((sum, t) => sum + t.summary.length, 0),
      },
    });

    // IMPORTANT: verifier is a hard gate for SMS. Fail-closed: clear/uncertain => do not notify.
    if (verifierResult.decision === 'confirm') {
      incrementNotificationsSent('sms', 'high');
      await notifyTrustedContacts(accountId, callSessionId, lineId, effectiveTier, actionTaken);
    } else {
      const blockReason = verifierResult.decision === 'clear' ? 'verifier_clear' : 'uncertain';
      incrementNotificationsBlocked(blockReason);
    }
  })().catch((error) => {
    // Verifier errors should block notification, not fail open.
    incrementNotificationsBlocked('uncertain');
    logger.error({ error, callSessionId, lineId }, 'Safety verifier background task failed');
  });
}
```

### 5.4 Detailed Changes for grok-bridge.ts

```typescript
// Key changes to telephony/src/websocket/grok-bridge.ts

// Add imports
import { scanForSafetyKeywords, getCategoryForKeyword } from '../services/safety-keywords.js';
import { detectHeuristics } from '../services/safety-heuristics.js';
import { enqueueClassifierJob, buildContextWindow, clearJobsForSession } from '../services/safety-classifier.js';
import { getBuffer } from '../services/ephemeral-buffer.js';

// Add periodic sweep timer property
private periodicSweepTimer: NodeJS.Timeout | null = null;
private lastSweepTime = 0;

// Replace scanForSafetyKeywords method with call to extracted module
private handleTranscriptSafety(transcript: string): void {
  // Use extracted keyword scanner
  const scanResult = scanForSafetyKeywords(
    transcript,
    this.detectedLanguage,
    this.safetyState.triggeredTiers
  );

  if (scanResult.matches.length > 0) {
    this.handleSafetyBackstop(scanResult.matches).catch((err) => {
      logger.error({ error: err }, 'Safety backstop handling failed');
    });
  }

  // Check heuristics (soft signal)
  const heuristicResult = detectHeuristics(transcript);
  if (heuristicResult.triggered && heuristicResult.totalConfidence >= 0.6) {
    this.enqueueClassifierForSoftSignal();
  }
}

private enqueueClassifierForSoftSignal(): void {
  const buffer = getBuffer(this.options.callSessionId);
  if (!buffer) return;

  const contextWindow = buildContextWindow(buffer.turns);

  enqueueClassifierJob(
    this.options.callSessionId,
    this.options.lineId,
    this.detectedLanguage ?? 'en',
    'soft_signal',
    contextWindow
  );
}

// Add periodic sweep logic
private startPeriodicSweeps(): void {
  const language = this.detectedLanguage; // may be null until report_conversation_language
  const isUndetected = !language;
  const isEnOrEs = language === 'en' || language === 'es';

  // Sweep for unknown/undetected (early-call gap) and for non-EN/ES.
  if (!isUndetected && isEnOrEs) return;

  const isSupported = language ? ['zh', 'tl', 'vi', 'fr', 'ar', 'ko', 'hi', 'ur'].includes(language) : false;
  const intervalMs = isUndetected ? 90_000 : (isSupported ? 120_000 : 60_000);

  this.periodicSweepTimer = setInterval(() => {
    this.runPeriodicSweep();
  }, intervalMs);
}

private stopPeriodicSweeps(): void {
  if (this.periodicSweepTimer) {
    clearInterval(this.periodicSweepTimer);
    this.periodicSweepTimer = null;
  }
}

private runPeriodicSweep(): void {
  const now = Date.now();
  if (now - this.lastSweepTime < 30_000) {
    return; // Debounce
  }

  this.lastSweepTime = now;

  const buffer = getBuffer(this.options.callSessionId);
  if (!buffer || buffer.turns.length < 3) {
    return;
  }

  const contextWindow = buildContextWindow(buffer.turns);

  enqueueClassifierJob(
    this.options.callSessionId,
    this.options.lineId,
    this.detectedLanguage ?? 'en',
    'periodic_sweep',
    contextWindow
  );
}

// Update close() method
close(): void {
  this.stopPeriodicSweeps();
  clearJobsForSession(this.options.callSessionId);

  if (this.ws) {
    this.suppressDisconnect = true;
    this.ws.close();
    this.ws = null;
  }
  this.isConnected = false;
}

// Update setDetectedLanguage to start sweeps when language changes
public setDetectedLanguage(code: string): void {
  const previousLanguage = this.detectedLanguage;
  this.detectedLanguage = code;

  // Start/restart periodic sweeps based on new language
  if (previousLanguage !== code) {
    this.stopPeriodicSweeps();
    this.startPeriodicSweeps();
  }
}
```

---

## 6. Database Changes

### 6.1 Migration: Add Safety Verifier Indexes/Documentation

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_safety_verifier_fields.sql

-- Extend ultaura_safety_events.signals JSONB to include new fields
-- Note: JSONB columns are schema-less, so no ALTER required for the column itself.
-- This migration adds documentation and indexes for querying verifier outcomes.

COMMENT ON COLUMN ultaura_safety_events.signals IS 'Extended signals including:
  - source: "model" | "keyword_backstop" | "sweep"
  - verifier_result: "confirm" | "clear" | "uncertain" (null if not verified)
  - verifier_latency_ms: number (null if not verified)
  - imminent_risk: boolean (null if not assessed)
  - has_plan_or_means: boolean (null if not assessed)
  - rationale_codes: string[] (empty if not assessed)
  - context_window_stats: { turns: number, chars: number } (null if not captured)
';

-- Add index for verifier disagreement queries
CREATE INDEX IF NOT EXISTS idx_ultaura_safety_events_verifier_result
ON ultaura_safety_events((signals->>'verifier_result'), created_at DESC)
WHERE signals->>'verifier_result' IS NOT NULL;

-- Add index for high-tier events needing analysis
CREATE INDEX IF NOT EXISTS idx_ultaura_safety_events_high_tier_unverified
ON ultaura_safety_events(created_at DESC)
WHERE tier = 'high' AND (signals->>'verifier_result') IS NULL;
```

### 6.2 Extended Signals Type Definition

```typescript
// packages/types/src/safety.ts - Add to existing file

export interface SafetySignals {
  source: 'model' | 'keyword_backstop' | 'sweep';
  verifier_result?: 'confirm' | 'clear' | 'uncertain';
  verifier_latency_ms?: number;
  imminent_risk?: boolean;
  has_plan_or_means?: boolean;
  rationale_codes?: string[];
  context_window_stats?: {
    turns: number;
    chars: number;
  };
}
```

---

## 7. Testing Strategy

### 7.1 Unit Tests for Keywords

```typescript
// telephony/src/__tests__/safety-keywords.test.ts

import { describe, it, expect } from 'vitest';
import { scanForSafetyKeywords, findKeywordMatch, isExcludedAtPosition } from '../services/safety-keywords.js';

describe('scanForSafetyKeywords', () => {
  describe('English keywords', () => {
    it('detects high-tier suicide keywords', () => {
      const result = scanForSafetyKeywords('I want to kill myself', 'en', new Set());
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].tier).toBe('high');
      expect(result.matches[0].matchedKeyword).toBe('kill myself');
    });

    it('applies exclusion patterns', () => {
      const result = scanForSafetyKeywords('I am killing time waiting', 'en', new Set());
      expect(result.matches).toHaveLength(0);
      expect(result.exclusionsApplied).toContain('killing time');
    });
  });

  describe('Spanish keywords', () => {
    it('detects high-tier Spanish keywords', () => {
      const result = scanForSafetyKeywords('quiero morir', 'es', new Set());
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].tier).toBe('high');
    });

    it('applies Spanish exclusion patterns', () => {
      const result = scanForSafetyKeywords('me muero de risa', 'es', new Set());
      expect(result.matches).toHaveLength(0);
      expect(result.exclusionsApplied).toContain('me muero de risa');
    });
  });

  describe('Chinese keywords', () => {
    it('detects high-tier Chinese keywords', () => {
      const result = scanForSafetyKeywords('我想自杀', 'zh', new Set());
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].tier).toBe('high');
    });
  });

  describe('Code-switching', () => {
    it('detects English keywords even when language is set to Spanish', () => {
      const result = scanForSafetyKeywords('I want to kill myself', 'es', new Set());
      expect(result.matches).toHaveLength(1);
    });
  });

  describe('Already triggered tiers', () => {
    it('skips already triggered tiers', () => {
      const result = scanForSafetyKeywords('I want to kill myself', 'en', new Set(['high']));
      expect(result.matches).toHaveLength(0);
    });
  });
});

describe('findKeywordMatch', () => {
  it('finds exact word boundaries', () => {
    expect(findKeywordMatch('I feel hopeless today', 'hopeless')).toEqual({ start: 7, end: 15 });
    expect(findKeywordMatch('hopelessly lost', 'hopeless')).toBeNull(); // Not word boundary
  });
});

describe('isExcludedAtPosition', () => {
  it('returns exclusion pattern when match overlaps', () => {
    const result = isExcludedAtPosition('killing time', 0, 7, ['killing time']);
    expect(result).toBe('killing time');
  });

  it('returns null when no exclusion matches', () => {
    const result = isExcludedAtPosition('kill myself', 0, 4, ['killing time']);
    expect(result).toBeNull();
  });
});
```

### 7.2 Unit Tests for Heuristics

```typescript
// telephony/src/__tests__/safety-heuristics.test.ts

import { describe, it, expect } from 'vitest';
import { detectHeuristics } from '../services/safety-heuristics.js';

describe('detectHeuristics', () => {
  it('detects "cant go on" patterns', () => {
    const result = detectHeuristics("I can't go on like this anymore");
    expect(result.triggered).toBe(true);
    expect(result.matches.some(m => m.category === 'cant_go_on')).toBe(true);
  });

  it('detects goodbye + permanence patterns', () => {
    const result = detectHeuristics('This is my final goodbye, you won\'t see me again');
    expect(result.triggered).toBe(true);
    expect(result.matches.some(m => m.category === 'goodbye_permanence')).toBe(true);
  });

  it('detects self-harm intent patterns', () => {
    const result = detectHeuristics('I am thinking about hurting myself');
    expect(result.triggered).toBe(true);
    expect(result.matches.some(m => m.category === 'self_harm_intent')).toBe(true);
  });

  it('requires multiple negation patterns for hopelessness', () => {
    const singleNegation = detectHeuristics('Nothing matters');
    expect(singleNegation.triggered).toBe(false);

    const multipleNegation = detectHeuristics('Nothing matters. It will never get better.');
    expect(multipleNegation.triggered).toBe(true);
  });

  it('returns false for normal conversation', () => {
    const result = detectHeuristics('I had a nice day today, went for a walk');
    expect(result.triggered).toBe(false);
    expect(result.matches).toHaveLength(0);
  });
});
```

### 7.3 Unit Tests for Verifier

```typescript
// telephony/src/__tests__/safety-verifier.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyHighTierEvent, runModerationCheck } from '../services/safety-verifier.js';

describe('verifyHighTierEvent', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns confirm when moderation flags self-harm', async () => {
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [{
          flagged: true,
          categories: { 'self-harm': true, 'self-harm/intent': true },
          category_scores: { 'self-harm': 0.9, 'self-harm/intent': 0.85 },
        }],
      }),
    });

    const result = await verifyHighTierEvent(
      'I want to kill myself',
      'Are you okay?',
      'en',
      'model'
    );

    expect(result.decision).toBe('confirm');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('returns clear when moderation does not flag', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [{
          flagged: false,
          categories: {},
          category_scores: { 'self-harm': 0.01 },
        }],
      }),
    });

    const result = await verifyHighTierEvent(
      'I feel a bit sad today',
      'Tell me more',
      'en',
      'keyword_backstop'
    );

    expect(result.decision).toBe('clear');
  });

  it('handles timeout gracefully', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      new Promise((_, reject) => setTimeout(() => reject(new Error('AbortError')), 2000))
    );

    const result = await runModerationCheck('test', 'en');
    expect(result.flagged).toBe(false);
  });
});
```

### 7.4 Integration Test for Safety Event Route

```typescript
// telephony/src/__tests__/safety-event.integration.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('POST /tools/safety_event', () => {
  it('blocks SMS notification when verifier clears high-tier event', async () => {
    // Mock verifier to return 'clear'
    vi.mock('../services/safety-verifier.js', () => ({
      verifyHighTierEvent: vi.fn().mockResolvedValue({
        decision: 'clear',
        confidence: 0.95,
        latencyMs: 150,
      }),
    }));

    // ... test implementation
  });

  it('sends SMS notification when verifier confirms high-tier event', async () => {
    // Mock verifier to return 'confirm'
    vi.mock('../services/safety-verifier.js', () => ({
      verifyHighTierEvent: vi.fn().mockResolvedValue({
        decision: 'confirm',
        confidence: 0.9,
        latencyMs: 200,
      }),
    }));

    // ... test implementation
  });
});
```

---

## 8. Edge Cases and Error Handling

### 8.1 API Failures

| Scenario | Handling |
|----------|----------|
| OpenAI Moderation API timeout (1s) | Fail fast, treat verifier as 'uncertain' for SMS gating, log warning |
| OpenAI Moderation API error | Fail fast, treat verifier as 'uncertain' for SMS gating, log error |
| LLM Classifier timeout (3s) | Retry once on network error only |
| LLM Classifier returns invalid JSON | Log error, return null result |
| OpenAI API key not configured | Log warning, block SMS notifications (fail-closed), keep on-call user guidance unaffected |

### 8.2 Job Queue Edge Cases

| Scenario | Handling |
|----------|----------|
| Queue full (50 jobs) | Drop oldest job, log warning |
| Same-reason job already pending | Deduplicate, return existing job ID |
| Pod restart mid-job | Jobs lost (ephemeral), acceptable |
| Call ends with pending jobs | Clear all jobs for session |

### 8.3 Language Detection Edge Cases

| Scenario | Handling |
|----------|----------|
| Language not yet detected | Start periodic sweeps; keyword scan uses EN/ES + script-based hints (Han/Hangul/Arabic/Devanagari) |
| Language changes mid-call | Restart periodic sweep timer with new interval |
| Code-switching detected | Always scan English + Spanish keywords regardless of detected language |
| Unsupported language | Use 60s sweep interval, rely on model + English fallback |

### 8.4 Verifier Decision Edge Cases

| Scenario | Handling |
|----------|----------|
| Verifier returns 'uncertain' | Hold notification, do NOT send SMS |
| Multiple independent high signals | If 2+ from different sources, consider second LLM pass |
| Verifier confirms but SMS rate-limited | Increment blocked counter with 'rate_limited' reason |
| No trusted contacts configured | Skip notification step, still log event |

---

## 9. Observability

### 9.1 Prometheus Metrics Summary

**Counters:**
- `ultaura_safety_classifier_runs_total{reason, result}`
- `ultaura_safety_classifier_triggers_total{source, tier}`
- `ultaura_safety_verifier_disagreements_total{source, initial_tier, verifier}`
- `ultaura_safety_notifications_blocked_total{reason}`
- `ultaura_safety_notifications_sent_total{channel, tier}`

**Histograms:**
- `ultaura_safety_classifier_latency_ms{reason}`
- `ultaura_safety_verifier_latency_ms`

### 9.2 Structured Logging

All safety-related logs include:
- `callSessionId`
- `lineId`
- `language_code`
- `trigger_reason`
- `context_window_stats` (turns, chars)
- `latency_ms`

**Never logged:**
- Raw transcript text
- Full conversation content
- PII or identifying information
- Any model output that might contain user text (e.g., raw JSON response on parse failures)

### 9.3 Database Event Storage

The `ultaura_safety_events.signals` JSONB column stores:
- Verifier decision and latency
- Context window statistics
- Rationale codes (not free text)
- Imminent risk and plan/means flags

---

## 10. Assumptions

### 10.1 Technical Assumptions

1. **OpenAI API availability**: The OpenAI Moderation API is expected to be highly available with <1% error rate
2. **Latency budgets**: 1s for moderation, 3s for classifier are acceptable for async processing
3. **Memory constraints**: 50-job queue and 3 concurrent jobs fit within pod memory limits
4. **Ephemeral job loss**: Acceptable that jobs are lost on pod restart (safety events still logged)

### 10.2 Business Assumptions

1. **Keyword coverage**: The provided multilingual keywords are clinically appropriate (should be reviewed by safety experts)
2. **Exclusion patterns**: Spanish exclusions reduce false positives significantly for common expressions
3. **Verifier threshold**: OpenAI Moderation API self-harm flags are reliable for gating SMS notifications
4. **Feature flag**: Operators will enable `ULTAURA_MULTILINGUAL_SAFETY_ENABLED` after validating in staging

### 10.3 Dependencies

1. **Environment variables**:
   - `ULTAURA_MULTILINGUAL_SAFETY_ENABLED` (global kill switch)
   - `ULTAURA_SAFETY_SWEEPS_ENABLED` (optional, default true when safety enabled)
   - `ULTAURA_SAFETY_CLASSIFIER_MODEL` (optional override)
2. **OpenAI API key**: `OPENAI_API_KEY` must be configured (already required for embeddings)
3. **Existing safety infrastructure**: Relies on existing `ultaura_safety_events` table and `notifyTrustedContacts` function

---

## 11. Critical Files Reference

These are the key files an implementing agent needs to understand:

| File | Purpose |
|------|---------|
| `packages/prompts/src/safety/keywords.ts` | Core file to modify: expand keywords to 10 languages |
| `packages/prompts/src/safety/exclusions.ts` | Add Spanish exclusion patterns |
| `packages/types/src/safety.ts` | Type definitions: add SafetySignals interface |
| `telephony/src/websocket/grok-bridge.ts` | Core integration: extract keyword scanning, add triggers |
| `telephony/src/routes/tools/safety-event.ts` | Critical: add verifier gate before SMS notification |
| `telephony/src/services/ephemeral-buffer.ts` | Reference for context window building |
| `telephony/src/services/safety-state.ts` | Safety state tracking per session |
| `telephony/src/utils/metrics.ts` | Existing Prometheus metrics pattern |

---

## 12. Implementation Order

Recommended implementation sequence:

1. **Phase 1: Foundation**
   - Create `safety-metrics.ts` (metrics infrastructure)
   - Create `safety-keywords.ts` (extract from grok-bridge.ts)
   - Add unit tests for keyword scanning

2. **Phase 2: Keyword Expansion**
   - Expand `keywords.ts` to 10 languages
   - Add Spanish exclusions to `exclusions.ts`
   - Update exports in `index.ts`
   - Add multilingual keyword tests

3. **Phase 3: Heuristics**
   - Create `safety-heuristics.ts`
   - Add heuristics unit tests
   - Integrate with grok-bridge.ts

4. **Phase 4: Verifier**
   - Create `safety-verifier.ts`
   - Add verifier unit tests
   - Integrate with safety-event.ts

5. **Phase 5: Classifier**
   - Create `safety-classifier.ts`
   - Add periodic sweep logic to grok-bridge.ts
   - Integration testing

6. **Phase 6: Database & Types**
   - Create migration for new indexes/comments
   - Update SafetySignals type
   - End-to-end testing

7. **Phase 7: Feature Flag & Rollout**
   - Add `ULTAURA_MULTILINGUAL_SAFETY_ENABLED` checks
   - Documentation updates
   - Staging validation
