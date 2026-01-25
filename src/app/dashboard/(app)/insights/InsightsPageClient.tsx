'use client';

import Link from 'next/link';
import type {
  InsightsDashboard,
  LineStatus,
  EmotionalTrendsData,
  MoodCalendarData,
  ConversationHighlightsData,
  MemoryActivityData,
  RelationshipIndicatorsData,
  RelationshipRow,
} from '~/lib/ultaura/types';
import type { StoryArc, SegmentStats, CallPreview } from '~/lib/ultaura/types/retention';
import { InsightsSummary } from './components/InsightsSummary';
import { CallMetrics } from './components/CallMetrics';
import { MoodTrend } from './components/MoodTrend';
import { TopicsChart } from './components/TopicsChart';
import { ConcernsList } from './components/ConcernsList';
import { RetentionInsightsCard } from './components/RetentionInsightsCard';
import { CallActivityList } from '../lines/[lineId]/components/CallActivityList';
import { EmotionalTrends } from './components/EmotionalTrends';
import { MoodCalendar } from './components/MoodCalendar';
import { ConversationHighlights } from './components/ConversationHighlights';
import { MemoryActivity } from './components/MemoryActivity';
import { RelationshipIndicators } from './components/RelationshipIndicators';
import { Relationships } from './components/Relationships';
import { EngagementFeatures } from './components/EngagementFeatures';

interface LineOption {
  id: string;
  short_id: string;
  display_name: string;
  status: LineStatus;
  insights_enabled: boolean;
  phone_verified_at: string | null;
}

interface SafetyEvent {
  id: string;
  occurredAt: string;
  severity: 'low' | 'medium' | 'high';
  actionTaken: string | null;
}

interface InsightsPageClientProps {
  lines: LineOption[];
  selectedLineId: string | null;
  dashboard: InsightsDashboard | null;
  emotionalTrends: EmotionalTrendsData | null;
  moodCalendar: MoodCalendarData | null;
  conversationHighlights: ConversationHighlightsData | null;
  memoryActivity: MemoryActivityData | null;
  relationshipIndicators: RelationshipIndicatorsData | null;
  relationships: RelationshipRow[];
  safetyEvents: SafetyEvent[];
  callPreviews: CallPreview[];
  storyArcs: StoryArc[];
  segmentStats: SegmentStats | null;
  timezone: string;
}

const SHARING_TIER_LABELS: Record<string, string> = {
  tier_1: 'Basic Updates & Safety',
  tier_2: 'Wellness Check',
  tier_3: 'Full Summary',
  tier_4: 'Complete Visibility',
};

const TIER_REQUIREMENTS = {
  tier_2: 'Wellness Check sharing level or higher.',
  tier_3: 'Full Summary sharing level or higher.',
  tier_4: 'Complete Visibility sharing level.',
};

function TierGateNotice({
  title,
  requiredTier,
  lineName,
}: {
  title: string;
  requiredTier: keyof typeof TIER_REQUIREMENTS;
  lineName: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        This section requires {TIER_REQUIREMENTS[requiredTier]} {lineName} controls sharing
        preferences during calls.
      </p>
    </div>
  );
}

function formatSafetyAction(action?: string | null) {
  if (!action) return null;
  return action.replace(/_/g, ' ');
}

