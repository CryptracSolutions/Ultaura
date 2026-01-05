export const SAFETY_KEYWORDS = {
  high: [
    // English
    'suicide',
    'kill myself',
    'end my life',
    'end it all',
    'want to die',
    'want to kill me',
    'going to kill me',
    'better off dead',
    'hurt myself',
    'harm myself',
    'self-harm',
    'self harm',
    'cut myself',
    "don't want to live",
    'no reason to live',
    'take my own life',
    // Spanish
    'suicidio',
    'matarme',
    'quiero morir',
    'acabar con todo',
  ],
  medium: [
    // English
    'hopeless',
    'give up',
    'giving up',
    'not worth living',
    "what's the point",
    'no point in living',
    "can't go on",
    "can't take it anymore",
    "wish i wasn't here",
    'disappear',
    'nobody would miss me',
    'burden to everyone',
    // Spanish
    'sin esperanza',
    'no vale la pena',
    'rendirme',
  ],
  low: [
    // English
    'so lonely',
    'all alone',
    'nobody cares',
    "don't care anymore",
    'tired of everything',
    'exhausted with life',
    'nothing matters',
    // Spanish
    'muy solo',
    'muy sola',
    'nadie me quiere',
  ],
} as const;

export const SAFETY_EXCLUSION_PATTERNS = [
  // Common false positives (match as phrases)
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

export type SafetyTier = 'low' | 'medium' | 'high';

export interface SafetyMatch {
  tier: SafetyTier;
  matchedKeyword: string;
}
