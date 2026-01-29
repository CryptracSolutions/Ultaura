import { createElement } from 'react';
import { PhoneIcon } from '@heroicons/react/24/outline';

import type { NavigationSearchItem } from '~/lib/search/navigation-registry';
import type { SearchItem } from '~/lib/search/types';

export type LinePageDefinition = {
  key: string;
  label: string;
  pathSuffix: string;
  keywords: string[];
};

const LINE_NAV_ICON = (props: { className: string }) =>
  createElement(PhoneIcon, props) as JSX.Element;

const LINE_PAGES: LinePageDefinition[] = [
  {
    key: 'overview',
    label: 'Overview',
    pathSuffix: '',
    keywords: ['overview', 'summary', 'line'],
  },
  {
    key: 'settings',
    label: 'Settings',
    pathSuffix: '/settings',
    keywords: ['settings', 'preferences', 'profile', 'line settings'],
  },
  {
    key: 'call-controls',
    label: 'Call Controls',
    pathSuffix: '/settings?tab=call-controls',
    keywords: ['call controls', 'call control', 'call settings', 'amd', 'voicemail'],
  },
  {
    key: 'topics',
    label: 'Topics',
    pathSuffix: '/topics',
    keywords: ['topics', 'conversation topics', 'avoid topics'],
  },
  {
    key: 'milestones',
    label: 'Milestones',
    pathSuffix: '/milestones',
    keywords: ['milestones', 'birthdays', 'anniversaries', 'memorials'],
  },
  {
    key: 'contacts',
    label: 'Contacts',
    pathSuffix: '/contacts',
    keywords: ['contacts', 'trusted contacts', 'emergency contact'],
  },
];

export function buildLineNavigationItems(lines: SearchItem[]): NavigationSearchItem[] {
  return lines.flatMap((line) => {
    return LINE_PAGES.map((page) => {
      const href = `${line.href}${page.pathSuffix}`;
      const keywords = [
        page.label,
        ...page.keywords,
        line.label,
        line.subtitle ?? '',
      ].filter(Boolean);

      return {
        id: `line-${line.id}-${page.key}`,
        label: `${page.label} · ${line.label}`,
        href,
        keywords,
        Icon: LINE_NAV_ICON,
      };
    });
  });
}