function SafetyAlertsCard({
  events,
  timezone,
  highTierOnly,
}: {
  events: SafetyEvent[];
  timezone: string;
  highTierOnly: boolean;
}) {
  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: timezone,
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Safety Alerts History</h3>
        <span className="text-xs text-muted-foreground">Recent alerts</span>
      </div>
      {events.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {highTierOnly
            ? 'No high-tier safety alerts in the last 30 days.'
            : 'No safety alerts in the last 30 days.'}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {events.map((event) => {
            const dateLabel = formatDate(event.occurredAt);
            const actionLabel = formatSafetyAction(event.actionTaken);
            return (
              <div key={event.id} className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{dateLabel}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {event.severity} alert
                  </span>
                </div>
                {actionLabel ? (
                  <p className="mt-2 text-xs text-muted-foreground">Action: {actionLabel}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function InsightsPageClient({
  lines,
  selectedLineId,
  dashboard,
  emotionalTrends,
  moodCalendar,
  conversationHighlights,
  memoryActivity,
  relationshipIndicators,
  relationships,
  safetyEvents,
  callPreviews,
  storyArcs,
  segmentStats,
  timezone,
}: InsightsPageClientProps) {
  const selectedLine = lines.find((line) => line.id === selectedLineId) ?? lines[0];

  if (!selectedLine) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-muted-foreground">No lines available.</p>
      </div>
    );
  }

  const callActivityDates = dashboard ? dashboard.callActivity.map((entry) => entry.date) : [];
  const isFamilyManaged = dashboard?.userType === 'family_managed';
  const effectiveTier = isFamilyManaged
    ? (dashboard?.sharingConsent === 'granted' ? dashboard?.sharingTier : 'tier_1')
    : null;
  const allowMood = !isFamilyManaged || effectiveTier !== 'tier_1';
  const allowTopics = !isFamilyManaged || effectiveTier === 'tier_3' || effectiveTier === 'tier_4';
  const allowConcerns = !isFamilyManaged || effectiveTier === 'tier_4';
  const showEngagement = allowMood && Boolean(dashboard?.summary.engagementNote);
  const showLimitedNotice = isFamilyManaged && effectiveTier === 'tier_1';
  const sharingStatusLabel = effectiveTier ? SHARING_TIER_LABELS[effectiveTier] : null;
  const lineName = dashboard?.lineName ?? selectedLine.display_name;

  return (
    <div className="space-y-6">
      {/* AI Disclaimer - always shown */}
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <p className="text-sm text-muted-foreground">
          These insights are generated by AI based on conversation patterns and are not
          medical, clinical, or professional advice. Ultaura is not an emergency service. If
          you believe there is immediate danger, contact local emergency services (911 in the
          US).
        </p>
      </div>

      {/* Dashboard sections - only when dashboard is available */}
      {dashboard && (
        <>
          {!dashboard.insightsEnabled && (
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <p className="text-sm text-foreground">
                Insights are disabled for this line. Historical insights remain visible.
              </p>
              <Link
                href={`/dashboard/lines/${dashboard.lineShortId}/settings`}
                className="text-sm text-primary hover:underline"
              >
                Enable insights in Line Settings
              </Link>
            </div>
          )}

          {isFamilyManaged && sharingStatusLabel && (
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <div className="text-sm font-medium text-foreground">Sharing level</div>
              <p className="text-sm text-muted-foreground mt-1">
                {sharingStatusLabel}
                {dashboard?.sharingConsent !== 'granted'
                  ? ` (not enabled by ${dashboard.lineName})`
                  : ''}
              </p>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <InsightsSummary summary={dashboard.summary} showMood={allowMood} />
            <CallMetrics activity={dashboard.callActivity} />
          </div>

          <RetentionInsightsCard retention={dashboard.retention} />

          {allowMood && (
            <div className={showEngagement ? 'grid gap-6 lg:grid-cols-2' : 'grid gap-6'}>
              {showEngagement && (
                <div className="rounded-xl border border-border bg-card p-6">
                  <h3 className="text-sm font-semibold text-foreground">Engagement Trend</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Engagement has been {dashboard.summary.engagementNote}.
                  </p>
                </div>
              )}
              <MoodTrend
                moodTrend={dashboard.moodTrend}
                dateRange={callActivityDates}
                timezone={dashboard.timezone}
                className={showEngagement ? undefined : 'lg:col-span-2'}
              />
            </div>
          )}

          {showLimitedNotice && (
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">
                Detailed insights require {SHARING_TIER_LABELS.tier_2} sharing level or higher.{' '}
                {dashboard.lineName} controls sharing preferences during calls.
              </p>
            </div>
          )}

          {allowTopics && <TopicsChart topics={dashboard.topics} />}

          {allowConcerns && <ConcernsList concerns={dashboard.concerns} />}

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-semibold text-foreground mb-6">Call History</h2>
            <CallActivityList sessions={dashboard.callHistory} />
          </div>
        </>
      )}

      {/* Safety Alerts History - always shown */}
      <SafetyAlertsCard
        events={safetyEvents}
        timezone={timezone}
        highTierOnly={isFamilyManaged}
      />

      {/* Emotional Trends and Mood Calendar */}
      <div className="grid gap-6 lg:grid-cols-2">
        {allowMood && emotionalTrends ? (
          <EmotionalTrends data={emotionalTrends} timezone={timezone} />
        ) : (
          <TierGateNotice
            title="Emotional trends"
            requiredTier="tier_2"
            lineName={lineName}
          />
        )}
        {allowMood && moodCalendar ? (
          <MoodCalendar data={moodCalendar} timezone={timezone} />
        ) : (
          <TierGateNotice
            title="Mood calendar"
            requiredTier="tier_2"
            lineName={lineName}
          />
        )}
      </div>

      {/* Conversation Highlights and Memory Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {allowTopics && conversationHighlights ? (
          <ConversationHighlights
            data={conversationHighlights}
            timezone={timezone}
            showMemoryKeys={allowConcerns && !isFamilyManaged}
            showMilestones={allowConcerns && !isFamilyManaged}
            showMood={allowMood}
          />
        ) : (
          <TierGateNotice
            title="Conversation highlights"
            requiredTier="tier_3"
            lineName={lineName}
          />
        )}
        {allowConcerns && memoryActivity ? (
          <MemoryActivity data={memoryActivity} timezone={timezone} />
        ) : (
          <TierGateNotice
            title="Memory activity"
            requiredTier="tier_4"
            lineName={lineName}
          />
        )}
      </div>

      {/* Relationship Indicators and Relationships */}
      <div className="grid gap-6 lg:grid-cols-2">
        {allowConcerns && relationshipIndicators ? (
          <RelationshipIndicators data={relationshipIndicators} timezone={timezone} />
        ) : (
          <TierGateNotice
            title="Relationship indicators"
            requiredTier="tier_4"
            lineName={lineName}
          />
        )}
        {allowConcerns ? (
          <Relationships relationships={relationships} timezone={timezone} />
        ) : (
          <TierGateNotice
            title="Relationships"
            requiredTier="tier_4"
            lineName={lineName}
          />
        )}
      </div>

      {/* Engagement - always shown */}
      {segmentStats && (
        <EngagementFeatures
          storyArcs={storyArcs}
          segmentStats={segmentStats}
          timezone={timezone}
          callPreviews={callPreviews}
        />
      )}
    </div>
  );
}
