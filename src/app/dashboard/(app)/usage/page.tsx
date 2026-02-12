import Link from 'next/link';

import AppHeader from '../components/AppHeader';
import { PageBody } from '~/core/ui/Page';
import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import { getUltauraAccount } from '~/lib/ultaura/accounts';
import { getUsageSummary, getTotalUsage, getPerLineUsage } from '~/lib/ultaura/usage';
import { BILLING, PLANS } from '~/lib/ultaura/constants';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { TrialStatusBadge } from '~/components/ultaura/TrialStatusBadge';
import UsageTabsClient from './components/UsageTabsClient';

export const metadata = {
  title: 'Usage - Ultaura',
};

const RATE_CENTS = BILLING.OVERAGE_RATE_CENTS;

function formatCycleDate(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

export default async function UsagePage() {
  const appData = await loadAppDataForUser();
  const organizationId = appData.organization?.id;

  if (!organizationId) {
    return (
      <PageBody>
        <div className="py-8">
          <p className="text-muted-foreground">Organization not found.</p>
        </div>
      </PageBody>
    );
  }

  const account = await getUltauraAccount(organizationId);

  if (!account) {
    return (
      <>
        <AppHeader title="Usage" description="Track minutes, overages, and spending caps" />
        <PageBody>
          <div className="py-8">
            <div className="max-w-lg rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground">
                Set up Ultaura to see usage
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Start a 14-day free trial to activate minute tracking and spending caps.
              </p>
            </div>
          </div>
        </PageBody>
      </>
    );
  }

  const [usage, totalUsage, perLineUsage] = await Promise.all([
    getUsageSummary(account.id),
    getTotalUsage(account.id),
    getPerLineUsage(account.id),
  ]);

  const plan = PLANS[account.plan_id as keyof typeof PLANS];
  const isPayg = account.plan_id === 'payg';
  const planName = plan?.displayName ?? 'Plan';

  const isOnTrial = account.status === 'trial';
  const trialEndsAt = account.trial_ends_at ?? account.cycle_end ?? null;
  const msRemaining = isOnTrial && trialEndsAt ? new Date(trialEndsAt).getTime() - Date.now() : 0;
  const isTrialExpired = isOnTrial && !!trialEndsAt && msRemaining <= 0;
  const isTrialActive = isOnTrial && !!trialEndsAt && msRemaining > 0;
  const trialDaysRemaining = isTrialActive
    ? Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)))
    : 0;
  const trialPlanId = (account.trial_plan_id ?? account.plan_id) as keyof typeof PLANS;
  const trialPlanName = PLANS[trialPlanId]?.displayName ?? 'Trial';

  const minutesIncluded = usage?.minutesIncluded ?? 0;
  const minutesUsed = usage?.minutesUsed ?? 0;
  const overageMinutes = usage?.overageMinutes ?? 0;
  const minutesRemaining = usage?.minutesRemaining ?? 0;
  const cycleEnd = formatCycleDate(usage?.cycleEnd ?? null);

  const overageCostCents = overageMinutes * RATE_CENTS;
  const paygCostCents = minutesUsed * RATE_CENTS;
  const usageCostCents = isOnTrial ? 0 : isPayg ? paygCostCents : overageCostCents;

  const capCents = account.overage_cents_cap ?? 0;
  const capReached = capCents > 0 && usageCostCents >= capCents;
  const capPercent = capCents > 0 ? Math.min((usageCostCents / capCents) * 100, 100) : 0;

  const includedUsagePercent =
    !isOnTrial && minutesIncluded > 0
      ? Math.min((Math.min(minutesUsed, minutesIncluded) / minutesIncluded) * 100, 100)
      : 0;
  const overagePercent =
    !isOnTrial && minutesIncluded > 0 ? Math.min((overageMinutes / minutesIncluded) * 100, 100) : 0;

  const hasOverage = !isOnTrial && !isPayg && overageMinutes > 0;

  return (
    <>
      <AppHeader title="Usage" description="Track minutes, overages, and spending caps">
        {isTrialActive ? (
          <TrialStatusBadge daysRemaining={trialDaysRemaining} planName={trialPlanName} />
        ) : null}
      </AppHeader>
      <PageBody>
        <div className="flex flex-col gap-6 pb-24">
          {isTrialExpired ? <TrialExpiredBanner trialPlanName={trialPlanName} /> : null}

          {/* Plan info strip + tabs */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="ml-1 font-medium text-foreground">
                {isOnTrial ? `${trialPlanName} trial` : `${planName} plan`}
              </span>
              {!isOnTrial && (
                <Link
                  href="/dashboard/settings/subscription"
                  className="text-primary hover:underline"
                >
                  Change plan
                </Link>
              )}
            </div>
            {usage ? (
            <UsageTabsClient
              planName={planName}
              isOnTrial={isOnTrial}
              isTrialActive={isTrialActive}
              isTrialExpired={isTrialExpired}
              isPayg={isPayg}
              trialPlanName={trialPlanName}
              trialDaysRemaining={trialDaysRemaining}
              minutesUsed={minutesUsed}
              minutesIncluded={minutesIncluded}
              minutesRemaining={minutesRemaining}
              overageMinutes={overageMinutes}
              overageCostCents={overageCostCents}
              paygCostCents={paygCostCents}
              usageCostCents={usageCostCents}
              cycleEnd={cycleEnd}
              hasOverage={hasOverage}
              includedUsagePercent={includedUsagePercent}
              overagePercent={overagePercent}
              rateCents={RATE_CENTS}
              totalMinutes={totalUsage.totalMinutes}
              totalCostCents={totalUsage.totalCostCents}
              accountId={account.id}
              capCents={capCents}
              capReached={capReached}
              capPercent={capPercent}
              perLineUsage={perLineUsage}
            />
          ) : (
              <div className="text-sm text-muted-foreground">Usage not available yet.</div>
            )}
          </div>
        </div>
      </PageBody>
    </>
  );
}
