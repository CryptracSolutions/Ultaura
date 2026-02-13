'use client';

import { useSearchParams } from 'next/navigation';
import { AlertTriangle, BarChart3, Clock, DollarSign, Hourglass, ShieldAlert, User } from 'lucide-react';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { TooltipProps } from 'recharts';

import NavigationMenu from '~/core/ui/Navigation/NavigationMenu';
import NavigationItem from '~/core/ui/Navigation/NavigationItem';
import UsageCapControl from './UsageCapControl';
import type { PerLineUsageEntry, MonthlyUsageEntry } from '~/lib/ultaura/types';

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

type TabValue = 'cycle' | 'per-user' | 'total';

const USAGE_TABS = [
  { value: 'cycle' as const, label: 'This cycle', path: '/dashboard/usage?tab=cycle' },
  { value: 'total' as const, label: 'Total usage', path: '/dashboard/usage?tab=total' },
  { value: 'per-user' as const, label: 'Per user', path: '/dashboard/usage?tab=per-user' },
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
  trialMinutes: number;
  includedMinutes: number;
  totalOverageMinutes: number;
  paygMinutes: number;
  monthlyUsage: MonthlyUsageEntry[];
}

export default function UsageTabsClient(props: UsageTabsProps) {
  const searchParams = useSearchParams();

  const tabParam = searchParams.get('tab');
  const validTabs: TabValue[] = ['total', 'per-user', 'cycle'];
  const activeTab: TabValue = validTabs.includes(tabParam as TabValue)
    ? (tabParam as TabValue)
    : 'cycle';

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
          <PerUserTab perLineUsage={props.perLineUsage} />
        )}
        {activeTab === 'total' && (
          <TotalUsageTab
            totalMinutes={props.totalMinutes}
            totalCostCents={props.totalCostCents}
            trialMinutes={props.trialMinutes}
            includedMinutes={props.includedMinutes}
            totalOverageMinutes={props.totalOverageMinutes}
            paygMinutes={props.paygMinutes}
            monthlyUsage={props.monthlyUsage}
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
    <div className="space-y-3">
      {/* Progress bar — standard plans only */}
      {!isOnTrial && !isPayg && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">
                {minutesUsed} of {minutesIncluded} min
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {Math.round(includedUsagePercent)}% used
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={minutesUsed}
              aria-valuemin={0}
              aria-valuemax={minutesIncluded}
              aria-label={`${minutesUsed} of ${minutesIncluded} minutes used`}
              className="h-4 w-full rounded-full bg-muted overflow-hidden"
            >
              <div className="flex h-full transition-all duration-500 ease-out">
                <div
                  className={`h-full rounded-l-full transition-colors duration-300 ${
                    hasOverage
                      ? 'bg-primary'
                      : includedUsagePercent > 80
                        ? 'bg-warning'
                        : 'bg-primary'
                  }`}
                  style={{ width: `${includedUsagePercent}%` }}
                />
                {hasOverage && (
                  <div
                    className="h-full bg-destructive rounded-r-full"
                    style={{ width: `${overagePercent}%` }}
                  />
                )}
              </div>
            </div>
            {cycleEnd && (
              <p className="text-xs text-muted-foreground">
                Cycle ends and minutes reset {cycleEnd}
              </p>
            )}
          </div>
        </div>
      )}

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
        <p className="text-xs text-muted-foreground">
          Unlimited during trial.
        </p>
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
        <div className="mt-6 relative overflow-hidden rounded-xl border border-border bg-card p-5">
          <div className="absolute -top-8 -right-8 w-16 h-16 bg-primary/5 rounded-full blur-2xl" />
          <div className="relative flex flex-col space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-primary">
                <ShieldAlert className="w-4 h-4" />
              </span>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Spending cap
              </span>
            </div>
            <UsageCapControl
              accountId={accountId}
              capCents={capCents}
              disabled={isTrialExpired}
            />
            {capCents > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {formatCurrency(usageCostCents)} of {formatCurrency(capCents)}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {Math.round(capPercent)}% used
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={usageCostCents}
                  aria-valuemin={0}
                  aria-valuemax={capCents}
                  aria-label={`${formatCurrency(usageCostCents)} of ${formatCurrency(capCents)} spending cap used`}
                  className="h-4 w-full rounded-full bg-muted overflow-hidden"
                >
                  <div className="flex h-full transition-all duration-500 ease-out">
                    <div
                      className={`h-full rounded-l-full transition-colors duration-300 ${
                        capReached ? 'bg-destructive' : capPercent > 80 ? 'bg-warning' : 'bg-primary'
                      }`}
                      style={{ width: `${capPercent}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Stops all calls when overage charges reach your cap
                </p>
              </div>
            )}
            {capReached && capCents > 0 && (
              <div className="flex items-center gap-2 text-xs text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                Cap reached — calls blocked until next cycle or cap update.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatMonthLabel(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-');
  const date = new Date(Number(year), Number(month) - 1);
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(date);
}

interface TotalUsageTabProps {
  totalMinutes: number;
  totalCostCents: number;
  trialMinutes: number;
  includedMinutes: number;
  totalOverageMinutes: number;
  paygMinutes: number;
  monthlyUsage: MonthlyUsageEntry[];
}

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const nonZero = payload.filter((p) => (p.value ?? 0) > 0);
  if (nonZero.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card px-3.5 py-2.5 shadow-lg">
      <p className="text-xs font-medium text-foreground mb-1.5">
        {formatMonthLabel(label as string)}
      </p>
      <div className="space-y-1">
        {nonZero.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-muted-foreground">{entry.name}</span>
            </div>
            <span className="text-xs font-medium text-foreground tabular-nums">
              {entry.value} min
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TotalUsageTab({
  totalMinutes,
  totalCostCents,
  trialMinutes,
  includedMinutes,
  totalOverageMinutes,
  paygMinutes,
  monthlyUsage,
}: TotalUsageTabProps) {
  const hasIncluded = monthlyUsage.some((m) => m.includedMinutes > 0);
  const hasTrial = monthlyUsage.some((m) => m.trialMinutes > 0);
  const hasPayg = monthlyUsage.some((m) => m.paygMinutes > 0);
  const hasOverage = monthlyUsage.some((m) => m.overageMinutes > 0);

  const stackOrder: { key: string; name: string; color: string; show: boolean }[] = [
    { key: 'includedMinutes', name: 'Included', color: 'var(--chart-1)', show: hasIncluded },
    { key: 'trialMinutes', name: 'Trial', color: 'var(--chart-3)', show: hasTrial },
    { key: 'paygMinutes', name: 'Pay As You Go', color: 'oklch(0.72 0.19 350)', show: hasPayg },
    { key: 'overageMinutes', name: 'Overage', color: 'var(--chart-4)', show: hasOverage },
  ];
  const visibleBars = stackOrder.filter((b) => b.show);
  const lastBarKey = visibleBars.at(-1)?.key ?? null;

  return (
    <div className="space-y-5">
      {/* Section 1 — Top-level totals */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Clock className="w-4 h-4" />}
          label="Total Minutes"
          value={`${totalMinutes} min`}
          subtitle="Sum of all call minutes since your first call"
        />
        <StatCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Total Cost"
          value={formatCurrency(totalCostCents)}
          subtitle="Overage and pay-as-you-go charges only — included and trial minutes are free"
        />
      </div>

      {/* Monthly history chart */}
      {monthlyUsage.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 pb-4">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="text-primary"><BarChart3 className="w-4 h-4" /></span>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Monthly usage history
              </h3>
            </div>
            {/* Inline legend */}
            <div className="flex items-center gap-3">
              {visibleBars.map((bar) => (
                <div key={bar.key} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: bar.color }}
                  />
                  <span className="text-[11px] text-muted-foreground">{bar.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyUsage}
                margin={{ top: 4, right: 4, bottom: 0, left: -12 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border)"
                  strokeOpacity={0.5}
                />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonthLabel}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                  dy={8}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                  dx={-4}
                  allowDecimals={false}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
                />
                {visibleBars.map((bar) => (
                  <Bar
                    key={bar.key}
                    dataKey={bar.key}
                    name={bar.name}
                    stackId="a"
                    fill={bar.color}
                    maxBarSize={48}
                    radius={bar.key === lastBarKey ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

interface PerUserTabProps {
  perLineUsage: PerLineUsageEntry[];
}

function PerUserTab({ perLineUsage }: PerUserTabProps) {
  if (perLineUsage.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No lines configured yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Minutes are pooled across all lines
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {perLineUsage.map((entry) => (
          <div
            key={entry.lineId}
            className="relative overflow-hidden rounded-xl border border-border bg-card p-5"
          >
          <div className="absolute -top-8 -right-8 w-16 h-16 bg-primary/5 rounded-full blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-primary">
                <User className="h-4 w-4" />
              </span>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{entry.displayName}</span>
              {entry.status !== 'active' && (
                <span className="text-xs text-muted-foreground capitalize">({entry.status})</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Minutes this cycle</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{entry.cycleMinutes}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Minutes all-time</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{entry.totalMinutes}</p>
              </div>
            </div>
          </div>
        </div>
        ))}
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
}

function StatCard({ icon, label, value, subtitle }: StatCardProps) {
  const isNumeric = /^\$?\d/.test(value);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
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
        {subtitle && (
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
