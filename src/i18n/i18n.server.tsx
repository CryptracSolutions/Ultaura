import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next/initReactI18next';
import resourcesToBackend from 'i18next-resources-to-backend';

import getI18nSettings from './i18n.settings';
import { loadTranslationNamespace } from './translation-loader';

async function initializeServerI18n(lang?: Maybe<string>) {
  const i18nInstance = createInstance();
  const settings = getI18nSettings(lang);

  await i18nInstance
    .use(initReactI18next)
    .use(
      resourcesToBackend((language: string, namespace: string) =>
        loadTranslationNamespace(language, namespace),
      ),
    )
    .init(settings);

  return i18nInstance;
}

export default initializeServerI18n;
