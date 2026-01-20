import { describe, it, expect } from 'vitest';
import {
  scanForSafetyKeywords,
  findKeywordMatch,
  isExcludedAtPosition,
} from '../services/safety-keywords.js';

describe('scanForSafetyKeywords', () => {
  describe('English keywords', () => {
    it('detects high-tier suicide keywords', () => {
      const result = scanForSafetyKeywords('I want to kill myself', 'en', new Set());
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].tier).toBe('high');
      expect(result.matches[0].matchedKeyword).toBe('kill myself');
    });

    it('applies exclusion patterns', () => {
      const result = scanForSafetyKeywords('I want to die for that cake', 'en', new Set());
      expect(result.matches).toHaveLength(0);
      expect(result.exclusionsApplied).toContain('to die for');
    });
  });

  describe('Spanish keywords', () => {
    it('detects high-tier Spanish keywords', () => {
      const result = scanForSafetyKeywords('quiero morir', 'es', new Set());
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].tier).toBe('high');
    });

    it('applies Spanish exclusion patterns', () => {
      const result = scanForSafetyKeywords('quiero morir de risa', 'es', new Set());
      expect(result.matches).toHaveLength(0);
      expect(result.exclusionsApplied).toContain('morir de risa');
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
    expect(findKeywordMatch('hopelessly lost', 'hopeless')).toBeNull();
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
