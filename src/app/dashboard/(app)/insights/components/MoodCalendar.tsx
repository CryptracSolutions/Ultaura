import { DateTime } from 'luxon';
import { Smile, Meh, Frown, AlertCircle, CloudRain, Flame } from 'lucide-react';
import type { ElementType } from 'react';
import type { MoodCalendarData, MoodSnapshotMood } from '~/lib/ultaura/types';

interface MoodCalendarProps {
  data: MoodCalendarData;
  timezone: string;
}

const MOOD_COLORS: Record<MoodSnapshotMood, string> = {
  positive: 'text-success',
  neutral: 'text-muted-foreground',
  low: 'text-destructive',
  anxious: 'text-amber-500',
  sad: 'text-blue-500',
  frustrated: 'text-rose-500',
};

const MOOD_ICONS: Record<MoodSnapshotMood, ElementType> = {
  positive: Smile,
  neutral: Meh,
  low: Frown,
  anxious: AlertCircle,
  sad: CloudRain,
  frustrated: Flame,
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
          const Icon = mood ? MOOD_ICONS[mood] : null;

          return (
            <div
              key={`day-${day}`}
              className="h-10 rounded-lg border border-border/60 bg-muted/10 flex items-center justify-center text-xs"
              title={mood ? MOOD_LABELS[mood] : 'No mood logged'}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-foreground">{day}</span>
                {mood && Icon ? (
                  <span role="img" aria-label={MOOD_LABELS[mood]}>
                    <Icon className={`h-3 w-3 ${MOOD_COLORS[mood]}`} aria-hidden="true" />
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {Object.entries(MOOD_LABELS).map(([mood, label]) => {
          const moodKey = mood as MoodSnapshotMood;
          const Icon = MOOD_ICONS[moodKey];
          return (
            <span key={mood} className="inline-flex items-center gap-1">
              <Icon className={`h-3 w-3 ${MOOD_COLORS[moodKey]}`} aria-hidden="true" />
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
