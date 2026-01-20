export const SAFETY_EXCLUSION_PATTERNS_EN = [
  // Common English false positives
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
  // Non-safety "hurt" contexts
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

export const SAFETY_EXCLUSION_PATTERNS_ES = [
  // Narrow, idiom-focused exclusions to reduce obvious false positives.
  // Avoid excluding ambiguous threat phrases like "me mata" / "me vas a matar"
  // because they can also be literal (PHYSICAL_DANGER).
  'me muero de risa',
  'me muero de hambre',
  'me muero de sed',
  'me muero de frío',
  'me muero de calor',
  'me muero de sueño',
  'me muero de vergüenza',
  'morir de risa',
  'matando el tiempo',
] as const;

export const SAFETY_EXCLUSION_PATTERNS = [
  ...SAFETY_EXCLUSION_PATTERNS_EN,
  ...SAFETY_EXCLUSION_PATTERNS_ES,
] as const;
