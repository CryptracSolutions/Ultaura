import type { CallSessionRow } from '../../utils/supabase.js';

export async function enforceSessionLineMatch(options: {
  session: CallSessionRow;
  lineId: string;
  recordFailure?: (code?: string) => Promise<void>;
}): Promise<boolean> {
  if (options.session.line_id !== options.lineId) {
    if (options.recordFailure) {
      await options.recordFailure('unauthorized');
    }
    return false;
  }

  return true;
}

export function formatReminderSchedule(dueAt: string | Date, timezone: string): string {
  const when = dueAt instanceof Date ? dueAt : new Date(dueAt);
  const tz = timezone || 'UTC';
  let dateStr: string;
  let timeStr: string;

  try {
    dateStr = when.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: tz,
    });
    timeStr = when.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: tz,
    });
  } catch {
    try {
      dateStr = when.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      });
      timeStr = when.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC',
      });
    } catch {
      dateStr = when.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
      timeStr = when.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }
  }
  return `${dateStr} at ${timeStr}`;
}
