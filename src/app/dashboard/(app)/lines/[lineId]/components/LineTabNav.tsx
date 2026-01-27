'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import NavigationMenu from '~/core/ui/Navigation/NavigationMenu';
import NavigationItem from '~/core/ui/Navigation/NavigationItem';

interface LineTabNavProps {
  lineShortId: string;
}

const LINE_TABS = [
  { key: 'overview', label: 'Overview', pathSuffix: '' },
  { key: 'settings', label: 'Settings', pathSuffix: '/settings' },
  { key: 'call-controls', label: 'Call Controls', pathSuffix: '/settings?tab=call-controls' },
  { key: 'topics', label: 'Topics', pathSuffix: '/topics' },
  { key: 'milestones', label: 'Milestones', pathSuffix: '/milestones' },
  { key: 'contacts', label: 'Contacts', pathSuffix: '/contacts' },
] as const;

export function LineTabNav({ lineShortId }: LineTabNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const basePath = `/dashboard/lines/${lineShortId}`;
  const navRef = useRef<HTMLDivElement>(null);

  const getIsActive = (pathSuffix: string) => {
    const fullPath = `${basePath}${pathSuffix}`;
    const tabParam = searchParams.get('tab');
    if (pathSuffix === '/settings?tab=call-controls') {
      return pathname.startsWith(`${basePath}/settings`) && tabParam === 'call-controls';
    }
    if (pathSuffix === '') {
      // Overview tab - active only when exactly on the base path
      return pathname === basePath || pathname === `${basePath}/`;
    }
    if (pathSuffix.startsWith('/settings')) {
      return pathname.startsWith(`${basePath}/settings`) && !tabParam;
    }
    // Other tabs - active when pathname starts with the tab path
    return pathname.startsWith(fullPath);
  };

  // Scroll active tab into view on mount/navigation (for mobile)
  useEffect(() => {
    if (!navRef.current) return;

    const activeTab = navRef.current.querySelector('[data-active="true"]');
    if (activeTab) {
      activeTab.scrollIntoView({
        behavior: 'instant',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [pathname, searchParams]);

  return (
    <div ref={navRef}>
      <NavigationMenu bordered scrollable>
        {LINE_TABS.map((tab) => {
          const isActive = getIsActive(tab.pathSuffix);
          return (
            <NavigationItem
              key={tab.key}
              active={isActive}
              data-active={isActive}
              link={{
                path: `${basePath}${tab.pathSuffix}`,
                label: tab.label,
              }}
            />
          );
        })}
      </NavigationMenu>
    </div>
  );
}
