import { DateTime } from 'luxon';
import type { MoodCalendarData, MoodSnapshotMood } from '~/lib/ultaura/types';

interface MoodCalendarProps {
  data: MoodCalendarData;
  timezone: string;
}

const MOOD_COLORS: Record<MoodSnapshotMood, string> = {
  positive: 'bg-success/80',
  neutral: 'bg-muted-foreground/40',
  low: 'bg-destructive/80',
  anxious: 'bg-amber-400/80',
  sad: 'bg-blue-400/80',
  frustrated: 'bg-rose-400/80',
};

const MOOD_LABELS: Record<MoodSnapshotMood, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  low: 'Low',
  anxious: 'Anxious',
  sad: 'Sad',
  frustrated: 'Frustrated',
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function MoodCalendar({ data, timezone }: MoodCalendarProps) {
  const month = DateTime.fromFormat(data.month, 'yyyy-MM', { zone: timezone });
  const monthStart = month.isValid ? month.startOf('month') : DateTime.now().setZone(timezone).startOf('month');
  const daysInMonth = monthStart.daysInMonth ?? 30;
  const offset = monthStart.weekday % 7;
  const totalCells = Math.ceil((daysInMonth + offset) / 7) * 7;

  const moodMap = new Map(data.days.map((day) => [day.date, day.mood]));

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Mood calendar</h3>
        <span className="text-xs text-muted-foreground">{monthStart.toFormat('MMMM yyyy')}</span>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2 text-xs text-muted-foreground">
        {DAY_LABELS.map((label) => (
          <div key={label} className="text-center">
            {label}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {Array.from({ length: totalCells }).map((_, index) => {
          const day = index - offset + 1;
          if (day < 1 || day > daysInMonth) {
            return <div key={`empty-${index}`} className="h-10 rounded-lg border border-dashed border-border/60" />;
          }

          const date = monthStart.set({ day }).toISODate();
          const mood = date ? moodMap.get(date) ?? null : null;

          return (
            <div
              key={`day-${day}`}
              className="h-10 rounded-lg border border-border/60 bg-muted/10 flex items-center justify-center text-xs"
              title={mood ? MOOD_LABELS[mood] : 'No mood logged'}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-foreground">{day}</span>
                {mood ? (
                  <span className={`h-2 w-6 rounded-full ${MOOD_COLORS[mood]}`} />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {Object.entries(MOOD_LABELS).map(([mood, label]) => (
          <span key={mood} className="inline-flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${MOOD_COLORS[mood as MoodSnapshotMood]}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
