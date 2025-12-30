import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLine, getSchedules, getTrialInfo } from '~/lib/ultaura/actions';
import { ScheduleClient } from './ScheduleClient';
import AppHeader from '../../../components/AppHeader';
import { PageBody } from '~/core/ui/Page';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { TrialStatusBadge } from '~/components/ultaura/TrialStatusBadge';
import { PLANS } from '~/lib/ultaura/constants';

export const metadata: Metadata = {
  title: 'Schedule Calls - Ultaura',
};

interface PageProps {
  params: { lineId: string };
}

export default async function SchedulePage({ params }: PageProps) {
  const line = await getLine(params.lineId);

  if (!line) {
    redirect('/dashboard/lines');
  }

  // If not verified, redirect to verification
  if (!line.phone_verified_at) {
    redirect(`/dashboard/lines/${params.lineId}/verify`);
  }

  const [schedules, trialInfo] = await Promise.all([
    getSchedules(line.id),
    getTrialInfo(line.account_id),
  ]);

  const isTrialExpired = trialInfo?.isExpired ?? false;
  const isTrialActive = (trialInfo?.isOnTrial ?? false) && !isTrialExpired;
  const trialPlanId = trialInfo?.trialPlanId ?? null;
  const trialPlanName = trialPlanId ? (PLANS[trialPlanId]?.displayName ?? 'Trial') : 'Trial';

  return (
    <>
      <AppHeader title={`Schedule for ${line.display_name}`} description="Set up recurring check-in calls">
        {isTrialActive && trialInfo ? (
          <TrialStatusBadge daysRemaining={trialInfo.daysRemaining} planName={trialPlanName} />
        ) : null}
      </AppHeader>
      <PageBody>
        <div className="space-y-6">
          {isTrialExpired ? <TrialExpiredBanner trialPlanName={trialPlanName} /> : null}
          <ScheduleClient line={line} schedules={schedules} disabled={isTrialExpired} />
        </div>
      </PageBody>
    </>
  );
}
