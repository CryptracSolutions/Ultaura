'use client';

import { Clock } from 'lucide-react';
import { cn } from '~/core/generic/shadcn-utils';
import { StatusPill } from './StatusPill';
import type { StatusPillProps } from './StatusPill';

interface AutomationItemCardProps {
  /** Primary label - days+time for schedules, message for reminders */
  title: string;
  /** Optional icon before title (e.g., CalendarClock for one-time) */
  titleIcon?: React.ComponentType<{ className?: string }>;
  /** Datetime string */
  dateTimeLabel: string;
  /** Prefix before datetime (e.g., "Next:" or "Scheduled:") */
  dateTimePrefix?: string;
  /** Additional line below datetime */
  secondaryText?: string;
  /** Status pills */
  pills?: StatusPillProps[];
  /** Warning border for paused items */
  highlighted?: boolean;
  /** Reduced opacity for past/inactive items */
  faded?: boolean;
  /** Action menu or button rendered in right column */
  actionMenu?: React.ReactNode;
  className?: string;
}

export function AutomationItemCard({
  title,
  titleIcon: TitleIcon,
  dateTimeLabel,
  dateTimePrefix,
  secondaryText,
  pills,
  highlighted,
  faded,
  actionMenu,
  className,
}: AutomationItemCardProps) {
  return (
    <div
      className={cn(
        'p-4 rounded-lg border bg-card flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        highlighted
          ? 'border-yellow-300 dark:border-yellow-700'
          : 'border-input',
        faded && 'bg-card/50 opacity-75',
        className,
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {TitleIcon && <TitleIcon className="w-4 h-4 text-muted-foreground" />}
          <p className={cn('text-foreground', TitleIcon && 'font-medium')}>{title}</p>
        </div>
        <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {dateTimePrefix && `${dateTimePrefix} `}{dateTimeLabel}
          </span>

          {pills?.map((pill, index) => (
            <StatusPill key={index} {...pill} />
          ))}
        </div>
        {secondaryText && (
          <div className="mt-1 text-xs text-muted-foreground">
            {secondaryText}
          </div>
        )}
      </div>

      {actionMenu && (
        <div className="flex items-center gap-2 shrink-0">
          {actionMenu}
        </div>
      )}
    </div>
  );
}
