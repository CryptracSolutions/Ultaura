import { DateTime } from 'luxon';
import { Smile, Meh, Frown, AlertCircle, CloudRain, Flame } from 'lucide-react';
import { InfoTip } from '~/core/ui/InfoTip';
import type { ElementType } from 'react';
import type { EmotionalTrendsData, MoodSnapshotMood } from '~/lib/ultaura/types';

interface EmotionalTrendsProps {
  data: EmotionalTrendsData;
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

function formatCount(count: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((count / total) * 100)}%`;
}

export function EmotionalTrends({ data, timezone }: EmotionalTrendsProps) {
  const totalCount = Object.values(data.distribution).reduce((sum, value) => sum + value, 0);
  const moodByDate = new Map<string, MoodSnapshotMood[]>();

  data.entries.forEach((entry) => {
    const mood = (entry.moodEnd || entry.moodStart || entry.moodMid) as MoodSnapshotMood | null;
    if (!mood) return;
    const date = DateTime.fromISO(entry.occurredAt).setZone(timezone).toISODate();
    if (!date) return;
    const existing = moodByDate.get(date) ?? [];
    existing.push(mood);
    moodByDate.set(date, existing);
  });

  const dateRange = Array.from(moodByDate.keys()).sort();

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold text-foreground">Emotional trends</h3>
        <InfoTip content="Tracks mood at the start, middle, and end of each call over the last 14 days — showing how mood shifts within and across conversations, not just daily snapshots." />
      </div>

      {data.entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No mood snapshots yet.</p>
      ) : (
        <>
          <div className="mt-4 flex h-28 items-end gap-1">
            {dateRange.map((date) => {
              const moods = moodByDate.get(date) ?? [];
              const dots = moods.slice(0, 4);
              const extraCount = moods.length - dots.length;

              return (
                <div key={date} className="flex-1 min-w-[4px] flex flex-col items-center justify-end gap-1">
                  {dots.map((mood, index) => {
                    const Icon = MOOD_ICONS[mood];
                    return (
                      <span
                        key={`${date}-${index}`}
                        title={MOOD_LABELS[mood]}
                        role="img"
                        aria-label={MOOD_LABELS[mood]}
                      >
                        <Icon className={`h-3 w-3 ${MOOD_COLORS[mood]}`} aria-hidden="true" />
                      </span>
                    );
                  })}
                  {extraCount > 0 ? (
                    <span className="text-[10px] text-muted-foreground">+{extraCount}</span>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-5 space-y-3">
            {Object.entries(data.distribution).map(([mood, count]) => {
              const moodKey = mood as MoodSnapshotMood;
              const Icon = MOOD_ICONS[moodKey];
              return (
                <div key={mood} className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Icon className={`h-3 w-3 ${MOOD_COLORS[moodKey]}`} aria-hidden="true" />
                  <span className="w-20 text-foreground">{MOOD_LABELS[moodKey]}</span>
                  <span>{count}</span>
                  <span>({formatCount(count, totalCount)})</span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Energy levels</p>
              <p className="mt-1 text-sm text-foreground">
                High: {data.energyLevels.high ?? 0}, Normal: {data.energyLevels.normal ?? 0},
                Low: {data.energyLevels.low ?? 0}, Very low: {data.energyLevels.very_low ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Mood trajectory</p>
              <p className="mt-1 text-sm text-foreground">
                Improved: {data.trajectories.improved ?? 0}, Stable: {data.trajectories.stable ?? 0},
                Declined: {data.trajectories.declined ?? 0}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
