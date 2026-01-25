import { Metadata } from 'next';
import Link from 'next/link';
import AppHeader from '../../../components/AppHeader';
import { PageBody } from '~/core/ui/Page';
import { getInsightsDashboard, getMemoryActivity } from '~/lib/ultaura/insights';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { TrialStatusBadge } from '~/components/ultaura/TrialStatusBadge';
import { InsightsPageHeader } from '../components/InsightsPageHeader';
import { MemoryTabContent } from '../components/MemoryTabContent';
import { computeTierAccess } from '../components/tier-utils';
import { loadInsightsPageData } from '../loader';

export const metadata: Metadata = {
  title: 'Memory - Insights - Ultaura',
};

interface PageProps {
  params: Promise<{
    lineId: string;
  }>;
}

export default async function InsightsMemoryPage({ params }: PageProps) {
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

  // Fetch data needed for Memory tab
  const [dashboard, memoryActivity] = await Promise.all([
    getInsightsDashboard(selectedLine.id),
    getMemoryActivity(selectedLine.id, 20),
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

          <MemoryTabContent
            memoryActivity={memoryActivity}
            timezone={selectedLine.timezone}
            tierAccess={tierAccess}
          />
        </div>
      </PageBody>
    </>
  );
}
