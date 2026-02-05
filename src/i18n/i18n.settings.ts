import configuration from '~/configuration';
import { InitOptions } from 'i18next';
import {
  FALLBACK_LOCALE,
  SUPPORTED_I18N_LOCALES,
  normalizeLocale,
} from './locales';

const configuredLocale = normalizeLocale(configuration.site.locale ?? '');
const defaultLocale = configuredLocale ?? FALLBACK_LOCALE;

export const I18N_COOKIE_NAME = 'lang';

/**
 * The default array of Internationalization (i18n) namespaces.
 * These namespaces are commonly used in the application for translation purposes.
 *
 * Add your own namespaces here
 **/
export const defaultI18nNamespaces = [
  'common',
  'auth',
  'organization',
  'profile',
  'subscription',
  'onboarding',
  'voices',
];

function getI18nSettings(
  language: Maybe<string>,
  ns: string | string[] = defaultI18nNamespaces,
): InitOptions {
  const lng = normalizeLocale(language ?? '') ?? defaultLocale;

  return {
    supportedLngs: SUPPORTED_I18N_LOCALES,
    fallbackLng: FALLBACK_LOCALE,
    lng,
    fallbackNS: defaultI18nNamespaces,
    defaultNS: defaultI18nNamespaces,
    ns,
  };
}

export default getI18nSettings;
