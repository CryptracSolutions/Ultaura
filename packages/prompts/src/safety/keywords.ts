import type { SafetyCategory, SafetyTier } from '@ultaura/types';

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

export const KEYWORD_CATEGORIES: Record<string, SafetyCategory> = {
  // HIGH - SUICIDAL_IDEATION
  'suicide': 'SUICIDAL_IDEATION',
  'kill myself': 'SUICIDAL_IDEATION',
  'end my life': 'SUICIDAL_IDEATION',
  'end it all': 'SUICIDAL_IDEATION',
  'want to die': 'SUICIDAL_IDEATION',
  'better off dead': 'SUICIDAL_IDEATION',
  "don't want to live": 'SUICIDAL_IDEATION',
  'no reason to live': 'SUICIDAL_IDEATION',
  'take my own life': 'SUICIDAL_IDEATION',
  'suicidio': 'SUICIDAL_IDEATION',
  'matarme': 'SUICIDAL_IDEATION',
  'quiero morir': 'SUICIDAL_IDEATION',
  'acabar con todo': 'SUICIDAL_IDEATION',

  // HIGH - PHYSICAL_DANGER
  'want to kill me': 'PHYSICAL_DANGER',
  'going to kill me': 'PHYSICAL_DANGER',

  // HIGH - SELF_HARM
  'hurt myself': 'SELF_HARM',
  'harm myself': 'SELF_HARM',
  'self-harm': 'SELF_HARM',
  'self harm': 'SELF_HARM',
  'cut myself': 'SELF_HARM',

  // MEDIUM - HOPELESSNESS
  'hopeless': 'HOPELESSNESS',
  'give up': 'HOPELESSNESS',
  'giving up': 'HOPELESSNESS',
  'not worth living': 'HOPELESSNESS',
  "what's the point": 'HOPELESSNESS',
  'no point in living': 'HOPELESSNESS',
  "can't go on": 'HOPELESSNESS',
  "can't take it anymore": 'HOPELESSNESS',
  "wish i wasn't here": 'HOPELESSNESS',
  'disappear': 'HOPELESSNESS',
  'nobody would miss me': 'HOPELESSNESS',
  'burden to everyone': 'HOPELESSNESS',
  'sin esperanza': 'HOPELESSNESS',
  'no vale la pena': 'HOPELESSNESS',
  'rendirme': 'HOPELESSNESS',

  // LOW - ISOLATION_DISTRESS
  'so lonely': 'ISOLATION_DISTRESS',
  'all alone': 'ISOLATION_DISTRESS',
  'nobody cares': 'ISOLATION_DISTRESS',
  "don't care anymore": 'ISOLATION_DISTRESS',
  'tired of everything': 'ISOLATION_DISTRESS',
  'exhausted with life': 'ISOLATION_DISTRESS',
  'nothing matters': 'ISOLATION_DISTRESS',
  'muy solo': 'ISOLATION_DISTRESS',
  'muy sola': 'ISOLATION_DISTRESS',
  'nadie me quiere': 'ISOLATION_DISTRESS',
};
