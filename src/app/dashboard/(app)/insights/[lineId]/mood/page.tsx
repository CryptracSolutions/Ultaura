import { Metadata } from 'next';
import { DateTime } from 'luxon';
import AppHeader from '../../../components/AppHeader';
import { PageBody } from '~/core/ui/Page';
import {
  getInsightsDashboard,
  getEmotionalTrends,
  getMoodCalendar,
} from '~/lib/ultaura/insights';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { TrialStatusBadge } from '~/components/ultaura/TrialStatusBadge';
import { InsightsPageHeader } from '../components/InsightsPageHeader';
import { MoodTabContent } from '../components/MoodTabContent';
import Button from '~/core/ui/Button';
import { computeTierAccess } from '../components/tier-utils';
import { loadInsightsPageData } from '../loader';

export const metadata: Metadata = {
  title: 'Mood & Wellness - Insights - Ultaura',
};

interface PageProps {
  params: Promise<{
    lineId: string;
  }>;
}

export default async function InsightsMoodPage({ params }: PageProps) {
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
            <Button variant="default" href="/dashboard/settings/subscription">
              Start 3-day free trial
            </Button>
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

  // Fetch data needed for Mood tab
  const monthKey = DateTime.now().setZone(selectedLine.timezone).toFormat('yyyy-MM');

  const [dashboard, emotionalTrends, moodCalendar] = await Promise.all([
    getInsightsDashboard(selectedLine.id),
    getEmotionalTrends(selectedLine.id),
    getMoodCalendar(selectedLine.id, monthKey),
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

          <MoodTabContent
            dashboard={dashboard}
            emotionalTrends={emotionalTrends}
            moodCalendar={moodCalendar}
            timezone={selectedLine.timezone}
            tierAccess={tierAccess}
          />
        </div>
      </PageBody>
    </>
  );
}
