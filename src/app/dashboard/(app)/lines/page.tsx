import { Metadata } from 'next';
import { Suspense } from 'react';
import { getUltauraAccount } from '~/lib/ultaura/accounts';
import { getLines } from '~/lib/ultaura/lines';
import { getUsageSummary } from '~/lib/ultaura/usage';
import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import { LinesPageClient } from './components/LinesPageClient';
import { AlertBanner } from './components/AlertBanner';
import AppHeader from '../components/AppHeader';
import { PageBody } from '~/core/ui/Page';
import { PLANS } from '~/lib/ultaura/constants';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { TrialStatusBadge } from '~/components/ultaura/TrialStatusBadge';

export const metadata: Metadata = {
  title: 'Lines - Ultaura',
};

export default async function LinesPage() {
  const appData = await loadAppDataForUser();
  const organizationId = appData.organization?.id;

  if (!organizationId) {
    return (
      <>
        <AppHeader title="Phone Lines" description="Manage phone numbers for your loved ones" />
        <PageBody>
          <p className="text-muted-foreground">Organization not found.</p>
        </PageBody>
      </>
    );
  }

  // Get Ultaura account
  const account = await getUltauraAccount(organizationId);

  if (!account) {
    return (
      <>
        <AppHeader title="Phone Lines" description="Manage phone numbers for your loved ones" />
        <PageBody>
          <div className="max-w-lg mx-auto text-center py-8">
            <h2 className="text-2xl font-semibold mb-4">Get Started with Ultaura</h2>
            <p className="text-muted-foreground mb-6">
              Set up phone companionship for your loved ones. Start with a 3-day free trial.
            </p>
            <a
              href="/dashboard/settings/subscription"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Start 3-day free trial
            </a>
          </div>
        </PageBody>
      </>
    );
  }

  // Get lines and usage
  const [lines, usage] = await Promise.all([
    getLines(account.id),
    getUsageSummary(account.id),
  ]);

  const isOnTrial = account.status === 'trial';
  const trialEndsAt = account.trial_ends_at ?? account.cycle_end ?? null;
  const msRemaining = trialEndsAt ? new Date(trialEndsAt).getTime() - Date.now() : 0;
  const isTrialExpired = isOnTrial && !!trialEndsAt && msRemaining <= 0;
  const trialDaysRemaining =
    isOnTrial && trialEndsAt ? Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000))) : 0;

  const trialPlanId = (account.trial_plan_id ?? account.plan_id) as keyof typeof PLANS;
  const trialPlanName = PLANS[trialPlanId]?.displayName ?? 'Trial';

  // Determine if we should show any alerts
  const isPayg = account.plan_id === 'payg';
  const showLowMinutesAlert = !isPayg && account.status !== 'trial' && usage && usage.minutesRemaining <= 15;

  return (
    <>
      <AppHeader title="Phone Lines" description="Manage phone numbers for your loved ones">
        {isOnTrial && !isTrialExpired ? (
          <TrialStatusBadge daysRemaining={trialDaysRemaining} planName={trialPlanName} />
        ) : null}
      </AppHeader>
      <PageBody>
        <div className="space-y-6">
          {isTrialExpired && <TrialExpiredBanner trialPlanName={trialPlanName} />}

          {/* Alerts */}
          {showLowMinutesAlert && (
            <AlertBanner
              type="warning"
              title="Minutes running low"
              message={`You have ${usage.minutesRemaining} minutes remaining this month.`}
            />
          )}

          {/* Lines List */}
          <Suspense fallback={<LinesListSkeleton />}>
            <LinesPageClient
              accountId={account.id}
              lines={lines}
              planLinesLimit={getPlanLinesLimit(account.plan_id ?? 'free_trial')}
              disabled={isTrialExpired}
            />
          </Suspense>
        </div>
      </PageBody>
    </>
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
