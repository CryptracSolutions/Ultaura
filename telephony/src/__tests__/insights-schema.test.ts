import { describe, it, expect } from 'vitest';
import { LogCallInsightsInputSchema } from '@ultaura/schemas/telephony';

const basePayload = {
  callSessionId: '11111111-1111-1111-1111-111111111111',
  lineId: '22222222-2222-2222-2222-222222222222',
  mood_overall: 'positive',
  mood_intensity: 2,
  engagement_score: 7,
  social_need_level: 1,
  topics: [
    { code: 'family', weight: 0.7 },
    { code: 'daily_life', weight: 0.3 },
  ],
  private_topics: [],
  concerns: [
    { code: 'loneliness', severity: 2, confidence: 0.8 },
  ],
  needs_follow_up: true,
  follow_up_reasons: ['loneliness'],
  confidence_overall: 0.8,
};

describe('LogCallInsightsInputSchema', () => {
  it('accepts valid payload', () => {
    const result = LogCallInsightsInputSchema.safeParse(basePayload);
    expect(result.success).toBe(true);
  });

  it('rejects invalid follow_up_reasons', () => {
    const result = LogCallInsightsInputSchema.safeParse({
      ...basePayload,
      follow_up_reasons: ['invalid_reason'],
    });

    expect(result.success).toBe(false);
  });
});
