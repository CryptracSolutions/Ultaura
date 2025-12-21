'use client';

import { useEffect } from 'react';
import isBrowser from '~/core/generic/is-browser';
import { setTheme, SYSTEM_THEME_CLASSNAME } from '~/core/theming';

function ThemeSetter() {
  useEffect(() => {
    if (!isBrowser()) {
      return;
    }

    const mql = window.matchMedia('(prefers-color-scheme: dark)');

    const applySystemTheme = () => {
      setTheme(SYSTEM_THEME_CLASSNAME);
    };

    // Ensure the current OS theme is applied on mount.
    applySystemTheme();

    // Keep in sync when the OS theme changes.
    const handler = () => applySystemTheme();

    // Some browsers (notably older Safari) may expose addEventListener but not
    // implement it reliably for MediaQueryList. Subscribe using both APIs.
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
    }

    // Safari < 14
    // eslint-disable-next-line deprecation/deprecation
    if (typeof (mql as unknown as { addListener?: unknown }).addListener === 'function') {
      // eslint-disable-next-line deprecation/deprecation
      mql.addListener(handler);
    }

    return () => {
      if (typeof mql.removeEventListener === 'function') {
        mql.removeEventListener('change', handler);
      }

      // Safari < 14
      // eslint-disable-next-line deprecation/deprecation
      if (
        typeof (mql as unknown as { removeListener?: unknown }).removeListener === 'function'
      ) {
        // eslint-disable-next-line deprecation/deprecation
        mql.removeListener(handler);
      }
    };
  }, []);

  return null;
}

export default ThemeSetter;
