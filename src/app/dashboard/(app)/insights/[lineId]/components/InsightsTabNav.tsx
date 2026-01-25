'use client';

import { usePathname } from 'next/navigation';
import NavigationMenu from '~/core/ui/Navigation/NavigationMenu';
import NavigationItem from '~/core/ui/Navigation/NavigationItem';

interface InsightsTabNavProps {
  lineShortId: string;
}

const INSIGHTS_TABS = [
  { key: 'overview', label: 'Overview', pathSuffix: '' },
  { key: 'safety', label: 'Safety & Concerns', pathSuffix: '/safety' },
  { key: 'mood', label: 'Mood & Wellness', pathSuffix: '/mood' },
  { key: 'engagement', label: 'Engagement', pathSuffix: '/engagement' },
  { key: 'conversations', label: 'Conversations', pathSuffix: '/conversations' },
  { key: 'memory', label: 'Memory', pathSuffix: '/memory' },
  { key: 'relationships', label: 'Relationships', pathSuffix: '/relationships' },
] as const;

export function InsightsTabNav({ lineShortId }: InsightsTabNavProps) {
  const pathname = usePathname();
  const basePath = `/dashboard/insights/${lineShortId}`;

  const getIsActive = (pathSuffix: string) => {
    const fullPath = `${basePath}${pathSuffix}`;
    if (pathSuffix === '') {
      // Overview tab - active only when exactly on the base path
      return pathname === basePath || pathname === `${basePath}/`;
    }
    // Other tabs - active when pathname starts with the tab path
    return pathname.startsWith(fullPath);
  };

  return (
    <NavigationMenu bordered>
      {INSIGHTS_TABS.map((tab) => (
        <NavigationItem
          key={tab.key}
          className="flex-1 lg:flex-none"
          active={getIsActive(tab.pathSuffix)}
          link={{
            path: `${basePath}${tab.pathSuffix}`,
            label: tab.label,
          }}
        />
      ))}
    </NavigationMenu>
  );
}
