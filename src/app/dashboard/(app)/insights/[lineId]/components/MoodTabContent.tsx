'use client';

import type {
  InsightsDashboard,
  EmotionalTrendsData,
  MoodCalendarData,
} from '~/lib/ultaura/types';
import { EmotionalTrends } from '../../components/EmotionalTrends';
import { MoodCalendar } from '../../components/MoodCalendar';
import { TierGateNotice, type TierAccess } from './shared';

interface MoodTabContentProps {
  dashboard: InsightsDashboard | null;
  emotionalTrends: EmotionalTrendsData | null;
  moodCalendar: MoodCalendarData | null;
  timezone: string;
  tierAccess: TierAccess;
}

export function MoodTabContent({
  dashboard,
  emotionalTrends,
  moodCalendar,
  timezone,
  tierAccess,
}: MoodTabContentProps) {
  const { allowMood, lineName } = tierAccess;

  if (!allowMood) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Emotional trends and mood patterns over time.
        </p>
        <TierGateNotice title="Mood calendar" requiredTier="tier_2" lineName={lineName} />
        <TierGateNotice title="Emotional trends" requiredTier="tier_2" lineName={lineName} />
      </div>
    );
  }

  const showEngagement = Boolean(dashboard?.summary.engagementNote);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Emotional trends and mood patterns over time.
      </p>

      {showEngagement && dashboard && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground">Engagement Trend</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Engagement has been {dashboard.summary.engagementNote}.
          </p>
        </div>
      )}

      {moodCalendar ? (
        <MoodCalendar data={moodCalendar} timezone={timezone} />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground">Mood calendar</h3>
          <p className="mt-3 text-sm text-muted-foreground">No mood calendar data available yet.</p>
        </div>
      )}

      {emotionalTrends ? (
        <EmotionalTrends data={emotionalTrends} timezone={timezone} />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground">Emotional trends</h3>
          <p className="mt-3 text-sm text-muted-foreground">No emotional trend data available yet.</p>
        </div>
      )}

      {!dashboard && !emotionalTrends && !moodCalendar && (
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            No mood data available yet. Mood tracking will begin after calls start.
          </p>
        </div>
      )}
    </div>
  );
}
