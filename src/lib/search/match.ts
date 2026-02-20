export const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'how',
  'i',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
  'you',
  'your',
]);

const SYNONYM_MAP: Record<string, string[]> = {
  add: ['create', 'new'],
  create: ['add', 'new'],
  new: ['add', 'create'],
  remind: ['reminder', 'remind'],
  reminder: ['remind', 'task', 'todo'],
  reminderz: ['reminder'],
  remnder: ['reminder'],
  schedule: ['checkin', 'call', 'check-in'],
  checkin: ['schedule', 'check-in', 'call'],
  'check-in': ['checkin', 'schedule', 'call'],
  check: ['checkin', 'check-in', 'schedule'],
  call: ['phone', 'dial'],
  phone: ['call', 'dial'],
  dial: ['call', 'phone'],
  calling: ['call', 'phone'],
  voicemail: ['call', 'phone'],
  safety: ['alert', 'concern', 'wellness'],
  safty: ['safety', 'alert', 'concern'],
  alert: ['safety', 'warning', 'concern'],
  concern: ['worry', 'worried', 'alert'],
  worried: ['concern', 'alert'],
  worry: ['concern', 'alert'],
  medium: ['medum'],
  medum: ['medium'],
  urgent: ['danger', 'critical', 'alert'],
  danger: ['urgent', 'alert', 'safety'],
  contact: ['person', 'phone'],
  contacts: ['contact', 'people', 'person'],
  person: ['contact', 'people'],
  people: ['person', 'contacts'],
  line: ['member', 'person'],
  lines: ['line', 'members'],
  member: ['line', 'person'],
  help: ['support', 'guide'],
  support: ['help'],
};

export function normalizeText(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeText(text: string, options?: { minLength?: number; maxTokens?: number }): string[] {
  const minLength = options?.minLength ?? 2;
  const maxTokens = options?.maxTokens ?? 24;
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const tokens = normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= minLength && !STOP_WORDS.has(token));

  const unique = Array.from(new Set(tokens));
  return unique.slice(0, maxTokens);
}

export function expandTokens(tokens: string[]): string[] {
  const expanded = new Set(tokens);
  tokens.forEach((token) => {
    const synonyms = SYNONYM_MAP[token];
    if (synonyms) {
      synonyms.forEach((synonym) => expanded.add(synonym));
    }
  });
  return Array.from(expanded);
}

export function buildShingles(tokens: string[]): string[] {
  if (tokens.length < 2) return [];
  const shingles: string[] = [];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    shingles.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return shingles;
}

export function scoreMatch(query: string, candidateText: string): number {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return 0;

  const queryTokens = expandTokens(tokenizeText(normalizedQuery));
  const candidateNormalized = normalizeText(candidateText);
  const candidateTokens = tokenizeText(candidateNormalized);

  let score = 0;

  if (candidateNormalized.includes(normalizedQuery)) {
    score += 8;
  }

  const candidateTokenSet = new Set(candidateTokens);
  const shingles = new Set(buildShingles(candidateTokens));

  queryTokens.forEach((token) => {
    if (candidateTokenSet.has(token)) {
      score += 3;
      return;
    }

    if (token.length >= 3 && candidateTokens.some((entry) => entry.startsWith(token))) {
      score += 1.5;
      return;
    }

    if (
      token.length >= 4
      && candidateTokens.some((entry) => levenshtein(token, entry) <= typoDistanceAllowance(token))
    ) {
      score += 1;
    }
  });

  const queryShingles = buildShingles(queryTokens);
  queryShingles.forEach((shingle) => {
    if (shingles.has(shingle)) {
      score += 2.5;
    }
  });

  return score;
}

export function getMatchConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score >= 12) return 'high';
  if (score >= 6) return 'medium';
  return 'low';
}

export function highlightText(text: string, tokens: string[]): Array<{ text: string; match: boolean }> {
  const usableTokens = tokens
    .filter((token) => token.length > 1)
    .map((token) => escapeRegExp(token));

  if (usableTokens.length === 0) {
    return [{ text, match: false }];
  }

  const pattern = new RegExp(`(${usableTokens.join('|')})`, 'gi');
  const matchPattern = new RegExp(`^(${usableTokens.join('|')})$`, 'i');
  const parts = text.split(pattern);
  return parts.filter(Boolean).map((part) => ({
    text: part,
    match: matchPattern.test(part),
  }));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function typoDistanceAllowance(token: string): number {
  if (token.length >= 8) {
    return 2;
  }

  return 1;
}
