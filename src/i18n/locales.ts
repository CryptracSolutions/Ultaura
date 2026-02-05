export const FALLBACK_LOCALE = 'en' as const;

const MIN_SUPPORTED_LOCALE_COUNT = 100;

const STATIC_LOCALE_SEED: string[] = [
  'af',
  'ak',
  'am',
  'ar',
  'as',
  'az',
  'be',
  'bg',
  'bm',
  'bn',
  'bo',
  'br',
  'bs',
  'ca',
  'ce',
  'cs',
  'cy',
  'da',
  'de',
  'dv',
  'dz',
  'ee',
  'el',
  'en',
  'eo',
  'es',
  'et',
  'eu',
  'fa',
  'ff',
  'fi',
  'fil',
  'fo',
  'fr',
  'fy',
  'ga',
  'gd',
  'gl',
  'gu',
  'ha',
  'he',
  'hi',
  'hr',
  'hu',
  'hy',
  'ia',
  'id',
  'ig',
  'ii',
  'is',
  'it',
  'ja',
  'jv',
  'ka',
  'ki',
  'kk',
  'kl',
  'km',
  'kn',
  'ko',
  'ks',
  'ku',
  'kw',
  'ky',
  'la',
  'lb',
  'lg',
  'ln',
  'lo',
  'lt',
  'lu',
  'lv',
  'mg',
  'mi',
  'mk',
  'ml',
  'mn',
  'mr',
  'ms',
  'mt',
  'my',
  'nb',
  'nd',
  'ne',
  'nl',
  'nn',
  'no',
  'om',
  'or',
  'os',
  'pa',
  'pl',
  'ps',
  'pt',
  'qu',
  'rm',
  'rn',
  'ro',
  'ru',
  'rw',
  'sa',
  'sd',
  'se',
  'sg',
  'si',
  'sk',
  'sl',
  'sn',
  'so',
  'sq',
  'sr',
  'su',
  'sv',
  'sw',
  'ta',
  'te',
  'tg',
  'th',
  'ti',
  'tk',
  'to',
  'tr',
  'tt',
  'ug',
  'uk',
  'ur',
  'uz',
  'vi',
  'vo',
  'wo',
  'xh',
  'yi',
  'yo',
  'zh',
  'zu',
];

type IntlWithSupportedValuesOf = typeof Intl & {
  supportedValuesOf?: (key: string) => string[];
};

function getCanonicalLocale(locale: string): string | null {
  try {
    const [canonical] = Intl.getCanonicalLocales(locale);

    return canonical ?? null;
  } catch {
    return null;
  }
}

function toCanonicalLocaleList(locales: readonly string[]): string[] {
  const canonicalLocales = new Set<string>();

  locales.forEach((locale) => {
    const canonicalLocale = getCanonicalLocale(locale);

    if (canonicalLocale) {
      canonicalLocales.add(canonicalLocale);
    }
  });

  return Array.from(canonicalLocales).sort((a, b) =>
    a.localeCompare(b, 'en', { sensitivity: 'base' }),
  );
}

function getIntlLanguageLocales(): string[] {
  const supportedValuesOf = (Intl as IntlWithSupportedValuesOf).supportedValuesOf;

  if (typeof supportedValuesOf !== 'function') {
    return [];
  }

  try {
    const locales = supportedValuesOf('language');

    if (!Array.isArray(locales)) {
      return [];
    }

    return locales.filter((locale): locale is string => typeof locale === 'string');
  } catch {
    return [];
  }
}

function buildSupportedLocales(): string[] {
  const dynamicLocales = getIntlLanguageLocales();

  const mergedLocales = toCanonicalLocaleList([
    ...dynamicLocales,
    ...STATIC_LOCALE_SEED,
    FALLBACK_LOCALE,
  ]);

  if (mergedLocales.length >= MIN_SUPPORTED_LOCALE_COUNT) {
    return mergedLocales;
  }

  return toCanonicalLocaleList([...STATIC_LOCALE_SEED, FALLBACK_LOCALE]);
}

export const SUPPORTED_I18N_LOCALES: string[] = buildSupportedLocales();

const SUPPORTED_I18N_LOCALE_SET = new Set<string>(SUPPORTED_I18N_LOCALES);

export function normalizeLocale(input: string): string | null {
  if (!input) {
    return null;
  }

  const normalizedInput = input.trim().replace(/_/g, '-');

  if (!normalizedInput) {
    return null;
  }

  const canonicalLocale = getCanonicalLocale(normalizedInput);

  if (!canonicalLocale) {
    return null;
  }

  if (SUPPORTED_I18N_LOCALE_SET.has(canonicalLocale)) {
    return canonicalLocale;
  }

  const languageCode = canonicalLocale.split('-')[0]?.toLowerCase();

  if (languageCode && SUPPORTED_I18N_LOCALE_SET.has(languageCode)) {
    return languageCode;
  }

  return null;
}

export function toLanguageCode(locale: string): string {
  const normalizedLocale = normalizeLocale(locale);

  if (normalizedLocale) {
    return normalizedLocale.split('-')[0]?.toLowerCase() ?? FALLBACK_LOCALE;
  }

  const canonicalLocale = getCanonicalLocale(locale.trim().replace(/_/g, '-'));

  if (!canonicalLocale) {
    return FALLBACK_LOCALE;
  }

  return canonicalLocale.split('-')[0]?.toLowerCase() ?? FALLBACK_LOCALE;
}
