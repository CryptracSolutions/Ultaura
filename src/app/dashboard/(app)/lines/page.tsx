import { Metadata } from 'next';
import { Suspense } from 'react';
import { getUltauraAccount, getLines, getUsageSummary } from '~/lib/ultaura/actions';
import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import { LinesPageClient } from './components/LinesPageClient';
import { UsageCard } from './components/UsageCard';
import { AlertBanner } from './components/AlertBanner';

export const metadata: Metadata = {
  title: 'Lines - Ultaura',
};

export default async function LinesPage() {
  const appData = await loadAppDataForUser();
  const organizationId = appData.organization?.id;

  if (!organizationId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Organization not found.</p>
      </div>
    );
  }

  // Get Ultaura account
  const account = await getUltauraAccount(organizationId);

  if (!account) {
    return (
      <div className="p-6">
        <div className="max-w-lg mx-auto text-center">
          <h1 className="text-2xl font-semibold mb-4">Get Started with Ultaura</h1>
          <p className="text-muted-foreground mb-6">
            Set up phone companionship for your loved ones. Start with a free trial.
          </p>
          <a
            href="/dashboard/settings/subscription"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Start Free Trial
          </a>
        </div>
      </div>
    );
  }

  // Get lines and usage
  const [lines, usage] = await Promise.all([
    getLines(account.id),
    getUsageSummary(account.id),
  ]);

  // Determine if we should show any alerts
  const showTrialAlert = account.status === 'trial' && usage && usage.minutesRemaining <= 5;
  const showLowMinutesAlert = account.status !== 'trial' && usage && usage.minutesRemaining <= 15;

  return (
    <div className="p-6 space-y-6">
      {/* Alerts */}
      {showTrialAlert && (
        <AlertBanner
          type="warning"
          title="Trial ending soon"
          message={`You have ${usage.minutesRemaining} minutes remaining in your trial.`}
          actionLabel="Upgrade Plan"
          actionHref="/dashboard/settings/subscription"
        />
      )}
      {showLowMinutesAlert && (
        <AlertBanner
          type="warning"
          title="Minutes running low"
          message={`You have ${usage.minutesRemaining} minutes remaining this month.`}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Phone Lines</h1>
          <p className="text-muted-foreground mt-1">
            Manage phone numbers for your loved ones
          </p>
        </div>
      </div>

      {/* Usage Summary */}
      {usage && (
        <Suspense fallback={<div className="h-32 w-full rounded-lg bg-muted animate-pulse" />}>
          <UsageCard
            minutesIncluded={usage.minutesIncluded}
            minutesUsed={usage.minutesUsed}
            minutesRemaining={usage.minutesRemaining}
            planName={account.plan_id === 'free_trial' ? 'Free Trial' : account.plan_id}
            cycleEnd={usage.cycleEnd}
          />
        </Suspense>
      )}

      {/* Lines List */}
      <Suspense fallback={<LinesListSkeleton />}>
        <LinesPageClient
          accountId={account.id}
          lines={lines}
          planLinesLimit={getPlanLinesLimit(account.plan_id)}
        />
      </Suspense>
    </div>
  );
}

function getPlanLinesLimit(planId: string): number {
  switch (planId) {
    case 'free_trial':
    case 'care':
      return 1;
    case 'comfort':
      return 2;
    case 'family':
    case 'payg':
      return 4;
    default:
      return 1;
  }
}

function LinesListSkeleton() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg border border-border p-4 shadow-sm space-y-3 animate-pulse"
        >
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-3 w-5/6 rounded bg-muted" />
            <div className="h-3 w-2/3 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
