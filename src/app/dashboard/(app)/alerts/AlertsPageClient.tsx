'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import classNames from 'clsx';
import type { LineRow, WellnessAlert } from '~/lib/ultaura/types';
import NavigationMenu from '~/core/ui/Navigation/NavigationMenu';
import NavigationItem from '~/core/ui/Navigation/NavigationItem';
import { WellnessAlertsList } from './WellnessAlertsList';
import {
  AlertSettings,
  OwnerAlertSettingsSection,
  AlertSettingsSection,
} from './AlertSettings';
import MobileNavigationDropdown from '~/core/ui/MobileNavigationDropdown';
import type { AccountAlertDelivery } from '~/lib/ultaura/account-alert-delivery';
import type { AlertSectionConfig, AlertSectionValue } from './types';
import {
  ALERT_SECTIONS,
  buildAlertUrl,
  parseAlertSection,
} from './lib/alert-navigation';
import { Section, SectionHeader, SectionBody } from '~/core/ui/Section';

type AlertsTabValue = 'wellness-alerts' | 'alert-settings';

const ALERTS_TABS: Array<{
  value: AlertsTabValue;
  label: string;
  path: string;
}> = [
  {
    value: 'wellness-alerts',
    label: 'Wellness Alerts',
    path: '/dashboard/alerts?tab=wellness-alerts',
  },
  {
    value: 'alert-settings',
    label: 'Notifications',
    path: buildAlertUrl('lines'),
  },
];

interface AlertsPageClientProps {
  alerts: WellnessAlert[];
  lines: LineRow[];
  settings: Parameters<typeof AlertSettings>[0]['settings'];
  deliveryEmail: string;
  ownerAlertDelivery: AccountAlertDelivery;
  ownerPhone: string | null;
  ownerPhoneVerified: boolean;
  disabled?: boolean;
}

function AlertsSidebarNav({
  sections,
  activeSection,
}: {
  sections: AlertSectionConfig[];
  activeSection: AlertSectionConfig;
}) {
  const links = sections.map((section) => ({
    path: buildAlertUrl(section.value),
    label: section.label,
  }));

  return (
    <>
      <div className="hidden min-w-[12rem] lg:flex">
        <nav className="w-full" aria-label="Alerts section navigation">
          <ul className="flex flex-col space-y-1.5">
            {sections.map((section) => {
              const isActive = section.value === activeSection.value;

              return (
                <li key={section.value}>
                  <Link
                    href={buildAlertUrl(section.value)}
                    scroll={false}
                    className={classNames(
                      'group flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-primary',
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span>{section.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="block w-full lg:hidden">
        <MobileNavigationDropdown
          links={links}
          currentLabel={activeSection.label}
          ariaLabel="Select alerts section"
        />
      </div>
    </>
  );
}

export function AlertsPageClient({
  alerts,
  lines,
  settings,
  deliveryEmail,
  ownerAlertDelivery,
  ownerPhone,
  ownerPhoneVerified,
  disabled,
}: AlertsPageClientProps) {
  const searchParams = useSearchParams();
  const [activeLineTab, setActiveLineTab] = useState<string | null>(null);

  const tabParam = searchParams.get('tab');
  const activeTab: AlertsTabValue =
    tabParam === 'wellness-alerts' || tabParam === 'alert-settings'
      ? tabParam
      : 'wellness-alerts';

  // Parse section from URL, default to 'lines'
  const sectionParam = parseAlertSection(searchParams.get('section'));
  const activeSectionValue: AlertSectionValue = sectionParam ?? 'lines';
  const activeSection =
    ALERT_SECTIONS.find((s) => s.value === activeSectionValue) ??
    ALERT_SECTIONS[0];

  // Initialize activeLineTab to first line when lines change
  useMemo(() => {
    if (lines.length > 0 && !activeLineTab) {
      setActiveLineTab(lines[0].id);
    } else if (lines.length === 0) {
      setActiveLineTab(null);
    }
  }, [lines, activeLineTab]);

  // Get active line for line notifications section
  const activeLineEntry = useMemo(() => {
    if (activeLineTab) {
      return settings.find((s) => s.line.id === activeLineTab);
    }
    return settings[0] ?? null;
  }, [settings, activeLineTab]);

  return (
    <div className="space-y-6 pb-12">
      <div className="mb-6">
        <NavigationMenu bordered scrollable>
          {ALERTS_TABS.map((tab) => (
            <NavigationItem
              key={tab.value}
              active={tab.value === activeTab}
              scroll={false}
              link={{ path: tab.path, label: tab.label }}
            />
          ))}
        </NavigationMenu>
      </div>

      <div className="space-y-4">
        {activeTab === 'wellness-alerts' && (
          <WellnessAlertsList alerts={alerts} />
        )}
        {activeTab === 'alert-settings' && (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
            <AlertsSidebarNav
              sections={ALERT_SECTIONS}
              activeSection={activeSection}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-6">
              {activeSection.value === 'owner' && (
                <OwnerAlertSettingsSection
                  ownerAlertDelivery={ownerAlertDelivery}
                  ownerPhone={ownerPhone}
                  ownerPhoneVerified={ownerPhoneVerified}
                  deliveryEmail={deliveryEmail}
                  disabled={disabled}
                />
              )}

              {activeSection.value === 'lines' && (
                <>
                  {settings.length === 0 ? (
                    <Section>
                      <SectionHeader title="Line Notifications" />
                      <SectionBody className="gap-4">
                        <p className="text-sm text-muted-foreground">
                          Add a line to receive wellness alerts and notifications
                          about your loved ones.
                        </p>
                        <Link
                          href="/dashboard/lines"
                          className="text-sm font-medium text-primary underline underline-offset-2 hover:no-underline"
                        >
                          Add your first line →
                        </Link>
                      </SectionBody>
                    </Section>
                  ) : (
                    <>
                      {/* Line sub-navigation tabs */}
                      {settings.length > 1 && (
                        <NavigationMenu bordered scrollable>
                          {settings.map((entry) => (
                            <NavigationItem
                              key={entry.line.id}
                              active={
                                activeLineTab === entry.line.id ||
                                (activeLineTab === null &&
                                  entry.line.id === settings[0]?.line.id)
                              }
                              scroll={false}
                              link={{
                                path: '#',
                                label: entry.line.display_name,
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveLineTab(entry.line.id);
                              }}
                            />
                          ))}
                        </NavigationMenu>
                      )}

                      {/* Active line settings */}
                      {activeLineEntry && (
                        <AlertSettingsSection
                          line={activeLineEntry.line}
                          preferences={activeLineEntry.preferences}
                          deliveryEmail={deliveryEmail}
                          disabled={disabled}
                        />
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
