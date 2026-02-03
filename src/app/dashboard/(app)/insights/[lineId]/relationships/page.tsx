import { Metadata } from 'next';
import Link from 'next/link';
import AppHeader from '../../../components/AppHeader';
import { PageBody } from '~/core/ui/Page';
import { getInsightsDashboard } from '~/lib/ultaura/insights';
import { getRelationships } from '~/lib/ultaura/relationships';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { TrialStatusBadge } from '~/components/ultaura/TrialStatusBadge';
import { InsightsPageHeader } from '../components/InsightsPageHeader';
import { RelationshipsTabContent } from '../components/RelationshipsTabContent';
import { COMPACT_PRIMARY_BUTTON_CLASS } from '~/app/dashboard/(app)/components/compact-action-classes';
import { computeTierAccess } from '../components/tier-utils';
import { loadInsightsPageData } from '../loader';

export const metadata: Metadata = {
  title: 'Relationships - Insights - Ultaura',
};

interface PageProps {
  params: Promise<{
    lineId: string;
  }>;
}

export default async function InsightsRelationshipsPage({ params }: PageProps) {
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
              className={COMPACT_PRIMARY_BUTTON_CLASS}
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

  // Fetch data needed for Relationships tab
  const [dashboard, relationships] = await Promise.all([
    getInsightsDashboard(selectedLine.id),
    getRelationships(selectedLine.id),
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

          <RelationshipsTabContent
            relationships={relationships}
            timezone={selectedLine.timezone}
            tierAccess={tierAccess}
          />
        </div>
      </PageBody>
    </>
  );
}
