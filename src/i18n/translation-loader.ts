import { FALLBACK_LOCALE, normalizeLocale } from './locales';

type TranslationDictionary = Record<string, unknown>;

type TranslationModule = {
  default?: TranslationDictionary;
};

async function importTranslationNamespace(
  locale: string,
  namespace: string,
): Promise<TranslationDictionary> {
  const translationModule = (await import(
    `../../public/locales/${locale}/${namespace}.json`
  )) as TranslationModule;

  return translationModule.default ?? {};
}

export async function loadTranslationNamespace(
  language: string,
  namespace: string,
): Promise<TranslationDictionary> {
  const locale = normalizeLocale(language) ?? FALLBACK_LOCALE;

  try {
    return await importTranslationNamespace(locale, namespace);
  } catch {
    if (locale !== FALLBACK_LOCALE) {
      try {
        return await importTranslationNamespace(FALLBACK_LOCALE, namespace);
      } catch {
        return {};
      }
    }

    return {};
  }
}
