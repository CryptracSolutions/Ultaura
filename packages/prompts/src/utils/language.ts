export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  ru: 'Russian',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  hi: 'Hindi',
  tr: 'Turkish',
  pl: 'Polish',
  sv: 'Swedish',
  da: 'Danish',
  no: 'Norwegian',
  fi: 'Finnish',
  cs: 'Czech',
  th: 'Thai',
  vi: 'Vietnamese',
  id: 'Indonesian',
  ms: 'Malay',
  tl: 'Filipino',
  uk: 'Ukrainian',
  el: 'Greek',
  he: 'Hebrew',
  ro: 'Romanian',
  hu: 'Hungarian',
};

export function normalizeLanguageCode(code: string): string {
  return code.split('-')[0].toLowerCase();
}

export function getLanguageName(code: string): string {
  const baseCode = normalizeLanguageCode(code);
  return LANGUAGE_NAMES[baseCode] ?? code.toUpperCase();
}
