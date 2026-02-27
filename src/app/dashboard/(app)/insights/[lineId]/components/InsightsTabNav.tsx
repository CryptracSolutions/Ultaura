'use client';

import classNames from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import Trans from '~/core/ui/Trans';

interface InsightsTabNavProps {
  lineShortId: string;
}

const INSIGHTS_TABS = [
  { key: 'overview', label: 'Overview', pathSuffix: '' },
  { key: 'safety', label: 'Safety & Concerns', pathSuffix: '/safety' },
  { key: 'mood', label: 'Mood', pathSuffix: '/mood' },
  { key: 'engagement', label: 'Engagement', pathSuffix: '/engagement' },
  { key: 'conversations', label: 'Conversations', pathSuffix: '/conversations' },
  { key: 'memory', label: 'Memory', pathSuffix: '/memory' },
  { key: 'relationships', label: 'Relationships', pathSuffix: '/relationships' },
] as const;

export function InsightsTabNav({ lineShortId }: InsightsTabNavProps) {
  const pathname = usePathname();
  const basePath = `/dashboard/insights/${lineShortId}`;
  const tabRefs = useRef<(HTMLLIElement | null)[]>([]);

  const getIsActive = useCallback((pathSuffix: string) => {
    const fullPath = `${basePath}${pathSuffix}`;
    if (pathSuffix === '') {
      // Overview tab - active only when exactly on the base path
      return pathname === basePath || pathname === `${basePath}/`;
    }
    // Other tabs - active when pathname starts with the tab path
    return pathname.startsWith(fullPath);
  }, [basePath, pathname]);

  const activeIndex = useMemo(() => {
    return INSIGHTS_TABS.findIndex((tab) => getIsActive(tab.pathSuffix));
  }, [getIsActive]);

  useEffect(() => {
    let rafId1: number;
    let rafId2: number;

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
    <ul className="w-full items-center flex gap-2 lg:gap-3 border-b border-border pb-1 overflow-x-auto flex-nowrap scrollbar-hide">
      {INSIGHTS_TABS.map((tab, index) => {
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
