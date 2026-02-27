'use client';

import Link from 'next/link';
import { Check, Lock, ShieldAlert } from 'lucide-react';
import { InfoTip } from '~/core/ui/InfoTip';

// Re-export types and constants from tier-utils for client components
export {
  SHARING_TIER_LABELS,
  TIER_REQUIREMENTS,
  type TierAccess,
  type SafetyEvent,
} from './tier-utils';

// Import TIER_REQUIREMENTS for local use
import { TIER_REQUIREMENTS } from './tier-utils';

export function TierGateNotice({
  title,
  requiredTier,
  lineName,
  privacyLabel,
}: {
  title: string;
  requiredTier: keyof typeof TIER_REQUIREMENTS;
  lineName: string;
  privacyLabel?: string;
}) {
  const resolvedPrivacyLabel = privacyLabel ?? 'Privacy: Shared view';
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <Lock className="h-4 w-4 text-primary" />
          </div>
          <p className="max-w-2xl text-sm leading-5 text-muted-foreground">
            Access depends on your selected sharing tier for this line.
          </p>
        </div>
        <span className="inline-flex min-h-8 items-center rounded-full border border-border/70 bg-muted/30 px-3 text-[11px] font-semibold uppercase tracking-wide text-foreground">
          {resolvedPrivacyLabel}
        </span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Available at {TIER_REQUIREMENTS[requiredTier]} {lineName} controls sharing preferences. Request a change{' '}
        <Link
          href="/dashboard/privacy?tab=consent&section=consent-status"
          className="text-primary hover:underline"
        >
          here -&gt;
        </Link>
      </p>
    </div>
  );
}

function formatSafetyAction(action?: string | null) {
  if (!action) return null;
  return action.replace(/_/g, ' ');
}

function getIncidentLabel(event: { category: string | null; eventType: string | null }): string {
  const category = event.category?.toUpperCase();
  if (category === 'PHYSICAL_DANGER') return 'Mobility and physical safety';
  if (category === 'ISOLATION_DISTRESS') return 'Isolation and emotional distress';
  if (category === 'HOPELESSNESS') return 'Hopelessness language';
  if (category === 'GENERAL_CONCERN') return 'General wellbeing concern';

  const eventType = event.eventType?.toLowerCase();
  if (eventType?.includes('fall')) return 'Fall risk and mobility';
  if (eventType?.includes('pain')) return 'Pain and physical discomfort';
  if (eventType?.includes('sleep')) return 'Sleep and fatigue changes';
  if (eventType?.includes('anxiety')) return 'Stress and anxiety';

  return 'General wellbeing concern';
}

function titleCase(value: string): string {
  if (!value) return value;
  return value[0].toUpperCase() + value.slice(1);
}

function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = then - now;
  const minutes = Math.round(diffMs / (1000 * 60));
  const absoluteMinutes = Math.abs(minutes);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (absoluteMinutes < 60) {
    return formatter.format(minutes, 'minute');
  }

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return formatter.format(hours, 'hour');
  }

  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) {
    return formatter.format(days, 'day');
  }

  const months = Math.round(days / 30);
  return formatter.format(months, 'month');
}

const SEVERITY_CHIP_STYLES: Record<'low' | 'medium' | 'high', string> = {
  low: 'border-success/50 bg-success/15 text-foreground',
  medium: 'border-warning/50 bg-warning/15 text-foreground',
  high: 'border-destructive/50 bg-destructive/10 text-foreground',
};

const SEVERITY_STAT_STYLES: Record<'low' | 'medium' | 'high', string> = {
  low: 'border-success/40 bg-success/10',
  medium: 'border-warning/40 bg-warning/10',
  high: 'border-destructive/40 bg-destructive/10',
};

const SEVERITY_BORDER_COLORS: Record<'low' | 'medium' | 'high', string> = {
  low: 'var(--success)',
  medium: 'var(--warning)',
  high: 'var(--destructive)',
};

