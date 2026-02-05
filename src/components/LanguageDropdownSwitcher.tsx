'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectItem,
  SelectValue,
} from '~/core/ui/Select';

import useRefresh from '~/core/hooks/use-refresh';
import { setCookie } from '~/core/generic/cookies';

const LanguageDropdownSwitcher: React.FC<{
  onChange?: (locale: string) => unknown;
  triggerClassName?: string;
  contentClassName?: string;
  className?: string;
  ariaLabel?: string;
}> = ({
  onChange,
  triggerClassName,
  contentClassName,
  className,
  ariaLabel,
}) => {
  const { i18n } = useTranslation();
  const refresh = useRefresh();

  const { options } = i18n;

  const locales = (options.supportedLngs as string[]).filter(
    (locale) => locale.toLowerCase() !== 'cimode',
  );

  const languageNames = useMemo(() => {
    return new Intl.DisplayNames(['en'], {
      type: 'language',
    });
  }, []);

  const [value, setValue] = useState(i18n.language);

  useEffect(() => {
    setValue(i18n.language);
  }, [i18n.language]);

  const languageChanged = useCallback(
    async (locale: string) => {
      setValue(locale);

      if (onChange) {
        onChange(locale);
      }

      await i18n.changeLanguage(locale);
      setCookie('lang', locale, { path: '/', sameSite: 'lax' });
      await refresh();
    },
    [i18n, onChange, refresh],
  );

  return (
    <div className={className}>
      <Select value={value} onValueChange={languageChanged}>
        <SelectTrigger className={triggerClassName} aria-label={ariaLabel}>
          <SelectValue />
        </SelectTrigger>

        <SelectContent className={contentClassName}>
          {locales.map((locale) => {
            const label = capitalize(languageNames.of(locale) ?? locale);

            const option = {
              value: locale,
              label,
            };

            return (
              <SelectItem value={option.value} key={option.value}>
                {option.label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
};

function capitalize(lang: string) {
  return lang.slice(0, 1).toUpperCase() + lang.slice(1);
}

export default LanguageDropdownSwitcher;
