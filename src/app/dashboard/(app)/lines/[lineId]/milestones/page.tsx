import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTrialInfo } from '~/lib/ultaura/accounts';
import { getLine, getLines } from '~/lib/ultaura/lines';
import { getMilestones } from '~/lib/ultaura/milestones';
import { MilestonesClient } from './MilestonesClient';
import { isUUID } from '~/lib/ultaura/short-id';
import { PageBody } from '~/core/ui/Page';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { PLANS } from '~/lib/ultaura/constants';
import type { PlanId } from '~/lib/ultaura/types';
import AppHeader from '../../../components/AppHeader';
import { LinePageHeader } from '../components/LinePageHeader';

export const metadata: Metadata = {
  title: 'Milestones - Ultaura',
};

interface PageProps {
  params: { lineId: string };
}

export default async function MilestonesPage({ params }: PageProps) {
  const line = await getLine(params.lineId);

  if (!line) {
    notFound();
  }

  if (isUUID(params.lineId)) {
    redirect(`/dashboard/lines/${line.short_id}/milestones`);
  }

  if (!line.phone_verified_at) {
    redirect(`/dashboard/lines/${line.short_id}/verify`);
  }

  const [milestones, trialInfo, lines] = await Promise.all([
    getMilestones(line.id),
    getTrialInfo(line.account_id),
    getLines(line.account_id),
  ]);

  const isTrialExpired = trialInfo?.isExpired ?? false;
  const trialPlanId = trialInfo?.trialPlanId ?? null;
  const trialPlanKey = (trialPlanId ?? 'free_trial') as PlanId;
  const trialPlanName = PLANS[trialPlanKey]?.displayName ?? 'Trial';

  return (
    <>
      <AppHeader title="Lines" description="Manage settings for this line" />
      <PageBody>
        <div className="space-y-6">
          <LinePageHeader
            lines={lines}
            currentLineShortId={line.short_id}
          />
          {isTrialExpired ? <TrialExpiredBanner trialPlanName={trialPlanName} /> : null}
          <MilestonesClient line={line} milestones={milestones} disabled={isTrialExpired} />
        </div>
      </PageBody>
    </>
  );
}