export function SafetyAlertsCard({
  events,
  timezone,
  highTierOnly,
  privacyLabel,
}: {
  events: Array<{
    id: string;
    occurredAt: string;
    severity: 'low' | 'medium' | 'high';
    actionTaken: string | null;
    eventType: string | null;
    category: string | null;
  }>;
  timezone: string;
  highTierOnly: boolean;
  privacyLabel: string;
}) {
  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: timezone,
    });
  };

  const eventCountBySeverity = events.reduce(
    (acc, event) => {
      acc[event.severity] += 1;
      return acc;
    },
    { low: 0, medium: 0, high: 0 }
  );

  const quickStats = [
    { key: 'high', label: 'High', count: eventCountBySeverity.high },
    { key: 'medium', label: 'Medium', count: eventCountBySeverity.medium },
    { key: 'low', label: 'Low', count: eventCountBySeverity.low },
  ];

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
      <div className="space-y-2 mb-5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Safety Incidents</h3>
          <InfoTip content="Detected in real time during calls when distress keywords or safety concerns are identified. Not related to Wellness Alerts." />
        </div>
        <p className="max-w-2xl text-sm leading-5 text-muted-foreground">
          {highTierOnly
            ? 'Exact timing and details are minimized to reduce personal data exposure.'
            : 'Review incidents to decide whether proactive outreach or care changes are needed.'}
        </p>
        <span className="inline-flex min-h-8 items-center rounded-full border border-border/70 bg-muted/30 px-3 text-[11px] font-semibold uppercase tracking-wide text-foreground">
          {privacyLabel}
        </span>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-3">
        {quickStats.map((stat) => (
          <div
            key={stat.key}
            className={`rounded-xl border px-3 py-2.5 text-center ${
              stat.key === 'high' && stat.count === 0
                ? 'border-success/60 bg-success/20'
                : SEVERITY_STAT_STYLES[stat.key as 'low' | 'medium' | 'high']
            }`}
          >
            <p className="text-lg font-semibold leading-none text-foreground">{stat.count}</p>
            <p className="inline-flex items-center justify-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              {stat.label}
              {stat.key === 'high' && stat.count === 0 && <Check className="h-3 w-3 text-success" />}
            </p>
          </div>
        ))}
      </div>
      {events.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {highTierOnly
            ? 'No high-tier safety incidents in the last 30 days.'
            : 'No safety incidents in the last 30 days.'}
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          <div className="relative">
            <div className="max-h-[400px] space-y-3 overflow-y-auto pr-1 pb-7">
              {events.map((event) => {
                const dateLabel = formatDate(event.occurredAt);
                const relativeTimeLabel = formatRelativeTime(event.occurredAt);
                const actionLabel = formatSafetyAction(event.actionTaken);
                const severityLabel = titleCase(event.severity);
                const incidentLabel = getIncidentLabel(event);
                const borderColor = SEVERITY_BORDER_COLORS[event.severity];
                return (
                  <div
                    key={event.id}
                    className="min-h-12 rounded-xl border border-border/60 border-l-4 bg-muted/20 px-4 py-3.5 text-sm"
                    style={{ borderLeftColor: borderColor }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold leading-5 text-foreground">{incidentLabel}</p>
                      <span
                        className={`hidden min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold lg:inline-flex ${
                          SEVERITY_CHIP_STYLES[event.severity]
                        }`}
                      >
                        Severity: {severityLabel}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {dateLabel} · {relativeTimeLabel}
                    </p>
                    {highTierOnly ? null : (
                      <>
                        {event.eventType && (
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            Type: {event.eventType.replace(/_/g, ' ')}
                          </p>
                        )}
                        {actionLabel && (
                          <p className="mt-1.5 text-xs text-muted-foreground">Action: {actionLabel}</p>
                        )}
                      </>
                    )}
                    <span
                      className={`mt-2 inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold lg:hidden ${
                        SEVERITY_CHIP_STYLES[event.severity]
                      }`}
                    >
                      Severity: {severityLabel}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-xl bg-gradient-to-t from-card to-transparent" />
          </div>
        </div>
      )}
    </div>
  );
}
