import {
  Smile,
  Meh,
  Frown,
  AlertCircle,
  CloudRain,
  Flame,
  TrendingUp,
  Minus,
  TrendingDown,
} from 'lucide-react';
import { InfoTip } from '~/core/ui/InfoTip';
import type { ElementType } from 'react';
import type {
  EmotionalTrendsData,
  MoodSnapshotMood,
  MoodEnergyLevel,
  MoodTrajectory,
} from '~/lib/ultaura/types';

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

const MOOD_BAR_COLORS: Record<MoodSnapshotMood, string> = {
  positive: 'bg-success',
  neutral: 'bg-slate-400',
  low: 'bg-destructive',
  anxious: 'bg-amber-500',
  sad: 'bg-blue-500',
  frustrated: 'bg-rose-500',
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

const ENERGY_CONFIG: {
  key: MoodEnergyLevel;
  label: string;
  barColor: string;
}[] = [
  { key: 'high', label: 'High', barColor: 'bg-emerald-500' },
  { key: 'normal', label: 'Normal', barColor: 'bg-sky-500' },
  { key: 'low', label: 'Low', barColor: 'bg-amber-500' },
  { key: 'very_low', label: 'Very low', barColor: 'bg-destructive' },
];

const TRAJECTORY_CONFIG: {
  key: MoodTrajectory;
  label: string;
  icon: ElementType;
  style: string;
}[] = [
  {
    key: 'improved',
    label: 'Improved',
    icon: TrendingUp,
    style: 'border-success/50 bg-success/10',
  },
  {
    key: 'stable',
    label: 'Stable',
    icon: Minus,
    style: 'border-border bg-muted/20',
  },
  {
    key: 'declined',
    label: 'Declined',
    icon: TrendingDown,
    style: 'border-amber-500/50 bg-amber-500/10',
  },
];

function formatPercent(count: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((count / total) * 100)}%`;
}

function getPercent(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

export function EmotionalTrends({ data }: EmotionalTrendsProps) {
  const totalMood = Object.values(data.distribution).reduce(
    (sum, v) => sum + v,
    0,
  );
  const totalEnergy = Object.values(data.energyLevels).reduce(
    (sum, v) => sum + v,
    0,
  );
  const totalTrajectory = Object.values(data.trajectories).reduce(
    (sum, v) => sum + v,
    0,
  );

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Emotional Trends</h3>
        <InfoTip content="Tracks mood at the start, middle, and end of each call over the last 14 days — showing how mood shifts within and across conversations, not just daily snapshots." />
      </div>

      {data.entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No mood snapshots yet.
        </p>
      ) : (
        <>
          {/* Mood distribution */}
          <div className="mt-5 space-y-2.5">
            {Object.entries(data.distribution).map(([mood, count]) => {
              const moodKey = mood as MoodSnapshotMood;
              const Icon = MOOD_ICONS[moodKey];
              const pct = getPercent(count, totalMood);

              return (
                <div key={mood} className="flex items-center gap-3 text-xs">
                  <Icon
                    className={`h-3.5 w-3.5 shrink-0 ${MOOD_COLORS[moodKey]}`}
                    aria-hidden="true"
                  />
                  <span className="w-[4.5rem] shrink-0 text-foreground">
                    {MOOD_LABELS[moodKey]}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/40">
                    <div
                      className={`h-full rounded-full ${MOOD_BAR_COLORS[moodKey]} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-muted-foreground">
                    {count} ({formatPercent(count, totalMood)})
                  </span>
                </div>
              );
            })}
          </div>

          {/* Energy levels + Mood trajectory */}
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {/* Energy levels */}
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Energy levels
              </p>
              <div className="mt-2.5 space-y-2">
                {ENERGY_CONFIG.map(({ key, label, barColor }) => {
                  const count = data.energyLevels[key] ?? 0;
                  const pct = getPercent(count, totalEnergy);
                  return (
                    <div key={key} className="flex items-center gap-2.5 text-xs">
                      <span className="w-14 shrink-0 text-foreground">
                        {label}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/40">
                        <div
                          className={`h-full rounded-full ${barColor} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-6 shrink-0 text-right text-muted-foreground">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mood trajectory */}
            <div className="flex flex-col">
              <p className="text-xs font-medium text-muted-foreground">
                Mood trajectory
              </p>
              <div className="mt-2.5 grid flex-1 grid-cols-3 gap-2">
                {TRAJECTORY_CONFIG.map(({ key, label, icon: TIcon, style }) => {
                  const count = data.trajectories[key] ?? 0;
                  return (
                    <div
                      key={key}
                      className={`flex flex-col items-center justify-center rounded-xl border py-2 text-center ${style}`}
                    >
                      <TIcon className="h-3 w-3 text-muted-foreground" />
                      <p className="mt-1 text-lg font-semibold leading-none text-foreground">
                        {count}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {label}
                      </p>
                      {totalTrajectory > 0 && (
                        <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                          {formatPercent(count, totalTrajectory)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
