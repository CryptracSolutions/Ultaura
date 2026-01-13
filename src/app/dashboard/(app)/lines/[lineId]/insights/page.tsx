import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { DateTime } from 'luxon';
import { getTrialInfo } from '~/lib/ultaura/accounts';
import { getLine } from '~/lib/ultaura/lines';
import { getEmotionalTrends, getMoodCalendar, getConversationHighlights, getMemoryActivity, getRelationshipIndicators } from '~/lib/ultaura/insights';
import { getRelationships } from '~/lib/ultaura/relationships';
import { isUUID } from '~/lib/ultaura/short-id';
import AppHeader from '../../../components/AppHeader';
import { PageBody } from '~/core/ui/Page';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { TrialStatusBadge } from '~/components/ultaura/TrialStatusBadge';
import { PLANS } from '~/lib/ultaura/constants';
import type { PlanId } from '~/lib/ultaura/types';
import { EmotionalTrends } from './EmotionalTrends';
import { MoodCalendar } from './MoodCalendar';
import { ConversationHighlights } from './ConversationHighlights';
import { MemoryActivity } from './MemoryActivity';
import { RelationshipIndicators } from './RelationshipIndicators';
import { Relationships } from './Relationships';

export const metadata: Metadata = {
  title: 'Line Insights - Ultaura',
};

interface PageProps {
  params: { lineId: string };
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

  const [
    emotionalTrends,
    moodCalendar,
    conversationHighlights,
    memoryActivity,
    relationshipIndicators,
    relationships,
    trialInfo,
  ] = await Promise.all([
    getEmotionalTrends(line.id),
    getMoodCalendar(line.id, monthKey),
    getConversationHighlights(line.id, 10),
    getMemoryActivity(line.id, 20),
    getRelationshipIndicators(line.id),
    getRelationships(line.id),
    getTrialInfo(line.account_id),
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

          <div className="grid gap-6 lg:grid-cols-2">
            <EmotionalTrends data={emotionalTrends} timezone={line.timezone} />
            <MoodCalendar data={moodCalendar} timezone={line.timezone} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ConversationHighlights data={conversationHighlights} timezone={line.timezone} />
            <MemoryActivity data={memoryActivity} timezone={line.timezone} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <RelationshipIndicators data={relationshipIndicators} timezone={line.timezone} />
            <Relationships relationships={relationships} timezone={line.timezone} />
          </div>
        </div>
      </PageBody>
    </>
  );
}
