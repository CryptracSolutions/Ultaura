import { DateTime } from 'luxon';
import type { InsightsDashboard, InsightMood } from '~/lib/ultaura/types';

interface MoodTrendProps {
  moodTrend: InsightsDashboard['moodTrend'];
  dateRange: string[];
  timezone: string;
  className?: string;
}

const MOOD_COLORS: Record<InsightMood, string> = {
  positive: 'bg-success',
  neutral: 'bg-muted-foreground/50',
  low: 'bg-destructive',
};

const MOOD_LABELS: Record<InsightMood, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  low: 'Low',
};

const MAX_DOTS_PER_DAY = 4;

export function MoodTrend({ moodTrend, dateRange, timezone, className }: MoodTrendProps) {
  const moodByDate = new Map<string, InsightMood[]>();

  for (const entry of moodTrend) {
    const localDate = DateTime.fromISO(entry.occurredAt).setZone(timezone).toISODate();
    if (!localDate) continue;

    const existing = moodByDate.get(localDate) ?? [];
    existing.push(entry.mood);
    moodByDate.set(localDate, existing);
  }

  return (
    <div className={`rounded-xl border border-border bg-card p-6 ${className ?? ''}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Mood Trend</h3>
        <span className="text-xs text-muted-foreground">Last 30 days</span>
      </div>

      <div className="mt-4 flex h-36 items-end gap-1">
        {dateRange.map((date) => {
          const moods = moodByDate.get(date) ?? [];
          const dots = moods.slice(0, MAX_DOTS_PER_DAY);
          const extraCount = moods.length - dots.length;

          return (
            <div
              key={date}
              className="flex-1 min-w-[4px] flex flex-col items-center justify-end gap-1"
            >
              {dots.map((mood, index) => (
                <span
                  key={`${date}-${index}`}
                  className={`h-2 w-2 rounded-full ${MOOD_COLORS[mood]}`}
                  title={`Mood: ${MOOD_LABELS[mood]}`}
                />
              ))}
              {extraCount > 0 ? (
                <span className="text-[10px] text-muted-foreground">+{extraCount}</span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${MOOD_COLORS.positive}`} />
          Positive
        </span>
        <span className="inline-flex items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${MOOD_COLORS.neutral}`} />
          Neutral
        </span>
        <span className="inline-flex items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${MOOD_COLORS.low}`} />
          Low
        </span>
      </div>
    </div>
  );
}
