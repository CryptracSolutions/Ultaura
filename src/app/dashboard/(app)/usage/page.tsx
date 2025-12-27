import { AlertTriangle, Clock, DollarSign, ShieldAlert, Zap } from 'lucide-react';
import Link from 'next/link';

import AppHeader from '../components/AppHeader';
import { PageBody } from '~/core/ui/Page';
import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import { getUltauraAccount, getUsageSummary } from '~/lib/ultaura/actions';
import { BILLING, PLANS } from '~/lib/ultaura/constants';
import UsageCapControl from './components/UsageCapControl';

export const metadata = {
  title: 'Usage - Ultaura',
};

const RATE_CENTS = BILLING.OVERAGE_RATE_CENTS;

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatCycleDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
                Start a free trial to activate minute tracking and spending caps.
              </p>
            </div>
          </div>
        </PageBody>
      </>
    );
  }

  const usage = await getUsageSummary(account.id);
  const plan = PLANS[account.plan_id as keyof typeof PLANS];
  const isPayg = account.plan_id === 'payg';
  const planName = isPayg ? 'Pay as you go' : plan?.displayName ?? 'Plan';

  const minutesIncluded = usage?.minutesIncluded ?? 0;
  const minutesUsed = usage?.minutesUsed ?? 0;
  const overageMinutes = usage?.overageMinutes ?? 0;
  const minutesRemaining = usage?.minutesRemaining ?? 0;
  const cycleEnd = formatCycleDate(usage?.cycleEnd ?? null);

  const overageCostCents = overageMinutes * RATE_CENTS;
  const paygCostCents = minutesUsed * RATE_CENTS;
  const usageCostCents = isPayg ? paygCostCents : overageCostCents;

  const capCents = account.overage_cents_cap ?? 0;
  const capReached = capCents > 0 && usageCostCents >= capCents;
  const capPercent = capCents > 0 ? Math.min((usageCostCents / capCents) * 100, 100) : 0;

  const includedUsagePercent =
    minutesIncluded > 0 ? Math.min((Math.min(minutesUsed, minutesIncluded) / minutesIncluded) * 100, 100) : 0;
  const overagePercent =
    minutesIncluded > 0 ? Math.min((overageMinutes / minutesIncluded) * 100, 100) : 0;

  const hasOverage = !isPayg && overageMinutes > 0;

  return (
    <>
      <AppHeader title="Usage" description="Track minutes, overages, and spending caps" />
      <PageBody>
        <div className="flex flex-col gap-6 pb-24">
          <div className="grid gap-6 lg:grid-cols-3">
            <div
              className={`rounded-xl border bg-card p-6 shadow-sm lg:col-span-2 ${
                hasOverage ? 'border-warning/40' : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      isPayg
                        ? 'bg-primary/10 text-primary'
                        : hasOverage
                        ? 'bg-warning/10 text-warning'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {isPayg ? <Zap className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">{planName} plan</div>
                    <h2 className="text-lg font-semibold text-foreground">Usage this cycle</h2>
                  </div>
                </div>
                {hasOverage && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Overage active
                  </div>
                )}
              </div>

              {usage ? (
                <div className="mt-6 space-y-4">
                  {isPayg ? (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-lg border border-border/60 bg-background p-4">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            Minutes used
                          </div>
                          <div className="mt-2 text-3xl font-semibold text-foreground">
                            {minutesUsed}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border/60 bg-background p-4">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            Estimated cost
                          </div>
                          <div className="mt-2 text-3xl font-semibold text-foreground">
                            {formatCurrency(paygCostCents)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <DollarSign className="h-4 w-4" />
                        Usage-based billing at {formatCurrency(RATE_CENTS)} per minute.
                      </div>
                      {cycleEnd && (
                        <div className="text-xs text-muted-foreground">
                          Current cycle ends {cycleEnd}.
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap justify-between gap-4">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            Minutes used
                          </div>
                          <div className="mt-2 text-3xl font-semibold text-primary">
                            {minutesUsed}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            Minutes remaining
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-foreground">
                            {minutesRemaining}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="relative h-3 w-full overflow-visible rounded-full bg-muted">
                          <div className="absolute inset-0 flex overflow-visible">
                            <div
                              className={`h-3 ${hasOverage ? 'rounded-l-full' : 'rounded-full'} bg-primary`}
                              style={{ width: `${includedUsagePercent}%` }}
                            />
                            {hasOverage && (
                              <div
                                className="h-3 rounded-r-full bg-warning"
                                style={{ width: `${overagePercent}%` }}
                              />
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {hasOverage ? `${overageMinutes} over • ` : ''}
                          {cycleEnd ? `Resets ${cycleEnd}` : ''}
                        </div>
                        <Link
                          href="/dashboard/settings/subscription"
                          className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                        >
                          Change Plan →
                        </Link>
                      </div>

                      {hasOverage && (
                        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-warning">
                            <AlertTriangle className="h-4 w-4" />
                            Overage cost
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-foreground">
                            {formatCurrency(overageCostCents)}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            Billed at {formatCurrency(RATE_CENTS)} per minute over your included
                            minutes.
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="mt-6 text-sm text-muted-foreground">Usage not available yet.</div>
              )}
            </div>

            <div
              className={`rounded-xl border bg-card p-6 shadow-sm flex flex-col ${
                capReached ? 'border-warning/40' : 'border-border'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Spending cap</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Stop all calls when usage hits your monthly cap.
              </p>

              <div className="mt-4">
                <UsageCapControl accountId={account.id} capCents={capCents} />
              </div>

              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{capCents > 0 ? `Cap at ${formatCurrency(capCents)}` : 'No cap set'}</span>
                  {capCents > 0 && <span>{formatCurrency(usageCostCents)} used</span>}
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${capReached ? 'bg-warning' : 'bg-primary'}`}
                    style={{ width: `${capPercent}%` }}
                  />
                </div>
                {capCents === 0 && (
                  <div className="text-xs text-muted-foreground">
                    Usage continues without a spending limit.
                  </div>
                )}
                {capReached && capCents > 0 && (
                  <div className="flex items-center gap-2 text-xs text-warning">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Cap reached. Calls are blocked until the next cycle or cap update.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </PageBody>
    </>
  );
}
