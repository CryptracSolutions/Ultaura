import type { SafetyTier } from '@ultaura/types';

export const SAFETY_KEYWORDS: Record<SafetyTier, readonly string[]> = {
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
