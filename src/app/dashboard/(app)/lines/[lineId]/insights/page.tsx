import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { DateTime } from 'luxon';
import { getTrialInfo } from '~/lib/ultaura/accounts';
import { getLine } from '~/lib/ultaura/lines';
import {
  getConversationHighlights,
  getEmotionalTrends,
  getInsightsDashboard,
  getMemoryActivity,
  getMoodCalendar,
  getRelationshipIndicators,
  getSafetyEvents,
} from '~/lib/ultaura/insights';
import { getRelationships } from '~/lib/ultaura/relationships';
import { isUUID } from '~/lib/ultaura/short-id';
import AppHeader from '../../../components/AppHeader';
import { PageBody } from '~/core/ui/Page';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { TrialStatusBadge } from '~/components/ultaura/TrialStatusBadge';
import { PLANS } from '~/lib/ultaura/constants';
import type {
  ConversationHighlightsData,
  EmotionalTrendsData,
  MemoryActivityData,
  MoodCalendarData,
  PlanId,
  RelationshipIndicatorsData,
} from '~/lib/ultaura/types';
import { EmotionalTrends } from './EmotionalTrends';
import { MoodCalendar } from './MoodCalendar';
import { ConversationHighlights } from './ConversationHighlights';
import { MemoryActivity } from './MemoryActivity';
import { RelationshipIndicators } from './RelationshipIndicators';
import { Relationships } from './Relationships';
import { CallMetrics } from '../../../insights/components/CallMetrics';
import { InsightsSummary } from '../../../insights/components/InsightsSummary';

export const metadata: Metadata = {
  title: 'Line Insights - Ultaura',
};

