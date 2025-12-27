'use client';

import { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';

import NavigationMenu from '~/core/ui/Navigation/NavigationMenu';
import NavigationItem from '~/core/ui/Navigation/NavigationItem';

type TabValue = 'calls' | 'reminders';

const DASHBOARD_TABS = [
  { value: 'calls' as const, label: 'Upcoming calls', path: '/dashboard?tab=calls' },
  { value: 'reminders' as const, label: 'Upcoming reminders', path: '/dashboard?tab=reminders' },
];

export function DashboardUpcomingTabs(props: {
  callsContent: ReactNode;
  remindersContent: ReactNode;
}) {
  const searchParams = useSearchParams();

  const selected = (searchParams.get('tab') ?? 'calls') as TabValue;
  const activeTab: TabValue = selected === 'reminders' ? 'reminders' : 'calls';

  return (
    <div>
      <NavigationMenu bordered>
        {DASHBOARD_TABS.map((tab) => (
          <NavigationItem
            key={tab.value}
            className={'flex-1 lg:flex-none'}
            active={tab.value === activeTab}
            scroll={false}
            link={{ path: tab.path, label: tab.label }}
          />
        ))}
      </NavigationMenu>

      <div className="mt-4">
        {activeTab === 'reminders' ? props.remindersContent : props.callsContent}
      </div>
    </div>
  );
}

