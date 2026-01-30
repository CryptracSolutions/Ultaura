import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTrialInfo } from '~/lib/ultaura/accounts';
import { getLine, getLines } from '~/lib/ultaura/lines';
import { getSchedules } from '~/lib/ultaura/schedules';
import { getUpcomingExceptions } from '~/lib/ultaura/schedule-exceptions';
import { ScheduleClient } from './ScheduleClient';
import { isUUID } from '~/lib/ultaura/short-id';
import { PageBody } from '~/core/ui/Page';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { PLANS } from '~/lib/ultaura/constants';
import AppHeader from '../../../components/AppHeader';
import type { PlanId } from '~/lib/ultaura/types';
import { LinePageHeader } from '../components/LinePageHeader';

export const metadata: Metadata = {
  title: 'Schedule Calls - Ultaura',
};

interface PageProps {
  params: { lineId: string };
}

export default async function SchedulePage({ params }: PageProps) {
  const line = await getLine(params.lineId);

  if (!line) {
    notFound();
  }

  if (isUUID(params.lineId)) {
    redirect(`/dashboard/lines/${line.short_id}/schedule`);
  }

  // If not verified, redirect to verification
  if (!line.phone_verified_at) {
    redirect(`/dashboard/lines/${line.short_id}/verify`);
  }

  const [schedules, trialInfo, exceptions, lines] = await Promise.all([
    getSchedules(line.id),
    getTrialInfo(line.account_id),
    getUpcomingExceptions(line.id),
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
            showTabs={false}
          />
          {isTrialExpired ? <TrialExpiredBanner trialPlanName={trialPlanName} /> : null}
          <ScheduleClient
            line={line}
            schedules={schedules}
            exceptions={exceptions}
            disabled={isTrialExpired}
          />
        </div>
      </PageBody>
    </>
  );
}
