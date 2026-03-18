'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import NavigationMenu from '~/core/ui/Navigation/NavigationMenu';
import NavigationItem from '~/core/ui/Navigation/NavigationItem';
import MobileNavigationDropdown from '~/core/ui/MobileNavigationDropdown';

import type { HealthTabValue, HealthConsentStatus, HealthCondition, HealthObservation, HealthDocument } from '@ultaura/types';
import { cn } from '~/core/generic/shadcn-utils';
import type { LineRow, UltauraAccountRow } from '~/lib/ultaura/types';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
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
import { runWithRetries } from './lib/health-fetch-utils';
import type { HealthInitialTabData, HealthChecklistCounts } from './types';
import { HealthChecklist } from './components/HealthChecklist';


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
  initialTabData: HealthInitialTabData | null;
  checklistCounts: HealthChecklistCounts;
}

export function HealthProfilePageClient({
  account,
  lines,
  consentByLineId,
  entitlementState,
  disclaimerState,
  initialTabData,
  checklistCounts,
}: HealthProfilePageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(
    disclaimerState.isCurrent,
  );
  const [initialTabDataSeed, setInitialTabDataSeed] = useState<HealthInitialTabData | null>(
    initialTabData,
  );

  const searchParamsRecord = Object.fromEntries(searchParams.entries());
  const activeTab = parseHealthTab(searchParamsRecord) as HealthTabValue;
  const lineIdFromUrl = parseHealthLine(searchParamsRecord);

  // Resolve the selected line: URL param > localStorage > first line
  const [selectedLineId, setSelectedLineId] = useState<string | null>(lineIdFromUrl ?? null);

  // Read persisted line selection from localStorage after mount (avoids hydration mismatch)
  useEffect(() => {
    if (selectedLineId) return; // already have a value from URL
    try {
      const stored = localStorage.getItem(`${HEALTH_LINE_STORAGE_KEY_PREFIX}${account.id}`);
      if (stored) setSelectedLineId(stored);
    } catch {
      // continue without localStorage
    }
  }, [account.id, selectedLineId]);

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

  // Compute derived values before any conditional returns (Rules of Hooks)
  const resolvedLineId = selectedLineId ?? (lines.length > 0 ? lines[0]!.short_id : null);
  const selectedLine = lines.find(
    (l) => l.short_id === resolvedLineId,
  ) ?? lines[0];
  const selectedLineFullId = selectedLine?.id ?? null;

  useEffect(() => {
    if (!initialTabDataSeed || !selectedLineFullId) return;

    if (
      initialTabDataSeed.tab !== activeTab
      || initialTabDataSeed.lineId !== selectedLineFullId
    ) {
      setInitialTabDataSeed(null);
    }
  }, [activeTab, initialTabDataSeed, selectedLineFullId]);

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
    <div className="space-y-3 pb-12">
      {/* Health checklist */}
      <HealthChecklist counts={checklistCounts} />

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
              key={selectedLine.id}
              lineId={selectedLine.id}
              lineName={selectedLine.display_name}
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

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="rounded-xl border border-border/50 bg-card/50 p-6">
            <HealthTabContent
              tab={activeTab}
              lineId={selectedLine.short_id}
              lineFullId={selectedLine.id}
              accountId={account.id}
              initialTabData={initialTabDataSeed}
            />
          </div>
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
                        ? 'bg-primary/10 text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-primary',
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
  initialConditions,
}: {
  lineId: string;
  accountId: string;
  initialConditions?: HealthCondition[];
}) {
  const [conditions, setConditions] = useState<HealthCondition[] | null>(
    initialConditions ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(initialConditions === undefined);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    requestVersionRef.current += 1;
    const requestVersion = requestVersionRef.current;

    if (initialConditions !== undefined) {
      setConditions(initialConditions);
      setError(null);
      setIsLoading(false);
      return;
    }

    setConditions(null);
    setIsLoading(true);
    setError(null);

    runWithRetries(() => getConditionsAction(lineId))
      .then((result) => {
        if (requestVersionRef.current !== requestVersion) return;

        if (result.success) {
          setConditions(result.conditions);
          setError(null);
          return;
        }

        setConditions(null);
        setError(result.error);
      })
      .catch(() => {
        if (requestVersionRef.current !== requestVersion) return;
        setConditions(null);
        setError('Failed to load conditions');
      })
      .finally(() => {
        if (requestVersionRef.current === requestVersion) {
          setIsLoading(false);
        }
      });

    return () => {
      if (requestVersionRef.current === requestVersion) {
        requestVersionRef.current += 1;
      }
    };
  }, [lineId, initialConditions]);

  if (isLoading && conditions === null) {
    return (
      <div className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
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

function ObservationsTabLoader({
  lineId,
  initialObservations,
}: {
  lineId: string;
  initialObservations?: HealthObservation[];
}) {
  const [observations, setObservations] = useState<HealthObservation[] | null>(
    initialObservations ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(initialObservations === undefined);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    requestVersionRef.current += 1;
    const requestVersion = requestVersionRef.current;

    if (initialObservations !== undefined) {
      setObservations(initialObservations);
      setError(null);
      setIsLoading(false);
      return;
    }

    setObservations(null);
    setIsLoading(true);
    setError(null);

    runWithRetries(() => getObservationsAction(lineId))
      .then((result) => {
        if (requestVersionRef.current !== requestVersion) return;

        if (result.success) {
          setObservations(result.observations);
          setError(null);
          return;
        }

        setObservations(null);
        setError(result.error);
      })
      .catch(() => {
        if (requestVersionRef.current !== requestVersion) return;
        setObservations(null);
        setError('Failed to load observations');
      })
      .finally(() => {
        if (requestVersionRef.current === requestVersion) {
          setIsLoading(false);
        }
      });

    return () => {
      if (requestVersionRef.current === requestVersion) {
        requestVersionRef.current += 1;
      }
    };
  }, [lineId, initialObservations]);

  if (isLoading && observations === null) {
    return (
      <div className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
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
  initialDocuments,
}: {
  lineId: string;
  initialDocuments?: HealthDocument[];
}) {
  const [documents, setDocuments] = useState<HealthDocument[] | null>(
    initialDocuments ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(initialDocuments === undefined);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    requestVersionRef.current += 1;
    const requestVersion = requestVersionRef.current;

    if (initialDocuments !== undefined) {
      setDocuments(initialDocuments);
      setError(null);
      setIsLoading(false);
      return;
    }

    setDocuments(null);
    setIsLoading(true);
    setError(null);

    runWithRetries(() => getDocumentsAction(lineId))
      .then((result) => {
        if (requestVersionRef.current !== requestVersion) return;

        if (result.success) {
          setDocuments(result.documents);
          setError(null);
          return;
        }

        setDocuments(null);
        setError(result.error);
      })
      .catch(() => {
        if (requestVersionRef.current !== requestVersion) return;
        setDocuments(null);
        setError('Failed to load documents');
      })
      .finally(() => {
        if (requestVersionRef.current === requestVersion) {
          setIsLoading(false);
        }
      });

    return () => {
      if (requestVersionRef.current === requestVersion) {
        requestVersionRef.current += 1;
      }
    };
  }, [lineId, initialDocuments]);

  if (isLoading && documents === null) {
    return (
      <div className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
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
  initialTabData,
}: {
  tab: HealthTabValue;
  lineId: string;
  lineFullId: string;
  accountId: string;
  initialTabData: HealthInitialTabData | null;
}) {
  if (tab === 'suggestions') {
    return <HealthSuggestionsTab lineId={lineFullId} accountId={accountId} />;
  }

  if (tab === 'conditions') {
    const initialConditions =
      initialTabData?.tab === 'conditions' && initialTabData.lineId === lineFullId
        ? initialTabData.conditions
        : undefined;

    return (
      <ConditionsTabLoader
        lineId={lineFullId}
        accountId={accountId}
        initialConditions={initialConditions}
      />
    );
  }

  if (tab === 'medications') {
    const initialMedications =
      initialTabData?.tab === 'medications' && initialTabData.lineId === lineFullId
        ? initialTabData.medications
        : undefined;

    return (
      <HealthMedicationsTab
        lineId={lineFullId}
        accountId={accountId}
        conditions={[]}
        initialMedications={initialMedications}
      />
    );
  }

  if (tab === 'documents') {
    const initialDocuments =
      initialTabData?.tab === 'documents' && initialTabData.lineId === lineFullId
        ? initialTabData.documents
        : undefined;

    return (
      <DocumentsTabLoader
        lineId={lineFullId}
        initialDocuments={initialDocuments}
      />
    );
  }

  if (tab === 'observations') {
    const initialObservations =
      initialTabData?.tab === 'observations' && initialTabData.lineId === lineFullId
        ? initialTabData.observations
        : undefined;

    return (
      <ObservationsTabLoader
        lineId={lineFullId}
        initialObservations={initialObservations}
      />
    );
  }

  return null;
}