interface PageProps {
  params: { lineId: string };
}

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
  events: Array<{ id: string; occurredAt: string; severity: 'low' | 'medium' | 'high'; actionTaken: string | null }>;
  timezone: string;
  highTierOnly: boolean;
}) {
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
            const dateLabel = DateTime.fromISO(event.occurredAt)
              .setZone(timezone)
              .toFormat('MMM d, yyyy');
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

export default async function LineInsightsPage({ params }: PageProps) {
  const line = await getLine(params.lineId);

  if (!line) {
    notFound();
  }

  if (isUUID(params.lineId)) {
    redirect(`/dashboard/lines/${line.short_id}/insights`);
  }

  if (!line.phone_verified_at) {
    redirect(`/dashboard/lines/${line.short_id}/verify`);
  }

  const monthKey = DateTime.now().setZone(line.timezone).toFormat('yyyy-MM');
  const dashboard = await getInsightsDashboard(line.id);
  const userType = dashboard?.userType ?? 'family_managed';
  const isFamilyManaged = userType === 'family_managed';
  const effectiveTier = isFamilyManaged
    ? (dashboard?.sharingConsent === 'granted' ? dashboard?.sharingTier : 'tier_1')
    : 'tier_4';
  const allowMood = !isFamilyManaged || effectiveTier !== 'tier_1';
  const allowTopics = !isFamilyManaged || effectiveTier === 'tier_3' || effectiveTier === 'tier_4';
  const allowConcerns = !isFamilyManaged || effectiveTier === 'tier_4';

  const emptyEmotionalTrends: EmotionalTrendsData = {
    entries: [],
    distribution: { positive: 0, neutral: 0, low: 0, anxious: 0, sad: 0, frustrated: 0 },
    energyLevels: { high: 0, normal: 0, low: 0, very_low: 0 },
    trajectories: { improved: 0, declined: 0, stable: 0 },
  };
  const emptyMoodCalendar: MoodCalendarData = { month: monthKey, days: [] };
  const emptyHighlights: ConversationHighlightsData = { highlights: [] };
  const emptyMemoryActivity: MemoryActivityData = { items: [] };
  const emptyRelationshipIndicators: RelationshipIndicatorsData = { indicators: [] };

  const [
    emotionalTrends,
    moodCalendar,
    conversationHighlights,
    memoryActivity,
    relationshipIndicators,
    relationships,
    trialInfo,
    safetyEvents,
  ] = await Promise.all([
    allowMood ? getEmotionalTrends(line.id) : Promise.resolve(emptyEmotionalTrends),
    allowMood ? getMoodCalendar(line.id, monthKey) : Promise.resolve(emptyMoodCalendar),
    allowTopics ? getConversationHighlights(line.id, 10) : Promise.resolve(emptyHighlights),
    allowConcerns ? getMemoryActivity(line.id, 20) : Promise.resolve(emptyMemoryActivity),
    allowConcerns ? getRelationshipIndicators(line.id) : Promise.resolve(emptyRelationshipIndicators),
    allowConcerns ? getRelationships(line.id) : Promise.resolve([]),
    getTrialInfo(line.account_id),
    getSafetyEvents(line.id, { includeAllTiers: !isFamilyManaged, limit: 10 }),
  ]);

  const isTrialExpired = trialInfo?.isExpired ?? false;
  const isTrialActive = (trialInfo?.isOnTrial ?? false) && !isTrialExpired;
  const trialPlanId = trialInfo?.trialPlanId ?? null;
  const trialPlanKey = (trialPlanId ?? 'free_trial') as PlanId;
  const trialPlanName = PLANS[trialPlanKey]?.displayName ?? 'Trial';

  return (
    <>
      <AppHeader
        title={`Insights for ${line.display_name}`}
        description="Conversation highlights without transcripts"
      >
        {isTrialActive && trialInfo ? (
          <TrialStatusBadge daysRemaining={trialInfo.daysRemaining} planName={trialPlanName} />
        ) : null}
      </AppHeader>
      <PageBody>
        <div className="space-y-6 pb-12">
          {isTrialExpired ? <TrialExpiredBanner trialPlanName={trialPlanName} /> : null}
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">
              These insights summarize trends without storing transcripts. They are informational only.
            </p>
          </div>

          {dashboard ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <InsightsSummary summary={dashboard.summary} showMood={allowMood} />
              <CallMetrics activity={dashboard.callActivity} />
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">
                Call activity metrics are not available yet.
              </p>
            </div>
          )}

          <SafetyAlertsCard
            events={safetyEvents}
            timezone={line.timezone}
            highTierOnly={isFamilyManaged}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            {allowMood ? (
              <EmotionalTrends data={emotionalTrends} timezone={line.timezone} />
            ) : (
              <TierGateNotice
                title="Emotional trends"
                requiredTier="tier_2"
                lineName={line.display_name}
              />
            )}
            {allowMood ? (
              <MoodCalendar data={moodCalendar} timezone={line.timezone} />
            ) : (
              <TierGateNotice
                title="Mood calendar"
                requiredTier="tier_2"
                lineName={line.display_name}
              />
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {allowTopics ? (
              <ConversationHighlights
                data={conversationHighlights}
                timezone={line.timezone}
                showMemoryKeys={allowConcerns}
                showMilestones={allowConcerns}
                showMood={allowMood}
              />
            ) : (
              <TierGateNotice
                title="Conversation highlights"
                requiredTier="tier_3"
                lineName={line.display_name}
              />
            )}
            {allowConcerns ? (
              <MemoryActivity data={memoryActivity} timezone={line.timezone} />
            ) : (
              <TierGateNotice
                title="Memory activity"
                requiredTier="tier_4"
                lineName={line.display_name}
              />
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {allowConcerns ? (
              <RelationshipIndicators data={relationshipIndicators} timezone={line.timezone} />
            ) : (
              <TierGateNotice
                title="Relationship indicators"
                requiredTier="tier_4"
                lineName={line.display_name}
              />
            )}
            {allowConcerns ? (
              <Relationships relationships={relationships} timezone={line.timezone} />
            ) : (
              <TierGateNotice
                title="Relationships"
                requiredTier="tier_4"
                lineName={line.display_name}
              />
            )}
          </div>
        </div>
      </PageBody>
    </>
  );
}
