'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import NavigationMenu from '~/core/ui/Navigation/NavigationMenu';
import NavigationItem from '~/core/ui/Navigation/NavigationItem';
import MobileNavigationDropdown from '~/core/ui/MobileNavigationDropdown';

import type { HealthTabValue, HealthConsentStatus, HealthCondition, HealthObservation, HealthDocument } from '@ultaura/types';
import { cn } from '~/core/generic/shadcn-utils';
import type { LineRow, UltauraAccountRow } from '~/lib/ultaura/types';

import Link from 'next/link';
import { CollapsibleInfoTip } from '~/core/ui/CollapsibleInfoTip';
import { HealthLockedState } from './components/HealthLockedState';
import { HealthDisclaimerDialog } from './components/HealthDisclaimerDialog';
import { HealthConsentCard } from './components/HealthConsentCard';
import { HealthConditionsTab } from './components/HealthConditionsTab';
import { HealthMedicationsTab } from './components/HealthMedicationsTab';
import { HealthObservationsTab } from './components/HealthObservationsTab';
import { HealthDocumentsTab } from './components/HealthDocumentsTab';
import { HealthSuggestionsTab } from './components/HealthSuggestionsTab';
import { getConditionsAction, getObservationsAction, getDocumentsAction } from '~/lib/ultaura/health/actions';
import {
  HEALTH_TABS,
  HEALTH_LINE_STORAGE_KEY_PREFIX,
  buildHealthUrl,
  parseHealthTab,
  parseHealthLine,
} from './lib/health-navigation';


interface ConsentState {
  lineId: string;
  consentStatus: HealthConsentStatus;
  consentRequestedAt: string | null;
  historyPreview: Array<{
    id: string;
    eventType: string;
    resultingStatus: HealthConsentStatus | null;
    createdAt: string;
  }>;
}

interface EntitlementState {
  isEnabled: boolean;
  isEligible: boolean;
  isLocked: boolean;
  lockReason: 'feature_disabled' | 'plan_ineligible' | 'on_trial' | null;
}

interface DisclaimerState {
  isCurrent: boolean;
}

interface HealthProfilePageClientProps {
  account: UltauraAccountRow;
  lines: LineRow[];
  consentByLineId: Record<string, ConsentState>;
  entitlementState: EntitlementState;
  disclaimerState: DisclaimerState;
}

