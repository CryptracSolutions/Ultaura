'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import classNames from 'clsx';
import Trans from '~/core/ui/Trans';

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
  const tabRefs = useRef<(HTMLLIElement | null)[]>([]);

  const getIsActive = useCallback((pathSuffix: string) => {
    const fullPath = `${basePath}${pathSuffix}`;
    const tabParam = searchParams.get('tab');
    if (pathSuffix === '/settings?tab=call-controls') {
      return pathname.startsWith(`${basePath}/settings`) && tabParam === 'call-controls';
    }
    if (pathSuffix === '') {
      return pathname === basePath || pathname === `${basePath}/`;
    }
    if (pathSuffix === '/settings') {
      return (
        pathname.startsWith(`${basePath}/settings`) &&
        (tabParam === 'settings' || !tabParam)
      );
    }
    return pathname.startsWith(fullPath);
  }, [basePath, pathname, searchParams]);

  const activeIndex = useMemo(() => {
    return LINE_TABS.findIndex((tab) => getIsActive(tab.pathSuffix));
  }, [getIsActive]);

  // Scroll active tab into view on mount/navigation (for mobile)
  useEffect(() => {
    let rafId1: number;
    let rafId2: number;

    // Double rAF ensures we run after Next.js scroll restoration and browser paint
    rafId1 = requestAnimationFrame(() => {
      rafId2 = requestAnimationFrame(() => {
        const activeTab = tabRefs.current[activeIndex];
        if (activeTab) {
          activeTab.scrollIntoView({
            behavior: 'instant',
            inline: 'center',
            block: 'nearest',
          });
        }
      });
    });

    return () => {
      cancelAnimationFrame(rafId1);
      cancelAnimationFrame(rafId2);
    };
  }, [activeIndex]);

  return (
    <ul className="w-full items-center flex gap-2 lg:gap-3 border-b border-border pb-1.5 overflow-x-auto flex-nowrap scrollbar-hide">
      {LINE_TABS.map((tab, index) => {
        const isActive = getIsActive(tab.pathSuffix);
        return (
          <li
            key={tab.key}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            className={classNames(
              'flex items-center justify-center font-medium lg:justify-start rounded-md text-sm transition colors transform *:active:translate-y-[2px]',
              '*:p-1 *:lg:px-2.5 *:s-full *:flex *:items-center',
              'relative h-10 flex-none whitespace-nowrap',
              isActive
                ? 'relative rounded-none bg-transparent text-primary after:absolute after:inset-x-0 after:-bottom-[0.125rem] after:h-1 after:bg-primary after:content-[\'\']'
                : 'hover:bg-muted hover:text-primary active:bg-muted/80 transition-colors rounded-lg border-transparent text-muted-foreground'
            )}
          >
            <Link
              className="transition-transform duration-500 justify-center lg:justify-start w-full h-full flex items-center"
              href={`${basePath}${tab.pathSuffix}`}
              shallow={isActive}
            >
              <Trans i18nKey={tab.label} defaults={tab.label} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
