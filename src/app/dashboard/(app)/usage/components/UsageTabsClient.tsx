'use client';

import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Clock, DollarSign, Hourglass, ShieldAlert, Timer } from 'lucide-react';

import NavigationMenu from '~/core/ui/Navigation/NavigationMenu';
import NavigationItem from '~/core/ui/Navigation/NavigationItem';
import UsageCapControl from './UsageCapControl';
import type { PerLineUsageEntry } from '~/lib/ultaura/types';

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

type TabValue = 'cycle' | 'per-user' | 'total';

const USAGE_TABS = [
  { value: 'cycle' as const, label: 'This cycle', path: '/dashboard/usage?tab=cycle' },
  { value: 'per-user' as const, label: 'Per user', path: '/dashboard/usage?tab=per-user' },
  { value: 'total' as const, label: 'Total usage', path: '/dashboard/usage?tab=total' },
];

interface UsageTabsProps {
  planName: string;
  isOnTrial: boolean;
  isTrialActive: boolean;
  isTrialExpired: boolean;
  isPayg: boolean;
  trialPlanName: string;
  trialDaysRemaining: number;
  minutesUsed: number;
  minutesIncluded: number;
  minutesRemaining: number;
  overageMinutes: number;
  overageCostCents: number;
  paygCostCents: number;
  usageCostCents: number;
  cycleEnd: string | null;
  hasOverage: boolean;
  includedUsagePercent: number;
  overagePercent: number;
  rateCents: number;
  totalMinutes: number;
  totalCostCents: number;
  accountId: string;
  capCents: number;
  capReached: boolean;
  capPercent: number;
  perLineUsage: PerLineUsageEntry[];
}

export default function UsageTabsClient(props: UsageTabsProps) {
  const searchParams = useSearchParams();

  const tabParam = searchParams.get('tab');
  const activeTab: TabValue =
    tabParam === 'total' ? 'total' :
    tabParam === 'per-user' ? 'per-user' :
    'cycle';

  return (
    <div>
      <NavigationMenu bordered scrollable>
        {USAGE_TABS.map((tab) => (
          <NavigationItem
            key={tab.value}
            active={tab.value === activeTab}
            scroll={false}
            link={{ path: tab.path, label: tab.label }}
          />
        ))}
      </NavigationMenu>

      <div className="mt-4">
        {activeTab === 'per-user' && (
          <PerUserTab perLineUsage={props.perLineUsage} rateCents={props.rateCents} />
        )}
        {activeTab === 'total' && (
          <TotalUsageTab
            totalMinutes={props.totalMinutes}
            totalCostCents={props.totalCostCents}
          />
        )}
        {activeTab === 'cycle' && (
          <CycleTab {...props} />
        )}
      </div>
    </div>
  );
}

