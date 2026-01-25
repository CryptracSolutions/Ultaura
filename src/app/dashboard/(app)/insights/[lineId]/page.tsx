import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { DateTime } from 'luxon';
import AppHeader from '../../components/AppHeader';
import { PageBody } from '~/core/ui/Page';
import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import { getUltauraAccount, getTrialInfo } from '~/lib/ultaura/accounts';
import { getLines } from '~/lib/ultaura/lines';
import {
  getInsightsDashboard,
  getEmotionalTrends,
  getMoodCalendar,
  getConversationHighlights,
  getMemoryActivity,
  getSafetyEvents,
} from '~/lib/ultaura/insights';
import {
  getCallPreviewHistory,
  getSegmentEngagementStats,
  getStoryArcProgress,
} from '~/lib/ultaura/retention';
import { getRelationships } from '~/lib/ultaura/relationships';
import type { LineRow } from '~/lib/ultaura/types';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { TrialStatusBadge } from '~/components/ultaura/TrialStatusBadge';
import { PLANS } from '~/lib/ultaura/constants';
import { InsightsPageClient } from '../InsightsPageClient';
import { InsightsLineTabs } from '../components/InsightsLineTabs';

export const metadata: Metadata = {
  title: 'Insights - Ultaura',
};

interface PageProps {
  params: Promise<{
    lineId: string;
  }>;
}

type LineOption = LineRow & {
  insights_enabled: boolean;
};

export default async function InsightsLinePage({ params }: PageProps) {
  const { lineId } = await params;
  const appData = await loadAppDataForUser();
  const organizationId = appData.organization?.id;

  if (!organizationId) {
    return (
      <>
        <AppHeader title="Insights" description="Weekly insights without transcripts" />
        <PageBody>
          <p className="text-muted-foreground">Organization not found.</p>
        </PageBody>
      </>
    );
  }

  const account = await getUltauraAccount(organizationId);

  if (!account) {
    return (
      <>
        <AppHeader title="Insights" description="Weekly insights without transcripts" />
        <PageBody>
          <div className="max-w-lg mx-auto text-center py-8">
            <h2 className="text-2xl font-semibold mb-4">Get Started with Ultaura</h2>
            <p className="text-muted-foreground mb-6">
              Start a 3-day free trial to unlock insights and weekly summaries.
            </p>
            <Link
              href="/dashboard/settings/subscription"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Start 3-day free trial
            </Link>
          </div>
        </PageBody>
      </>
    );
  }

  const [lines, trialInfo] = await Promise.all([
    getLines(account.id),
    getTrialInfo(account.id),
  ]);

  const isTrialExpired = trialInfo?.isExpired ?? false;
  const isTrialActive = (trialInfo?.isOnTrial ?? false) && !isTrialExpired;
  const trialPlanId = (trialInfo?.trialPlanId ?? 'free_trial') as keyof typeof PLANS;
  const trialPlanName = PLANS[trialPlanId]?.displayName ?? 'Trial';

  if (lines.length === 0) {
    redirect('/dashboard/insights');
  }

  const supabase = getSupabaseServerComponentClient();
  const lineIds = lines.map((line) => line.id);
  const { data: privacyRows } = lineIds.length
    ? await supabase
        .from('ultaura_insight_privacy')
        .select('line_id, insights_enabled')
        .in('line_id', lineIds)
    : { data: [] };

  const privacyMap = new Map<string, boolean>();
  privacyRows?.forEach((row) => {
    privacyMap.set(row.line_id, row.insights_enabled);
  });

  const lineOptions: LineOption[] = lines.map((line) => ({
    ...line,
    insights_enabled: privacyMap.get(line.id) ?? true,
  }));

  // Find the selected line by short_id
  const selectedLine = lineOptions.find((line) => line.short_id === lineId);

  if (!selectedLine) {
    notFound();
  }

  // Fetch all insight data for the selected line
  const monthKey = DateTime.now().setZone(selectedLine.timezone).toFormat('yyyy-MM');

  const [
    dashboard,
    emotionalTrends,
    moodCalendar,
    conversationHighlights,
    memoryActivity,
    relationships,
    safetyEvents,
    callPreviews,
    storyArcs,
    segmentStats,
  ] = await Promise.all([
    getInsightsDashboard(selectedLine.id),
    getEmotionalTrends(selectedLine.id),
    getMoodCalendar(selectedLine.id, monthKey),
    getConversationHighlights(selectedLine.id, 10),
    getMemoryActivity(selectedLine.id, 20),
    getRelationships(selectedLine.id),
    getSafetyEvents(selectedLine.id, { includeAllTiers: true, limit: 10 }),
    getCallPreviewHistory(selectedLine.id, 10),
    getStoryArcProgress(selectedLine.id),
    getSegmentEngagementStats(selectedLine.id),
  ]);

  return (
    <>
      <AppHeader title="Insights" description="Weekly insights without transcripts">
        {isTrialActive && trialInfo ? (
          <TrialStatusBadge daysRemaining={trialInfo.daysRemaining} planName={trialPlanName} />
        ) : null}
      </AppHeader>
      <PageBody>
        <div className="space-y-6 pb-12">
          {isTrialExpired ? <TrialExpiredBanner trialPlanName={trialPlanName} /> : null}

          <InsightsLineTabs lines={lineOptions} currentLineShortId={selectedLine.short_id} />

          <InsightsPageClient
            lines={lineOptions}
            selectedLineId={selectedLine.id}
            dashboard={dashboard}
            emotionalTrends={emotionalTrends}
            moodCalendar={moodCalendar}
            conversationHighlights={conversationHighlights}
            memoryActivity={memoryActivity}
            relationships={relationships}
            safetyEvents={safetyEvents}
            callPreviews={callPreviews}
            storyArcs={storyArcs}
            segmentStats={segmentStats}
            timezone={selectedLine.timezone}
          />
        </div>
      </PageBody>
    </>
  );
}
