import { notFound, redirect } from 'next/navigation';
import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import { getUltauraAccount, getTrialInfo } from '~/lib/ultaura/accounts';
import { getLines } from '~/lib/ultaura/lines';
import { getInsightsDashboard } from '~/lib/ultaura/insights';
import type { LineRow, LineStatus } from '~/lib/ultaura/types';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import { PLANS } from '~/lib/ultaura/constants';
import type { PlanId } from '~/lib/ultaura/types';

export interface LineOption {
  id: string;
  short_id: string;
  display_name: string;
  phone_e164: string;
  timezone: string;
  status: LineStatus;
  phone_verified_at: string | null;
  insights_enabled: boolean;
}

export interface InsightsLoaderResult {
  account: NonNullable<Awaited<ReturnType<typeof getUltauraAccount>>>;
  lines: LineOption[];
  selectedLine: LineOption;
  trialInfo: Awaited<ReturnType<typeof getTrialInfo>>;
  isTrialExpired: boolean;
  isTrialActive: boolean;
  trialPlanName: string;
}

/**
 * Shared loader for insights pages. Returns validated account, lines, and selected line.
 * Redirects or throws notFound as appropriate.
 */
export async function loadInsightsPageData(lineId: string): Promise<InsightsLoaderResult | null> {
  const appData = await loadAppDataForUser();
  const organizationId = appData.organization?.id;

  if (!organizationId) {
    return null; // Page should show "Organization not found"
  }

  const account = await getUltauraAccount(organizationId);

  if (!account) {
    return null; // Page should show "Get Started" CTA
  }

  const [lines, trialInfo] = await Promise.all([
    getLines(account.id),
    getTrialInfo(account.id),
  ]);

  const isTrialExpired = trialInfo?.isExpired ?? false;
  const isTrialActive = (trialInfo?.isOnTrial ?? false) && !isTrialExpired;
  const trialPlanId = (trialInfo?.trialPlanId ?? 'free_trial') as PlanId;
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
    id: line.id,
    short_id: line.short_id,
    display_name: line.display_name,
    phone_e164: line.phone_e164,
    timezone: line.timezone,
    status: line.status,
    phone_verified_at: line.phone_verified_at,
    insights_enabled: privacyMap.get(line.id) ?? true,
  }));

  // Find the selected line by short_id
  const selectedLine = lineOptions.find((line) => line.short_id === lineId);

  if (!selectedLine) {
    notFound();
  }

  return {
    account,
    lines: lineOptions,
    selectedLine,
    trialInfo,
    isTrialExpired,
    isTrialActive,
    trialPlanName,
  };
}
