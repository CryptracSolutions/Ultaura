import { DateTime } from 'luxon';

const DEFAULT_LOCALE = 'en-US';
const EMPTY = '\u2014'; // em dash

function toDateTime(
  value: string | Date | null | undefined,
  timezone?: string,
): DateTime | null {
  if (!value) return null;

  const dt =
    value instanceof Date
      ? DateTime.fromJSDate(value)
      : DateTime.fromISO(value);

  if (!dt.isValid) return null;

  return timezone ? dt.setZone(timezone) : dt;
}

/**
 * Format a date as "Jan 5, 2026"
 */
export function formatDate(
  value: string | Date | null | undefined,
  options?: { timezone?: string },
): string {
  const dt = toDateTime(value, options?.timezone);
  if (!dt) return EMPTY;

  return dt.toLocaleString(
    { month: 'short', day: 'numeric', year: 'numeric' },
    { locale: DEFAULT_LOCALE },
  );
}

/**
 * Format a date+time as "Jan 5, 2026, 3:45 PM"
 */
export function formatDateTime(
  value: string | Date | null | undefined,
  options?: { timezone?: string },
): string {
  const dt = toDateTime(value, options?.timezone);
  if (!dt) return EMPTY;

  return dt.toLocaleString(
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    },
    { locale: DEFAULT_LOCALE },
  );
}

/**
 * Format a relative time string: "2 hours ago", "Yesterday", "3 days ago"
 */
export function formatRelativeTime(
  value: string | Date | null | undefined,
): string {
  const dt = toDateTime(value);
  if (!dt) return EMPTY;

  const now = DateTime.now();
  const diff = now.diff(dt, ['years', 'months', 'days', 'hours', 'minutes']);

  if (diff.years >= 1) {
    const y = Math.floor(diff.years);
    return y === 1 ? '1 year ago' : `${y} years ago`;
  }
  if (diff.months >= 1) {
    const m = Math.floor(diff.months);
    return m === 1 ? '1 month ago' : `${m} months ago`;
  }
  if (diff.days >= 2) {
    return `${Math.floor(diff.days)} days ago`;
  }
  if (diff.days >= 1) {
    return 'Yesterday';
  }
  if (diff.hours >= 1) {
    const h = Math.floor(diff.hours);
    return h === 1 ? '1 hour ago' : `${h} hours ago`;
  }
  if (diff.minutes >= 1) {
    const m = Math.floor(diff.minutes);
    return m === 1 ? '1 minute ago' : `${m} minutes ago`;
  }

  return 'Just now';
}

/**
 * Format a long date as "January 5, 2026" (for blog posts, formal contexts)
 */
export function formatLongDate(
  value: string | Date | null | undefined,
  options?: { timezone?: string },
): string {
  const dt = toDateTime(value, options?.timezone);
  if (!dt) return EMPTY;

  return dt.toLocaleString(
    { month: 'long', day: 'numeric', year: 'numeric' },
    { locale: DEFAULT_LOCALE },
  );
}
