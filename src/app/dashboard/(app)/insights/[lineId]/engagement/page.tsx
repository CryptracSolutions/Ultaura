import { Metadata } from 'next';
import Link from 'next/link';
import AppHeader from '../../../components/AppHeader';
import { PageBody } from '~/core/ui/Page';
import { getInsightsDashboard } from '~/lib/ultaura/insights';
import {
  getCallPreviewHistory,
  getSegmentEngagementStats,
  getStoryArcProgress,
} from '~/lib/ultaura/retention';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { TrialStatusBadge } from '~/components/ultaura/TrialStatusBadge';
import { InsightsPageHeader } from '../components/InsightsPageHeader';
import { EngagementTabContent } from '../components/EngagementTabContent';
import { computeTierAccess } from '../components/tier-utils';
import { loadInsightsPageData } from '../loader';

export const metadata: Metadata = {
  title: 'Engagement - Insights - Ultaura',
};

interface PageProps {
  params: Promise<{
    lineId: string;
  }>;
}

export default async function InsightsEngagementPage({ params }: PageProps) {
  const { lineId } = await params;
  const loaderResult = await loadInsightsPageData(lineId);

  if (!loaderResult) {
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

  const {
    lines,
    selectedLine,
    trialInfo,
    isTrialExpired,
    isTrialActive,
    trialPlanName,
  } = loaderResult;

  // Fetch data needed for Engagement tab
  const [dashboard, callPreviews, storyArcs, segmentStats] = await Promise.all([
    getInsightsDashboard(selectedLine.id),
    getCallPreviewHistory(selectedLine.id, 10),
    getStoryArcProgress(selectedLine.id),
    getSegmentEngagementStats(selectedLine.id),
  ]);

  // Compute tier access
  const tierAccess = computeTierAccess(
    dashboard?.userType,
    dashboard?.sharingConsent,
    dashboard?.sharingTier,
    dashboard?.lineName ?? selectedLine.display_name
  );

  return (
    <>
      <AppHeader title="Insights" description="Weekly insights without transcripts">
        {isTrialActive && trialInfo ? (
          <TrialStatusBadge daysRemaining={trialInfo.daysRemaining} planName={trialPlanName} />
        ) : null}
      </AppHeader>
      <PageBody>
        <div className="space-y-6 pb-12">
          {isTrialExpired && <TrialExpiredBanner trialPlanName={trialPlanName} />}

          <InsightsPageHeader
            lines={lines}
            currentLineShortId={selectedLine.short_id}
          />

          <EngagementTabContent
            dashboard={dashboard}
            callPreviews={callPreviews}
            storyArcs={storyArcs}
            segmentStats={segmentStats}
            timezone={selectedLine.timezone}
            tierAccess={tierAccess}
          />
        </div>
      </PageBody>
    </>
  );
}
