import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTrialInfo } from '~/lib/ultaura/accounts';
import { getLine } from '~/lib/ultaura/lines';
import { getSchedule } from '~/lib/ultaura/schedules';
import { EditScheduleClient } from './EditScheduleClient';
import AppHeader from '../../../../components/AppHeader';
import { PageBody } from '~/core/ui/Page';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { TrialStatusBadge } from '~/components/ultaura/TrialStatusBadge';
import { PLANS } from '~/lib/ultaura/constants';
import type { PlanId } from '~/lib/ultaura/types';

export const metadata: Metadata = {
  title: 'Edit Schedule - Ultaura',
};

interface PageProps {
  params: { lineId: string; scheduleId: string };
}

export default async function EditSchedulePage({ params }: PageProps) {
  const [line, schedule] = await Promise.all([
    getLine(params.lineId),
    getSchedule(params.scheduleId),
  ]);

  if (!line || !schedule) {
    redirect('/dashboard/lines');
  }

  // Verify the schedule belongs to this line
  if (schedule.line_id !== line.id) {
    redirect(`/dashboard/lines/${params.lineId}`);
  }

  const trialInfo = await getTrialInfo(line.account_id);
  const isTrialExpired = trialInfo?.isExpired ?? false;
  const isTrialActive = (trialInfo?.isOnTrial ?? false) && !isTrialExpired;
  const trialPlanId = trialInfo?.trialPlanId ?? null;
  const trialPlanKey = (trialPlanId ?? 'free_trial') as PlanId;
  const trialPlanName = PLANS[trialPlanKey]?.displayName ?? 'Trial';

  return (
    <>
      <AppHeader title="Edit Schedule" description={`Modify schedule for ${line.display_name}`}>
        {isTrialActive && trialInfo ? (
          <TrialStatusBadge daysRemaining={trialInfo.daysRemaining} planName={trialPlanName} />
        ) : null}
      </AppHeader>
      <PageBody>
        <div className="space-y-6">
          {isTrialExpired ? <TrialExpiredBanner trialPlanName={trialPlanName} /> : null}
          <EditScheduleClient line={line} schedule={schedule} disabled={isTrialExpired} />
        </div>
      </PageBody>
    </>
  );
}
