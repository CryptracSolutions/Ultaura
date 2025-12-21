'use client';

import { Inter as SansFont, JetBrains_Mono as MonoFont } from 'next/font/google';
import { useServerInsertedHTML } from 'next/navigation';

const sans = SansFont({
  subsets: ['latin'],
  variable: '--font-family-sans',
  fallback: ['ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
  preload: true,
  weight: ['300', '400', '500', '600', '700', '800'],
});

const mono = MonoFont({
  subsets: ['latin'],
  variable: '--font-family-mono',
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
  preload: true,
  weight: ['400', '500', '600', '700'],
});

// Use the sans font for headings by default
const heading = sans;

function Fonts() {
  useServerInsertedHTML(() => {
    return (
      <style
        key={'fonts'}
        dangerouslySetInnerHTML={{
          __html: `
          :root {
            --font-family-sans: 'Inter', ${sans.style.fontFamily}, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
            --font-family-heading: 'Inter', ${heading.style.fontFamily}, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
            --font-family-mono: 'JetBrains Mono', ${mono.style.fontFamily}, ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
          }
        `,
        }}
      />
    );
  });

  return null;
}

export default Fonts;
