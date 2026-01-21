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
  const base = code.split('-')[0].toLowerCase();

  const aliases: Record<string, string> = {
    // Common BCP-47 / provider variants
    cmn: 'zh',
    zho: 'zh',
    fil: 'tl',
    tgl: 'tl',
    nb: 'no',
    nob: 'no',
    nno: 'no',

    // Legacy BCP-47 codes
    iw: 'he',
    in: 'id',
  };

  return aliases[base] ?? base;
}

export function getLanguageName(code: string): string {
  const baseCode = normalizeLanguageCode(code);
  return LANGUAGE_NAMES[baseCode] ?? code.toUpperCase();
}
