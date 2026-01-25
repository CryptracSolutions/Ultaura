'use client';

import { usePathname } from 'next/navigation';
import NavigationMenu from '~/core/ui/Navigation/NavigationMenu';
import NavigationItem from '~/core/ui/Navigation/NavigationItem';

interface LineTabNavProps {
  lineShortId: string;
}

const LINE_TABS = [
  { key: 'overview', label: 'Overview', pathSuffix: '' },
  { key: 'schedule', label: 'Schedule', pathSuffix: '/schedule' },
  { key: 'reminders', label: 'Reminders', pathSuffix: '/reminders' },
  { key: 'milestones', label: 'Milestones', pathSuffix: '/milestones' },
  { key: 'contacts', label: 'Contacts', pathSuffix: '/contacts' },
  { key: 'settings', label: 'Settings', pathSuffix: '/settings' },
] as const;

export function LineTabNav({ lineShortId }: LineTabNavProps) {
  const pathname = usePathname();
  const basePath = `/dashboard/lines/${lineShortId}`;

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
      {LINE_TABS.map((tab) => (
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
