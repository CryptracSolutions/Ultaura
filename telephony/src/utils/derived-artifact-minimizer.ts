export type DerivedTextMode = 'sentence' | 'label';

const MAX_DERIVED_TEXT_CHARS = 200;

function collapseWhitespace(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function stripSpeakerLabels(value: string): string {
  return value
    .replace(/\b(system|assistant|user)\s*:\s*/gi, '')
    .replace(/\[(system|assistant|user)\]\s*/gi, '');
}

function stripQuotes(value: string): string {
  return value.replace(/["“”]/g, '');
}

function takeFirstSentence(value: string): string {
  // Deterministic, conservative: split on punctuation followed by whitespace.
  const match = value.match(/[.!?]\s+/);
  if (!match || match.index === undefined) {
    return value;
  }
  const endIndex = Math.min(value.length, match.index + 1);
  return value.slice(0, endIndex);
}

export function minimizeDerivedText(input: string, mode: DerivedTextMode): string {
  const normalized = collapseWhitespace(stripQuotes(stripSpeakerLabels(String(input ?? ''))));
  const sentence = mode === 'sentence' ? takeFirstSentence(normalized) : normalized;
  return collapseWhitespace(sentence).slice(0, MAX_DERIVED_TEXT_CHARS);
}

export function minimizeDerivedOptionalText(
  input: string | null | undefined,
  mode: DerivedTextMode
): string | null {
  if (input == null) return null;
  const minimized = minimizeDerivedText(input, mode);
  return minimized.length > 0 ? minimized : null;
}

export function minimizeDerivedObjectDeep<T>(
  value: T,
  options?: {
    defaultMode?: DerivedTextMode;
    labelKeyRegex?: RegExp;
    sentenceKeyRegex?: RegExp;
  }
): T {
  const defaultMode = options?.defaultMode ?? 'sentence';
  const labelKeyRegex =
    options?.labelKeyRegex ??
    /\b(name|title|nickname|location|topic|key|role|category|type)\b/i;
  const sentenceKeyRegex =
    options?.sentenceKeyRegex ??
    /\b(summary|narrative|description|context|note|prompt)\b/i;

  const seen = new WeakMap<object, unknown>();

  const pickMode = (key: string): DerivedTextMode => {
    if (sentenceKeyRegex.test(key)) return 'sentence';
    if (labelKeyRegex.test(key)) return 'label';
    return defaultMode;
  };

  const walk = (current: unknown, keyHint?: string): unknown => {
    if (typeof current === 'string') {
      return minimizeDerivedText(current, keyHint ? pickMode(keyHint) : defaultMode);
    }
    if (current == null || typeof current !== 'object') {
      return current;
    }
    if (Array.isArray(current)) {
      return current.map((entry) => walk(entry));
    }

    const obj = current as Record<string, unknown>;
    const existing = seen.get(obj);
    if (existing) return existing;

    const result: Record<string, unknown> = {};
    seen.set(obj, result);

    for (const [key, entry] of Object.entries(obj)) {
      result[key] = walk(entry, key);
    }
    return result;
  };

  return walk(value) as T;
}
