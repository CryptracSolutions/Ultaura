import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTrialInfo } from '~/lib/ultaura/accounts';
import { getLine } from '~/lib/ultaura/lines';
import { getInsightPrivacy, getNotificationPreferences } from '~/lib/ultaura/insights';
import { getAccessibilitySettings } from '~/lib/ultaura/accessibility';
import { SettingsClient } from './SettingsClient';
import { isUUID } from '~/lib/ultaura/short-id';
import AppHeader from '../../../components/AppHeader';
import { PageBody } from '~/core/ui/Page';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { TrialStatusBadge } from '~/components/ultaura/TrialStatusBadge';
import { PLANS } from '~/lib/ultaura/constants';
import type { PlanId } from '~/lib/ultaura/types';

export const metadata: Metadata = {
  title: 'Line Settings - Ultaura',
};

interface PageProps {
  params: { lineId: string };
}

export default async function LineSettingsPage({ params }: PageProps) {
  const line = await getLine(params.lineId);

  if (!line) {
    notFound();
  }

  if (isUUID(params.lineId)) {
    redirect(`/dashboard/lines/${line.short_id}/settings`);
  }

  // If not verified, redirect to verification
  if (!line.phone_verified_at) {
    redirect(`/dashboard/lines/${line.short_id}/verify`);
  }

  const [trialInfo, insightPrivacy, notificationPreferences, accessibilitySettings] = await Promise.all([
    getTrialInfo(line.account_id),
    getInsightPrivacy(line.id),
    getNotificationPreferences(line.account_id, line.id),
    getAccessibilitySettings(line.id),
  ]);
  const isTrialExpired = trialInfo?.isExpired ?? false;
  const isTrialActive = (trialInfo?.isOnTrial ?? false) && !isTrialExpired;
  const trialPlanId = trialInfo?.trialPlanId ?? null;
  const trialPlanKey = (trialPlanId ?? 'free_trial') as PlanId;
  const trialPlanName = PLANS[trialPlanKey]?.displayName ?? 'Trial';

  return (
    <>
      <AppHeader
        title={`Settings for ${line.display_name}`}
        description="Manage calling availability, insights, and accessibility for this line"
      >
        {isTrialActive && trialInfo ? (
          <TrialStatusBadge daysRemaining={trialInfo.daysRemaining} planName={trialPlanName} />
        ) : null}
      </AppHeader>
      <PageBody>
        <div className="space-y-6">
          {isTrialExpired ? <TrialExpiredBanner trialPlanName={trialPlanName} /> : null}
          <SettingsClient
            line={line}
            insightPrivacy={insightPrivacy}
            notificationPreferences={notificationPreferences}
            accessibilitySettings={accessibilitySettings}
            disabled={isTrialExpired}
          />
        </div>
      </PageBody>
    </>
  );
}
