'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import NavigationMenu from '~/core/ui/Navigation/NavigationMenu';
import NavigationItem from '~/core/ui/Navigation/NavigationItem';
import MobileNavigationDropdown from '~/core/ui/MobileNavigationDropdown';

import type { HealthTabValue, HealthConsentStatus, HealthCondition, HealthObservation, HealthDocument } from '@ultaura/types';
import type { LineRow, UltauraAccountRow } from '~/lib/ultaura/types';

import { Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/core/ui/Dialog';
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

  const activeTab = parseHealthTab(
    Object.fromEntries(searchParams.entries()),
  ) as HealthTabValue;

  const lineIdFromUrl = parseHealthLine(Object.fromEntries(searchParams.entries()));

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

  const tabLinks = HEALTH_TABS.map((tab) => ({
    path: buildHealthUrl(tab.value, selectedLine.short_id),
    label: tab.label,
  }));

  const activeTabConfig = HEALTH_TABS.find((t) => t.value === activeTab);

  return (
    <div className="space-y-4">
      {/* About Health Profile + Line switcher row */}
      <div className="flex items-center justify-between gap-4">
        {/* Line switcher for multi-line accounts */}
        {lines.length > 1 ? (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Viewing:</span>
          <select
            value={selectedLine.short_id}
            onChange={(e) => handleLineSelected(e.target.value)}
            className="min-h-[44px] rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Select line"
          >
            {lines.map((line) => (
              <option key={line.id} value={line.short_id}>
                {line.display_name}
              </option>
            ))}
          </select>
          </div>
        ) : (
          <div />
        )}

        {/* About Health Profile info button */}
        <Dialog>
          <DialogTrigger asChild>
            <button
              className="flex min-h-[44px] items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="About Health Profile"
            >
              <Info className="size-4" />
              <span className="hidden sm:inline">About Health Profile</span>
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>About Health Profile</DialogTitle>
            </DialogHeader>
            <div className="py-1">
              <p className="text-sm text-foreground leading-relaxed">
                Ultaura is not a doctor or medical professional. Health
                information stored here is for personal reference and, with your
                permission, to help Ultaura provide more informed companionship.
                Ultaura may make mistakes. Always consult qualified healthcare
                providers for medical advice, diagnosis, or treatment.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Consent card */}
      {consentState ? (
        <HealthConsentCard
          lineId={selectedLine.id}
          accountId={account.id}
          userType={userType}
          consentStatus={consentState.consentStatus}
          consentRequestedAt={consentState.consentRequestedAt}
          historyPreview={consentState.historyPreview}
        />
      ) : null}

      {/* Tab navigation */}
      <div>
        {/* Desktop tabs */}
        <div className="hidden sm:block">
          <NavigationMenu bordered scrollable ariaLabel="Health sections">
            {HEALTH_TABS.map((tab) => (
              <NavigationItem
                key={tab.value}
                link={{
                  path: buildHealthUrl(tab.value, selectedLine.short_id),
                  label: tab.label,
                }}
                active={activeTab === tab.value}
                onClick={() => handleTabChange(tab.value)}
              />
            ))}
          </NavigationMenu>
        </div>

        {/* Mobile tab dropdown */}
        <div className="sm:hidden">
          <MobileNavigationDropdown
            links={tabLinks}
            currentLabel={activeTabConfig?.label}
            ariaLabel="Health sections"
          />
        </div>
      </div>

      {/* Tab content */}
      <div className="py-2">
        <HealthTabContent
          tab={activeTab}
          lineId={selectedLine.short_id}
          lineFullId={selectedLine.id}
          accountId={account.id}
        />
      </div>
    </div>
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

    getConditionsAction(lineId).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setConditions(result.conditions);
      } else {
        setError(result.error);
      }
    }).catch(() => {
      if (!cancelled) setError('Failed to load conditions');
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineId]);

  if (isLoading && conditions === null) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
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
  accountId,
}: {
  lineId: string;
  accountId: string;
}) {
  const [observations, setObservations] = useState<HealthObservation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getObservationsAction(lineId).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setObservations(result.observations);
      } else {
        setError(result.error);
      }
    }).catch(() => {
      if (!cancelled) setError('Failed to load observations');
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineId]);

  if (isLoading && observations === null) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
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
      accountId={accountId}
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

    getDocumentsAction(lineId).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setDocuments(result.documents);
      } else {
        setError(result.error);
      }
    }).catch(() => {
      if (!cancelled) setError('Failed to load documents');
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineId]);

  if (isLoading && documents === null) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
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
    return <ObservationsTabLoader lineId={lineFullId} accountId={accountId} />;
  }

  return null;
}
