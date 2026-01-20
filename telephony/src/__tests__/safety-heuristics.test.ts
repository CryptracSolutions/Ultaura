import { describe, it, expect } from 'vitest';
import { detectHeuristics } from '../services/safety-heuristics.js';

describe('detectHeuristics', () => {
  it('detects "cant go on" patterns', () => {
    const result = detectHeuristics("I can't go on like this anymore");
    expect(result.triggered).toBe(true);
    expect(result.matches.some((m) => m.category === 'cant_go_on')).toBe(true);
  });

  it('detects goodbye + permanence patterns', () => {
    const result = detectHeuristics('This is my final goodbye, you won\'t see me again forever');
    expect(result.triggered).toBe(true);
    expect(result.matches.some((m) => m.category === 'goodbye_permanence')).toBe(true);
  });

  it('detects self-harm intent patterns', () => {
    const result = detectHeuristics('I am thinking about hurting myself');
    expect(result.triggered).toBe(true);
    expect(result.matches.some((m) => m.category === 'self_harm_intent')).toBe(true);
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