function CycleTab(props: UsageTabsProps) {
  const {
    isOnTrial,
    isTrialActive,
    isTrialExpired,
    isPayg,
    minutesUsed,
    minutesIncluded,
    minutesRemaining,
    overageMinutes,
    overageCostCents,
    paygCostCents,
    usageCostCents,
    cycleEnd,
    hasOverage,
    includedUsagePercent,
    overagePercent,
    rateCents,
    accountId,
    capCents,
    capReached,
    capPercent,
  } = props;

  return (
    <div>
      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<Clock className="w-4 h-4" />} label="Minutes Used" value={String(minutesUsed)} />

        {isOnTrial && (
          <StatCard icon={<DollarSign className="w-4 h-4" />} label="Estimated Cost" value="$0.00" />
        )}

        {isPayg && (
          <StatCard
            icon={<DollarSign className="w-4 h-4" />}
            label="Estimated Cost"
            value={formatCurrency(paygCostCents)}
          />
        )}

        {!isOnTrial && !isPayg && (
          <StatCard
            icon={<Hourglass className="w-4 h-4" />}
            label="Minutes Remaining"
            value={String(minutesRemaining)}
          />
        )}
      </div>

      {/* Trial note */}
      {isTrialActive && (
        <p className="mt-3 text-xs text-muted-foreground">
          Unlimited during trial.
        </p>
      )}

      {/* Progress bar — standard plans only */}
      {!isOnTrial && !isPayg && (
        <div className="mt-4 space-y-1.5">
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="flex h-full">
              <div
                className="h-full bg-primary rounded-l-full"
                style={{ width: `${includedUsagePercent}%` }}
              />
              {hasOverage && (
                <div
                  className="h-full bg-warning rounded-r-full"
                  style={{ width: `${overagePercent}%` }}
                />
              )}
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {minutesUsed} of {minutesIncluded} min
            </span>
            {cycleEnd && <span>Cycle ends and minutes reset {cycleEnd}</span>}
          </div>
        </div>
      )}

      {/* Overage callout — standard plans only */}
      {hasOverage && !isOnTrial && !isPayg && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <span className="text-muted-foreground">
            {overageMinutes} min over plan —{' '}
            <span className="font-medium text-foreground">
              {formatCurrency(overageCostCents)}
            </span>{' '}
            at {formatCurrency(rateCents)}/min
          </span>
        </div>
      )}

      {/* Cycle end for PAYG */}
      {isPayg && cycleEnd && (
        <p className="mt-3 text-xs text-muted-foreground">
          Cycle ends and minutes reset {cycleEnd}
        </p>
      )}

      {/* Spending Cap — not shown during trial */}
      {!isOnTrial && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Spending cap
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Stops all calls when overage charges reach your cap.
          </p>
          <UsageCapControl
            accountId={accountId}
            capCents={capCents}
            disabled={isTrialExpired}
          />
          {capCents > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {formatCurrency(usageCostCents)} of{' '}
                  {formatCurrency(capCents)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full ${capReached ? 'bg-warning' : 'bg-primary'}`}
                  style={{ width: `${capPercent}%` }}
                />
              </div>
            </div>
          )}
          {capReached && capCents > 0 && (
            <div className="flex items-center gap-2 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              Cap reached — calls blocked until next cycle or cap update.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TotalUsageTab({
  totalMinutes,
  totalCostCents,
}: {
  totalMinutes: number;
  totalCostCents: number;
}) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<Timer className="w-4 h-4" />} label="Total Minutes" value={String(totalMinutes)} />
        <StatCard icon={<DollarSign className="w-4 h-4" />} label="Total Cost" value={formatCurrency(totalCostCents)} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        All-time usage across all billing cycles.
      </p>
    </div>
  );
}

function PerUserTab({
  perLineUsage,
  rateCents,
}: {
  perLineUsage: PerLineUsageEntry[];
  rateCents: number;
}) {
  if (perLineUsage.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No lines configured yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {perLineUsage.map((entry) => (
        <div
          key={entry.lineId}
          className="relative overflow-hidden rounded-xl bg-card p-5 card-border-accent"
        >
          <div className="absolute -top-8 -right-8 w-16 h-16 bg-primary/5 rounded-full blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-semibold text-foreground">{entry.displayName}</span>
              {entry.status !== 'active' && (
                <span className="text-xs text-muted-foreground capitalize">({entry.status})</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">This cycle</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{entry.cycleMinutes}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">All-time</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{entry.totalMinutes}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Est. cost</p>
                <p className="text-lg font-bold text-foreground tabular-nums">
                  {formatCurrency(entry.totalMinutes * rateCents)}
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
      <p className="mt-3 text-xs text-muted-foreground">
        Minutes are pooled across all lines.
      </p>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const isNumeric = /^\$?\d/.test(value);

  return (
    <div className="relative overflow-hidden rounded-xl bg-card p-5 card-border-accent">
      <div className="absolute -top-8 -right-8 w-16 h-16 bg-primary/5 rounded-full blur-2xl" />
      <div className="relative flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-primary">{icon}</span>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        {isNumeric ? (
          <div className="text-2xl font-bold text-foreground tracking-tight tabular-nums">
            {value}
          </div>
        ) : (
          <div className="text-base font-semibold text-foreground">
            {value}
          </div>
        )}
      </div>
    </div>
  );
}
