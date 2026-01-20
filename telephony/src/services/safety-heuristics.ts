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
  {
    pattern: /\b(no\s+point|nothing\s+matters?|doesn'?t\s+matter|never\s+get\s+better|always\s+(be\s+)?this\s+way)\b/gi,
    category: 'negation_hopelessness',
    confidence: 0.6,
    minMatches: 2,
  },
  {
    pattern: /\b(goodbye|farewell|adios|final\s+goodbye|last\s+time|won'?t\s+see\s+you|before\s+i\s+go)\b.*\b(forever|final|last|end|never\s+again)\b/gi,
    category: 'goodbye_permanence',
    confidence: 0.7,
  },
  {
    pattern: /\b(can'?t\s+(go\s+on|take\s+(it\s+)?any\s*more|do\s+this\s+anymore|keep\s+(going|living))|too\s+much\s+to\s+bear|unbearable)\b/gi,
    category: 'cant_go_on',
    confidence: 0.65,
  },
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
      const firstMatch = patternMatches[0];
      if (!firstMatch) {
        continue;
      }
      matches.push({
        pattern: firstMatch,
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
