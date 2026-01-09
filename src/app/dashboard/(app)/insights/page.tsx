import { Metadata } from 'next';
import Link from 'next/link';
import AppHeader from '../components/AppHeader';
import { PageBody } from '~/core/ui/Page';
import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import { getUltauraAccount, getTrialInfo } from '~/lib/ultaura/accounts';
import { getLines } from '~/lib/ultaura/lines';
import { getInsightsDashboard } from '~/lib/ultaura/insights';
import type { LineRow } from '~/lib/ultaura/types';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { TrialStatusBadge } from '~/components/ultaura/TrialStatusBadge';
import { PLANS } from '~/lib/ultaura/constants';
import { InsightsPageClient } from './InsightsPageClient';

export const metadata: Metadata = {
  title: 'Insights - Ultaura',
};

interface PageProps {
  searchParams?: {
    line?: string;
  };
}

type LineOption = LineRow & {
  insights_enabled: boolean;
};

function getDefaultLine(lines: LineOption[]): LineOption | null {
  if (lines.length === 0) return null;

  const activeLines = lines.filter((line) => line.status === 'active');
  const activeWithInsights = activeLines.filter((line) => line.insights_enabled);

  return activeWithInsights[0] || activeLines[0] || lines[0];
}

export default async function InsightsPage({ searchParams }: PageProps) {
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
    return (
      <>
        <AppHeader title="Insights" description="Weekly insights without transcripts">
          {isTrialActive && trialInfo ? (
            <TrialStatusBadge daysRemaining={trialInfo.daysRemaining} planName={trialPlanName} />
          ) : null}
        </AppHeader>
        <PageBody>
          <div className="max-w-xl rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">No phone lines yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Add a phone line to start collecting insights and weekly summaries.
            </p>
            <Link
              href="/dashboard/lines?action=add"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Add a Phone Line
            </Link>
          </div>
        </PageBody>
      </>
    );
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

  const requestedLine = searchParams?.line?.trim();
  const selectedLine =
    lineOptions.find(
      (line) => line.short_id === requestedLine || line.id === requestedLine,
    ) || getDefaultLine(lineOptions);

  const dashboard = selectedLine ? await getInsightsDashboard(selectedLine.id) : null;

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
          <InsightsPageClient
            lines={lineOptions}
            selectedLineId={selectedLine?.id ?? null}
            dashboard={dashboard}
          />
        </div>
      </PageBody>
    </>
  );
}
