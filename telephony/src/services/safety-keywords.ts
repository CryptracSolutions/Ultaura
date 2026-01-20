import type { SafetyCategory, SafetyMatch, SafetyTier } from '@ultaura/types';
import {
  SAFETY_EXCLUSION_PATTERNS_EN,
  SAFETY_EXCLUSION_PATTERNS_ES,
  SAFETY_KEYWORDS_BY_LANGUAGE,
  KEYWORD_CATEGORIES,
} from '@ultaura/prompts/safety';

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

  const baseFallbacks = ['en', 'es'];
  const scriptHints: string[] = [];

  if (!detectedLanguage) {
    if (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(transcript)) {
      scriptHints.push('zh');
    }
    if (/\p{Script=Hangul}/u.test(transcript)) {
      scriptHints.push('ko');
    }
    if (/\p{Script=Arabic}/u.test(transcript)) {
      scriptHints.push('ar', 'ur');
    }
    if (/\p{Script=Devanagari}/u.test(transcript)) {
      scriptHints.push('hi');
    }
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
        let keywordMatch = findKeywordMatch(text, keyword);

        while (keywordMatch) {
          const exclusionPatterns = langCode === 'es'
            ? [...SAFETY_EXCLUSION_PATTERNS_EN, ...SAFETY_EXCLUSION_PATTERNS_ES]
            : SAFETY_EXCLUSION_PATTERNS_EN;

          const exclusion = isExcludedAtPosition(
            text,
            keywordMatch.start,
            keywordMatch.end,
            exclusionPatterns
          );

          if (!exclusion) {
            matches.push({ tier, matchedKeyword: keyword });
            languageHint = langCode;
            matchedTier = true;
            break;
          }

          exclusionsApplied.push(exclusion);
          keywordMatch = findKeywordMatch(text, keyword, keywordMatch.end);
        }

        if (matchedTier) break;
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

  const isAsciiKeyword = /^[\x00-\x7F]+$/.test(normalizedKeyword);
  if (!isAsciiKeyword) {
    const idx = normalizedText.indexOf(normalizedKeyword, fromIndex);
    return idx === -1 ? null : { start: idx, end: idx + normalizedKeyword.length };
  }

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
  const normalizedText = text.toLowerCase();

  for (const pattern of exclusionPatterns) {
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
