import { DateTime } from 'luxon';
import type { EmotionalTrendsData, MoodSnapshotMood } from '~/lib/ultaura/types';

interface EmotionalTrendsProps {
  data: EmotionalTrendsData;
  timezone: string;
}

const MOOD_COLORS: Record<MoodSnapshotMood, string> = {
  positive: 'bg-success',
  neutral: 'bg-muted-foreground/50',
  low: 'bg-destructive',
  anxious: 'bg-amber-400',
  sad: 'bg-blue-400',
  frustrated: 'bg-rose-400',
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
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Emotional trends</h3>
        <span className="text-xs text-muted-foreground">Last 14 days</span>
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
                  {dots.map((mood, index) => (
                    <span
                      key={`${date}-${index}`}
                      className={`h-2 w-2 rounded-full ${MOOD_COLORS[mood]}`}
                      title={MOOD_LABELS[mood]}
                    />
                  ))}
                  {extraCount > 0 ? (
                    <span className="text-[10px] text-muted-foreground">+{extraCount}</span>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-5 space-y-3">
            {Object.entries(data.distribution).map(([mood, count]) => (
              <div key={mood} className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className={`h-2 w-2 rounded-full ${MOOD_COLORS[mood as MoodSnapshotMood]}`} />
                <span className="w-20 text-foreground">{MOOD_LABELS[mood as MoodSnapshotMood]}</span>
                <span>{count}</span>
                <span>({formatCount(count, totalCount)})</span>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Energy levels</p>
              <p className="mt-1 text-sm text-foreground">
                High: {data.energyLevels.high ?? 0}, Normal: {data.energyLevels.normal ?? 0},
                Low: {data.energyLevels.low ?? 0}, Very low: {data.energyLevels.very_low ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3">
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
