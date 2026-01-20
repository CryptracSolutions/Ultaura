import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runModerationCheck, verifyHighTierEvent } from '../services/safety-verifier.js';

const originalFetch = global.fetch;

describe('verifyHighTierEvent', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('returns confirm when moderation flags self-harm', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [{
          flagged: true,
          categories: { 'self-harm': true, 'self-harm/intent': true },
          category_scores: { 'self-harm': 0.9, 'self-harm/intent': 0.85 },
        }],
      }),
    }) as any;

    const result = await verifyHighTierEvent({
      callSessionId: 'session-confirm',
      contextWindowText: 'I want to kill myself',
      languageCode: 'en',
      category: 'SUICIDAL_IDEATION',
      source: 'model',
    });

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
    }) as any;

    const result = await verifyHighTierEvent({
      callSessionId: 'session-clear',
      contextWindowText: 'I feel a bit sad today',
      languageCode: 'en',
      category: 'SUICIDAL_IDEATION',
      source: 'model',
    });

    expect(result.decision).toBe('clear');
  });

  it('returns uncertain for physical danger when moderation is unflagged', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [{
          flagged: false,
          categories: {},
          category_scores: {},
        }],
      }),
    }) as any;

    const result = await verifyHighTierEvent({
      callSessionId: 'session-physical-danger',
      contextWindowText: 'Someone is breaking in',
      languageCode: 'en',
      category: 'PHYSICAL_DANGER',
      source: 'model',
    });

    expect(result.decision).toBe('uncertain');
  });

  it('confirms physical danger when moderation flags violence', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [{
          flagged: true,
          categories: { violence: true },
          category_scores: { violence: 0.77 },
        }],
      }),
    }) as any;

    const result = await verifyHighTierEvent({
      callSessionId: 'session-physical-danger-flagged',
      contextWindowText: 'Someone is attacking me',
      languageCode: 'en',
      category: 'PHYSICAL_DANGER',
      source: 'model',
    });

    expect(result.decision).toBe('confirm');
  });

  it('confirms medical emergency when LLM verifier matches category', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          results: [{
            flagged: false,
            categories: {},
            category_scores: {},
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({
                category: 'MEDICAL_EMERGENCY',
                tier: null,
                confidence: 0.82,
                actionTaken: 'suggested_911',
                signals: {
                  imminent_risk: true,
                  has_plan_or_means: false,
                  rationale_codes: ['timeframe_immediate'],
                },
              }),
            },
          }],
        }),
      }) as any;

    const result = await verifyHighTierEvent({
      callSessionId: 'session-medical',
      contextWindowText: 'I fell and hit my head badly',
      languageCode: 'en',
      category: 'MEDICAL_EMERGENCY',
      source: 'model',
    });

    expect(result.decision).toBe('confirm');
  });
});

describe('runModerationCheck', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('handles timeout gracefully', async () => {
    const abortError = new Error('AbortError');
    abortError.name = 'AbortError';
    global.fetch = vi.fn().mockRejectedValue(abortError) as any;

    const result = await runModerationCheck('test', 'en', 10);
    expect(result.flagged).toBe(false);
  });
});
