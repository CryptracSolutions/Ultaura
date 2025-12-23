import './globals.css';

import { cookies } from 'next/headers';

import initializeServerI18n from '~/i18n/i18n.server';
import { I18N_COOKIE_NAME } from '~/i18n/i18n.settings';

import ThemeSetter from '~/components/ThemeSetter';
import Fonts from '~/components/Fonts';

import configuration from '~/configuration';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const i18n = await initializeServerI18n(getLanguageCookie());
  const lightThemeColor = configuration.site.themeColor;
  const darkThemeColor = configuration.site.themeColorDark;

  return (
    <html lang={i18n.language} suppressHydrationWarning>
      <head>
        <script
          // Pre-paint system theme: avoids a flash since the server can't know the OS theme.
          dangerouslySetInnerHTML={{
            __html: `
            (function () {
              try {
                var mql = window.matchMedia('(prefers-color-scheme: dark)');
                var root = document.documentElement;

                function setThemeFromMql() {
                  var isDark = !!(mql && mql.matches);

                  if (isDark) {
                    root.classList.add('dark');
                  } else {
                    root.classList.remove('dark');
                  }

                  var color = isDark ? '${darkThemeColor}' : '${lightThemeColor}';
                  var tag = document.querySelector("meta[name='theme-color']");

                  if (!tag) {
                    tag = document.createElement('meta');
                    tag.setAttribute('name', 'theme-color');
                    document.head.appendChild(tag);
                  }

                  tag.setAttribute('content', color);
                }

                // Initial, pre-paint set.
                setThemeFromMql();

                // Keep in sync even before React hydrates.
                var handler = function () { setThemeFromMql(); };

                if (mql && typeof mql.addEventListener === 'function') {
                  mql.addEventListener('change', handler);
                }

                // Safari < 14
                if (mql && typeof mql.addListener === 'function') {
                  mql.addListener(handler);
                }
              } catch (e) {}
            })();
          `,
          }}
        />
      </head>

      <body>
        <Fonts />
        <ThemeSetter />
        {children}
      </body>
    </html>
  );
}

function getLanguageCookie() {
  return cookies().get(I18N_COOKIE_NAME)?.value;
}

export const metadata = {
  title: configuration.site.name,
  description: configuration.site.description,
  metadataBase: new URL(configuration.site.siteUrl!),
  openGraph: {
    url: configuration.site.siteUrl,
    siteName: configuration.site.siteName,
    description: configuration.site.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: configuration.site.name,
    description: configuration.site.description,
    creator: configuration.site.twitterHandle,
  },
  manifest: '/manifest.json',
};
