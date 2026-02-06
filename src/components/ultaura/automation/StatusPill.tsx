'use client';

import { cn } from '~/core/generic/shadcn-utils';

export type StatusPillVariant =
  | 'paused'
  | 'snoozed'
  | 'recurring'
  | 'scheduled'
  | 'sent'
  | 'missed'
  | 'canceled';

export interface StatusPillProps {
  variant: StatusPillVariant;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  faded?: boolean;
}

const VARIANT_COLORS: Record<StatusPillVariant, string> = {
  paused:    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  snoozed:   'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  recurring: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  sent:      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  missed:    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  canceled:  'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

// Faded versions for past/inactive items
const VARIANT_COLORS_FADED: Record<StatusPillVariant, string> = {
  paused:    'bg-yellow-100/50 text-yellow-800/70 dark:bg-yellow-900/20 dark:text-yellow-300/70',
  snoozed:   'bg-blue-100/50 text-blue-800/70 dark:bg-blue-900/20 dark:text-blue-300/70',
  recurring: 'bg-purple-100/50 text-purple-800/70 dark:bg-purple-900/20 dark:text-purple-300/70',
  scheduled: 'bg-blue-100/50 text-blue-800/70 dark:bg-blue-900/20 dark:text-blue-300/70',
  sent:      'bg-green-100/50 text-green-800/70 dark:bg-green-900/20 dark:text-green-300/70',
  missed:    'bg-red-100/50 text-red-800/70 dark:bg-red-900/20 dark:text-red-300/70',
  canceled:  'bg-gray-100/50 text-gray-800/70 dark:bg-gray-800/50 dark:text-gray-300/70',
};

export function StatusPill({ variant, label, icon: Icon, faded }: StatusPillProps) {
  const colors = faded ? VARIANT_COLORS_FADED[variant] : VARIANT_COLORS[variant];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        colors,
      )}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </span>
  );
}
