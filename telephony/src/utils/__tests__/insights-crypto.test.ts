import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import type { CallInsights } from '@ultaura/types';
import {
  buildInsightsAAD,
  decryptInsightsWithDek,
  encryptInsightsWithDek,
} from '../insights-crypto.js';

const sampleInsights: CallInsights = {
  mood_overall: 'positive',
  mood_intensity: 2,
  engagement_score: 7,
  social_need_level: 1,
  topics: [
    { code: 'family', weight: 0.6 },
    { code: 'memories', weight: 0.4 },
  ],
  private_topics: ['requests'],
  concerns: [
    { code: 'loneliness', severity: 2, confidence: 0.7, is_novel: true },
  ],
  needs_follow_up: true,
  follow_up_reasons: ['loneliness', 'wants_more_contact'],
  confidence_overall: 0.8,
};

describe('insights-crypto', () => {
  it('encrypts and decrypts insights with AAD', () => {
    const dek = crypto.randomBytes(32);
    const aad = buildInsightsAAD('acct-1', 'line-1', 'session-1');

    const encrypted = encryptInsightsWithDek(dek, sampleInsights, aad);
    const decrypted = decryptInsightsWithDek(dek, encrypted, aad);

    expect(decrypted).toEqual(sampleInsights);
  });

  it('fails decryption with different AAD', () => {
    const dek = crypto.randomBytes(32);
    const aad = buildInsightsAAD('acct-1', 'line-1', 'session-1');
    const wrongAad = buildInsightsAAD('acct-1', 'line-1', 'session-2');

    const encrypted = encryptInsightsWithDek(dek, sampleInsights, aad);

    expect(() => decryptInsightsWithDek(dek, encrypted, wrongAad)).toThrow();
  });
});
