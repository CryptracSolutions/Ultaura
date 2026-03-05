'use client';

import {
  Phone,
  Calendar,
  PhoneCall,
  Clock,
  Bell,
  ChevronDown,
} from 'lucide-react';
import type {
  LineRow,
  UsageSummary,
  LineUsageSummary,
  CallSessionRow,
} from '~/lib/ultaura/types';
import { CallActivityList } from './components/CallActivityList';
import { LineHeaderActions } from './components/LineHeaderActions';
import { LinePageHeader } from './components/LinePageHeader';

const CARD_CLASS = 'bg-card rounded-xl border border-border p-6';
const CARD_HEADER_CLASS = 'flex items-center gap-2';
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
  warning?: boolean;
}

function StatCard({ icon, label, value, subtext, warning = false }: StatCardProps): JSX.Element {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-card p-5 card-border-accent ${warning ? 'ring-1 ring-amber-500/40' : ''}`}>
      {/* Subtle corner accent */}
      <div className="absolute -top-8 -right-8 w-16 h-16 bg-primary/5 rounded-full blur-2xl" />

      <div className="relative flex flex-col">
        {/* Label row with icon */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-primary">{icon}</span>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>

        {/* Value */}
        <div className="text-base font-semibold text-foreground">
          {value}
        </div>

        {/* Subtext */}
        {subtext && (
          <div className={`mt-auto pt-2 text-xs ${warning ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
}

interface LineDetailClientProps {
  line: LineRow;
  lines: LineRow[];
  usage: UsageSummary | null;
  lineUsage: LineUsageSummary | null;
  callSessions: CallSessionRow[];
  activeSchedulesCount: number;
  pendingRemindersCount: number;
  reminderLimitPerLine: number | null;
  milestonesCount: number;
  trustedContactsCount: number;
  isReadOnly?: boolean;
  isTrialActive?: boolean;
  isFamilyManaged?: boolean;
}

export function LineDetailClient({
  line,
  lines,
  usage,
  lineUsage,
  callSessions,
  activeSchedulesCount,
  pendingRemindersCount,
  reminderLimitPerLine,
  isReadOnly = false,
  isTrialActive = false,
  isFamilyManaged = false,
}: LineDetailClientProps) {
  // Calculate quick stats
  const getLastCallDisplay = (): string => {
    const latestStartedAt = callSessions.reduce<string | null>((latest, session) => {
      if (!session.started_at) return latest;
      if (!latest) return session.started_at;
      return new Date(session.started_at).getTime() > new Date(latest).getTime()
        ? session.started_at
        : latest;
    }, null);

    if (!latestStartedAt) return 'No calls yet';

    const lastCallDate = new Date(latestStartedAt);
    const now = new Date();
    const diffMs = now.getTime() - lastCallDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return lastCallDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const nextScheduledCall = activeSchedulesCount > 0 ? 'Scheduled' : 'Not scheduled';
  const cycleMinutes = lineUsage?.cycleMinutes ?? 0;
  const totalMinutesLine = lineUsage?.totalMinutes ?? 0;
  const isReminderLimitReached = reminderLimitPerLine !== null && pendingRemindersCount >= reminderLimitPerLine;
  const reminderValue = `${pendingRemindersCount} active reminders`;
  const reminderSubtext = reminderLimitPerLine === null
    ? 'Unlimited'
    : `${reminderLimitPerLine} allowed`;

  return (
    <div className="w-full">
      <LinePageHeader
        lines={lines}
        currentLineShortId={line.short_id}
      />

      {/* Overview Content */}
      <div className="space-y-6 mt-6">
        {/* Tab description note */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            At-a-glance summary of call activity and key metrics for this line.
          </p>
          <LineHeaderActions
            line={line}
            usage={usage}
            isReadOnly={isReadOnly}
            isTrialActive={isTrialActive}
          />
        </div>
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Calendar className="w-4 h-4" />}
            label="Next Call"
            value={nextScheduledCall}
            subtext={activeSchedulesCount > 0 ? `${activeSchedulesCount} active schedule${activeSchedulesCount !== 1 ? 's' : ''}` : undefined}
          />
          <StatCard
            icon={<PhoneCall className="w-4 h-4" />}
            label="Last Call"
            value={getLastCallDisplay()}
          />
          <StatCard
            icon={<Clock className="w-4 h-4" />}
            label="Minutes Used"
            value={String(cycleMinutes)}
            subtext={`${totalMinutesLine} min all-time`}
          />
          <StatCard
            icon={<Bell className="w-4 h-4" />}
            label="Active Reminders"
            value={reminderValue}
            subtext={reminderSubtext}
            warning={isReminderLimitReached}
          />
        </div>

        {/* Recent Calls */}
        <details className={`${CARD_CLASS} group`}>
          <summary className="flex items-center justify-between gap-3 cursor-pointer select-none [&::-webkit-details-marker]:hidden">
            <div className={`${CARD_HEADER_CLASS}`}>
              <Phone className="w-5 h-5 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">All Calls</h2>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-6">
            <CallActivityList sessions={callSessions} />
          </div>
        </details>
      </div>

      {/* Bottom spacer */}
      <div className="h-16" />
    </div>
  );
}