export function HealthProfilePageClient({
  account,
  lines,
  consentByLineId,
  entitlementState,
  disclaimerState,
}: HealthProfilePageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(
    disclaimerState.isCurrent,
  );

  const searchParamsRecord = Object.fromEntries(searchParams.entries());
  const activeTab = parseHealthTab(searchParamsRecord) as HealthTabValue;
  const lineIdFromUrl = parseHealthLine(searchParamsRecord);

  // Resolve the selected line: URL param > localStorage > first line
  const [selectedLineId, setSelectedLineId] = useState<string | null>(() => {
    if (lineIdFromUrl) return lineIdFromUrl;

    try {
      return localStorage.getItem(`${HEALTH_LINE_STORAGE_KEY_PREFIX}${account.id}`) ?? null;
    } catch {
      return null;
    }
  });

  // Sync URL → state: when ?line= changes (e.g. line selector navigates, or user edits URL)
  useEffect(() => {
    if (lineIdFromUrl && lineIdFromUrl !== selectedLineId) {
      setSelectedLineId(lineIdFromUrl);
    }
  }, [lineIdFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync selectedLineId to URL when it changes
  useEffect(() => {
    if (!selectedLineId) return;
    const currentLine = parseHealthLine(Object.fromEntries(searchParams.entries()));

    if (currentLine !== selectedLineId) {
      router.replace(buildHealthUrl(activeTab, selectedLineId), { scroll: false });
    }
  }, [selectedLineId, activeTab, router, searchParams]);

  const handleTabChange = (tab: HealthTabValue) => {
    router.push(buildHealthUrl(tab, selectedLineId ?? undefined), { scroll: false });
  };

  const handleLineSelected = (lineShortId: string) => {
    try {
      localStorage.setItem(`${HEALTH_LINE_STORAGE_KEY_PREFIX}${account.id}`, lineShortId);
    } catch {
      // continue without localStorage
    }

    setSelectedLineId(lineShortId);
    router.push(buildHealthUrl(activeTab, lineShortId), { scroll: false });
  };

  // Locked state — show before anything else
  if (entitlementState.isLocked) {
    return <HealthLockedState />;
  }

  // Disclaimer gate — must acknowledge before proceeding
  if (!disclaimerAcknowledged) {
    return (
      <HealthDisclaimerDialog
        accountId={account.id}
        onAcknowledged={() => setDisclaimerAcknowledged(true)}
      />
    );
  }

  // Multi-line accounts with no line selected: auto-select the first line
  // (line switching is handled inline via the select dropdown in the main render)
  const resolvedLineId = selectedLineId ?? (lines.length > 0 ? lines[0]!.short_id : null);

  // Resolve the selected line object
  const selectedLine = lines.find(
    (l) => l.short_id === resolvedLineId,
  ) ?? lines[0];

  if (!selectedLine) {
    return (
      <div className="py-8">
        <p className="text-sm text-muted-foreground">No lines found for this account.</p>
      </div>
    );
  }

  const consentState = consentByLineId[selectedLine.id] ?? null;
  const userType = account.user_type === 'self' ? 'self' : 'family_managed';

  return (
    <div className="space-y-4 pb-12">
      {/* Info tip banner */}
      <CollapsibleInfoTip storageKey="health_info_tip_collapsed" collapsedLabel="Health disclaimer">
        Ultaura is not a doctor or medical professional. Health information
        stored here is for personal reference and, with your permission, to help
        Ultaura provide more informed companionship. Ultaura may make mistakes.
        Always consult qualified healthcare providers for medical advice,
        diagnosis, or treatment.{' '}
        <Link
          href="/docs/health"
          className="font-medium underline underline-offset-2 hover:no-underline"
          onClick={(e) => e.stopPropagation()}
        >
          Learn more →
        </Link>
      </CollapsibleInfoTip>

      {/* Line tabs + consent badge row */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        {lines.length > 1 && (
          <NavigationMenu bordered scrollable ariaLabel="Select companion line">
            {lines.map((line) => (
              <NavigationItem
                key={line.id}
                link={{
                  path: buildHealthUrl(activeTab, line.short_id),
                  label: line.display_name,
                }}
                active={line.short_id === resolvedLineId}
                scroll={false}
                onClick={(e) => {
                  e?.preventDefault();
                  handleLineSelected(line.short_id);
                }}
              />
            ))}
          </NavigationMenu>
        )}

        {consentState ? (
          <div className="self-start sm:ml-auto sm:self-auto shrink-0">
            <HealthConsentCard
              lineId={selectedLine.id}
              userType={userType}
              consentStatus={consentState.consentStatus}
              consentRequestedAt={consentState.consentRequestedAt}
            />
          </div>
        ) : null}
      </div>

      {/* Sidebar + Content layout */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <HealthSidebarNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          lineId={selectedLine.short_id}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <HealthTabContent
            tab={activeTab}
            lineId={selectedLine.short_id}
            lineFullId={selectedLine.id}
            accountId={account.id}
          />
        </div>
      </div>
    </div>
  );
}

function HealthSidebarNav({
  activeTab,
  onTabChange,
  lineId,
}: {
  activeTab: HealthTabValue;
  onTabChange: (tab: HealthTabValue) => void;
  lineId?: string;
}) {
  const sidebarLinks = HEALTH_TABS.map((tab) => ({
    path: buildHealthUrl(tab.value, lineId),
    label: tab.label,
  }));

  const activeTabConfig = HEALTH_TABS.find((t) => t.value === activeTab);

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden min-w-[12rem] lg:flex">
        <nav className="w-full" aria-label="Health section navigation">
          <ul className="flex flex-col space-y-1.5">
            {HEALTH_TABS.map((tab) => {
              const isActive = tab.value === activeTab;
              return (
                <li key={tab.value}>
                  <Link
                    href={buildHealthUrl(tab.value, lineId)}
                    scroll={false}
                    onClick={(e) => {
                      e.preventDefault();
                      onTabChange(tab.value);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-primary',
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span>{tab.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Mobile dropdown */}
      <div className="block w-full lg:hidden">
        <MobileNavigationDropdown
          links={sidebarLinks}
          currentLabel={activeTabConfig?.label}
          ariaLabel="Health sections"
          onNavigate={(e, link) => {
            e.preventDefault();
            const tab = HEALTH_TABS.find((t) => buildHealthUrl(t.value, lineId) === link.path);
            if (tab) onTabChange(tab.value);
          }}
        />
      </div>
    </>
  );
}

function ConditionsTabLoader({
  lineId,
  accountId,
}: {
  lineId: string;
  accountId: string;
}) {
  const [conditions, setConditions] = useState<HealthCondition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    let retries = 0;
    const load = () => {
      getConditionsAction(lineId).then((result) => {
        if (cancelled) return;
        if (result.success) {
          setConditions(result.conditions);
          setIsLoading(false);
        } else {
          setError(result.error);
          setIsLoading(false);
        }
      }).catch(() => {
        if (cancelled) return;
        if (retries < 1) {
          retries++;
          setTimeout(load, 500);
        } else {
          setError('Failed to load conditions');
          setIsLoading(false);
        }
      });
    };
    load();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineId]);

  if (isLoading && conditions === null) {
    return (
      <div className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-muted-foreground">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Loading conditions…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <HealthConditionsTab
      lineId={lineId}
      accountId={accountId}
      conditions={conditions ?? []}
    />
  );
}

function ObservationsTabLoader({ lineId }: { lineId: string }) {
  const [observations, setObservations] = useState<HealthObservation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    let retries = 0;
    const load = () => {
      getObservationsAction(lineId).then((result) => {
        if (cancelled) return;
        if (result.success) {
          setObservations(result.observations);
          setIsLoading(false);
        } else {
          setError(result.error);
          setIsLoading(false);
        }
      }).catch(() => {
        if (cancelled) return;
        if (retries < 1) {
          retries++;
          setTimeout(load, 500);
        } else {
          setError('Failed to load observations');
          setIsLoading(false);
        }
      });
    };
    load();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineId]);

  if (isLoading && observations === null) {
    return (
      <div className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-muted-foreground">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Loading observations…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <HealthObservationsTab
      lineId={lineId}
      observations={observations ?? []}
    />
  );
}

function DocumentsTabLoader({
  lineId,
}: {
  lineId: string;
}) {
  const [documents, setDocuments] = useState<HealthDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    let retries = 0;
    const load = () => {
      getDocumentsAction(lineId).then((result) => {
        if (cancelled) return;
        if (result.success) {
          setDocuments(result.documents);
          setIsLoading(false);
        } else {
          setError(result.error);
          setIsLoading(false);
        }
      }).catch(() => {
        if (cancelled) return;
        if (retries < 1) {
          retries++;
          setTimeout(load, 500);
        } else {
          setError('Failed to load documents');
          setIsLoading(false);
        }
      });
    };
    load();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineId]);

  if (isLoading && documents === null) {
    return (
      <div className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-muted-foreground">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Loading documents…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <HealthDocumentsTab
      lineId={lineId}
      documents={documents ?? []}
    />
  );
}

function HealthTabContent({
  tab,
  lineId,
  lineFullId,
  accountId,
}: {
  tab: HealthTabValue;
  lineId: string;
  lineFullId: string;
  accountId: string;
}) {
  if (tab === 'suggestions') {
    return <HealthSuggestionsTab lineId={lineFullId} accountId={accountId} />;
  }

  if (tab === 'conditions') {
    return <ConditionsTabLoader lineId={lineFullId} accountId={accountId} />;
  }

  if (tab === 'medications') {
    return (
      <HealthMedicationsTab
        lineId={lineFullId}
        accountId={accountId}
        conditions={[]}
      />
    );
  }

  if (tab === 'documents') {
    return <DocumentsTabLoader lineId={lineFullId} />;
  }

  if (tab === 'observations') {
    return <ObservationsTabLoader lineId={lineFullId} />;
  }

  return null;
}
