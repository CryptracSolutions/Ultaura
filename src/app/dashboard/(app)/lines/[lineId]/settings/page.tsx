import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTrialInfo } from '~/lib/ultaura/accounts';
import { getLine, getLines } from '~/lib/ultaura/lines';
import { getInsightPrivacy, getNotificationPreferences } from '~/lib/ultaura/insights';
import { getAccessibilitySettings } from '~/lib/ultaura/accessibility';
import { getLineVoiceConsent } from '~/lib/ultaura/privacy';
import { getUltauraAccountById } from '~/lib/ultaura/helpers';
import { SettingsClient } from './SettingsClient';
import { isUUID } from '~/lib/ultaura/short-id';
import { PageBody } from '~/core/ui/Page';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { PLANS } from '~/lib/ultaura/constants';
import type { PlanId } from '~/lib/ultaura/types';
import AppHeader from '../../../components/AppHeader';
import { LinePageHeader } from '../components/LinePageHeader';

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

  const [
    trialInfo,
    insightPrivacy,
    notificationPreferences,
    accessibilitySettings,
    voiceConsent,
    account,
    lines,
  ] = await Promise.all([
    getTrialInfo(line.account_id),
    getInsightPrivacy(line.id),
    getNotificationPreferences(line.account_id, line.id),
    getAccessibilitySettings(line.id),
    getLineVoiceConsent(line.id),
    getUltauraAccountById(line.account_id),
    getLines(line.account_id),
  ]);
  const isTrialExpired = trialInfo?.isExpired ?? false;
  const trialPlanId = trialInfo?.trialPlanId ?? null;
  const trialPlanKey = (trialPlanId ?? 'free_trial') as PlanId;
  const trialPlanName = PLANS[trialPlanKey]?.displayName ?? 'Trial';

  return (
    <>
      <AppHeader title="Lines" />
      <PageBody>
        <div className="space-y-6">
          <LinePageHeader
            lines={lines}
            currentLineShortId={line.short_id}
          />
          {isTrialExpired ? <TrialExpiredBanner trialPlanName={trialPlanName} /> : null}
          <SettingsClient
            line={line}
            insightPrivacy={insightPrivacy}
            notificationPreferences={notificationPreferences}
            accessibilitySettings={accessibilitySettings}
            voiceConsent={voiceConsent}
            userType={(account?.user_type ?? 'family_managed') as 'self' | 'family_managed'}
            disabled={isTrialExpired}
          />
        </div>
      </PageBody>
    </>
  );
}
