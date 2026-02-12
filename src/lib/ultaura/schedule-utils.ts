import { DateTime } from 'luxon';

const DAY_SHORT_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDaySummary(daysOfWeek: number[]): string {
  if (daysOfWeek.length === 0) return '';
  if (daysOfWeek.length === 7) return 'Every day';
  const weekdays = [1, 2, 3, 4, 5];
  const weekends = [0, 6];
  if (daysOfWeek.length === 5 && weekdays.every((d) => daysOfWeek.includes(d))) return 'Weekdays';
  if (daysOfWeek.length === 2 && weekends.every((d) => daysOfWeek.includes(d))) return 'Weekends';
  return daysOfWeek.map((d) => DAY_SHORT_NAMES[d]).join(', ');
}

export function formatNextRunAt(nextRunAt: string | null, timezone?: string): string {
  if (!nextRunAt) return '';
  try {
    const dt = timezone
      ? DateTime.fromISO(nextRunAt).setZone(timezone)
      : DateTime.fromISO(nextRunAt);
    const now = timezone ? DateTime.now().setZone(timezone) : DateTime.now();
    const isToday = dt.hasSame(now, 'day');
    const isTomorrow = dt.hasSame(now.plus({ days: 1 }), 'day');
    const timeStr = dt.toFormat('h:mm a');
    if (isToday) return `Today, ${timeStr}`;
    if (isTomorrow) return `Tomorrow, ${timeStr}`;
    return dt.toFormat('EEE, MMM d, h:mm a');
  } catch {
    return '';
  }
}
