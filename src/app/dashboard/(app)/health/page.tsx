import { Suspense } from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import getLogger from '~/core/logger';
import AppHeader from '../components/AppHeader';
import { PageBody } from '~/core/ui/Page';
import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import { getUltauraAccount } from '~/lib/ultaura/accounts';
import { getLines } from '~/lib/ultaura/lines';
import { isViewerRole } from '~/lib/ultaura/viewer-guards';
import { isHealthFeatureEnabled, getHealthEntitlementState } from '~/lib/ultaura/health/entitlements';
import { requireHealthOwner } from '~/lib/ultaura/health/access';
import { getHealthAccountState, recordHealthFirstView, isDisclaimerCurrent } from '~/lib/ultaura/health/account-state';
import { getHealthConsentState } from '~/lib/ultaura/health/consent';
import { getHealthConsentHistory } from '~/lib/ultaura/health/consent-history';
import { emitHealthFirstView } from '~/lib/ultaura/health/analytics';
import { getConditions } from '~/lib/ultaura/health/conditions';
import { getMedications } from '~/lib/ultaura/health/medications';
import { getObservations } from '~/lib/ultaura/health/observations';
import { getDocuments } from '~/lib/ultaura/health/documents';
import { HealthProfilePageClient } from './HealthProfilePageClient';
import type { HealthConsentStatus, HealthTabValue } from '@ultaura/types';
import { parseHealthTab, parseHealthLine } from './lib/health-navigation';
import type { HealthInitialTabData } from './types';

export const metadata: Metadata = {
  title: 'Health Profile - Ultaura',
};

const logger = getLogger();

interface PageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

async function loadInitialTabData(
  tab: HealthTabValue,
  lineId: string,
  accountId: string,
): Promise<HealthInitialTabData | null> {
  try {
    if (tab === 'conditions') {
      return {
        tab: 'conditions',
        lineId,
        conditions: await getConditions(lineId, undefined, accountId),
      };
    }

    if (tab === 'medications') {
      return {
        tab: 'medications',
        lineId,
        medications: await getMedications(lineId, undefined, accountId),
      };
    }

    if (tab === 'observations') {
      return {
        tab: 'observations',
        lineId,
        observations: await getObservations(lineId, accountId),
      };
    }

    if (tab === 'documents') {
      return {
        tab: 'documents',
        lineId,
        documents: await getDocuments(lineId, accountId),
      };
    }

    return null;
  } catch (err) {
    logger.warn({ err, tab, lineId }, 'Failed to prefetch health tab data');
    return null;
  }
}

export default async function HealthProfilePage({ searchParams }: PageProps) {
  const pageHeader = (
    <AppHeader
      title="Health Profile"
      description="Manage health information and call context for your loved one"
    />
  );

  // Check feature flag first — redirect if off
  const featureEnabled = await isHealthFeatureEnabled();
  if (!featureEnabled) {
    redirect('/dashboard');
  }

  const appData = await loadAppDataForUser();

  // Viewers cannot access Health Profile
  if (isViewerRole(appData.role)) {
    redirect('/dashboard');
  }

  const organizationId = appData.organization?.id;

  if (!organizationId) {
    return (
      <>
        {pageHeader}
        <PageBody>
          <div className="py-8">
            <p className="text-muted-foreground">
              We could not load your account right now. Please refresh and try again.
            </p>
          </div>
        </PageBody>
      </>
    );
  }

  const account = await getUltauraAccount(organizationId);

  if (!account) {
    return (
      <>
        {pageHeader}
        <PageBody>
          <div className="py-8">
            <div className="max-w-lg rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground">
                Set up Ultaura to use Health Profile
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Start a trial to enable Health Profile for your loved one.
              </p>
              <a
                href="/dashboard/settings/subscription"
                className="mt-4 inline-flex items-center text-sm font-medium text-primary hover:underline"
              >
                Start trial →
              </a>
            </div>
          </div>
        </PageBody>
      </>
    );
  }

  // Owner-only — must be the account creator
  const ownerResult = await requireHealthOwner(account.id);
  if (!ownerResult.ok) {
    redirect('/dashboard');
  }

  // Load entitlement state (plan eligibility check)
  const entitlementState = await getHealthEntitlementState(account);

  // Load lines, account state, consent data
  const lines = await getLines(account.id);

  const parsedTab = parseHealthTab(searchParams ?? {});
  const requestedLineShortId = parseHealthLine(searchParams ?? {});
  const prefetchLine =
    (requestedLineShortId
      ? lines.find((line) => line.short_id === requestedLineShortId)
      : null) ?? lines[0] ?? null;

  const initialTabData =
    !entitlementState.isLocked && prefetchLine
      ? await loadInitialTabData(parsedTab, prefetchLine.id, account.id)
      : null;

  const [accountState, ...consentResults] = await Promise.allSettled([
    getHealthAccountState(account.id),
    ...lines.map((line) => getHealthConsentState(line.id)),
  ]);

  const resolvedAccountState =
    accountState.status === 'fulfilled' ? accountState.value : null;

  // Build consent map keyed by line ID — history previews fetched in parallel
  const historyPreviews = await Promise.all(
    lines.map(async (line) => {
      try {
        const history = await getHealthConsentHistory(line.id, 5);
        return history.map((entry) => ({
          id: entry.id,
          eventType: entry.eventType,
          resultingStatus: entry.resultingStatus,
          createdAt: entry.createdAt,
        }));
      } catch (err) {
        logger.warn({ err, lineId: line.id }, 'Failed to load consent history preview for health page');
        return [];
      }
    }),
  );

  type ConsentEntry = {
    lineId: string;
    consentStatus: HealthConsentStatus;
    consentRequestedAt: string | null;
    historyPreview: Array<{
      id: string;
      eventType: string;
      resultingStatus: HealthConsentStatus | null;
      createdAt: string;
    }>;
  };

  const consentByLineId: Record<string, ConsentEntry> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const result = consentResults[i];
    const historyPreview = historyPreviews[i] ?? [];

    if (result?.status === 'fulfilled' && result.value) {
      const row = result.value;
      consentByLineId[line.id] = {
        lineId: line.id,
        consentStatus: row.health_consent as HealthConsentStatus,
        consentRequestedAt: row.health_consent_requested_at,
        historyPreview,
      };
    } else {
      // Default state when consent row doesn't exist yet
      consentByLineId[line.id] = {
        lineId: line.id,
        consentStatus: 'not_requested',
        consentRequestedAt: null,
        historyPreview: [],
      };
    }
  }

  // Record first/last view (non-blocking)
  try {
    const isFirstView = !resolvedAccountState?.first_viewed_at;
    await recordHealthFirstView(account.id);
    if (isFirstView) {
      emitHealthFirstView(account.id);
    }
  } catch (err) {
    logger.warn({ err, accountId: account.id }, 'Failed to record health first view');
  }

  const disclaimerState = {
    isCurrent: isDisclaimerCurrent(resolvedAccountState),
  };

  return (
    <>
      {pageHeader}
      <PageBody>
        <Suspense>
          <HealthProfilePageClient
            account={account}
            lines={lines}
            consentByLineId={consentByLineId}
            entitlementState={entitlementState}
            disclaimerState={disclaimerState}
            initialTabData={initialTabData}
          />
        </Suspense>
      </PageBody>
    </>
  );
}
