import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getLine, getLines } from '~/lib/ultaura/lines';
import { getTrialInfo } from '~/lib/ultaura/accounts';
import { getUltauraAccountById } from '~/lib/ultaura/helpers';
import { isUUID } from '~/lib/ultaura/short-id';
import { PageBody } from '~/core/ui/Page';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { PLANS } from '~/lib/ultaura/constants';
import type { PlanId, UserType } from '~/lib/ultaura/types';
import AppHeader from '../../../components/AppHeader';
import { LinePageHeader } from '../components/LinePageHeader';
import { TopicsClient } from './TopicsClient';

export const metadata: Metadata = {
  title: 'Topics - Ultaura',
};

interface PageProps {
  params: { lineId: string };
}

export default async function TopicsPage({ params }: PageProps) {
  const line = await getLine(params.lineId);

  if (!line) {
    notFound();
  }

  if (isUUID(params.lineId)) {
    redirect(`/dashboard/lines/${line.short_id}/topics`);
  }

  if (!line.phone_verified_at) {
    redirect(`/dashboard/lines/${line.short_id}/verify`);
  }

  const [account, trialInfo, lines] = await Promise.all([
    getUltauraAccountById(line.account_id),
    getTrialInfo(line.account_id),
    getLines(line.account_id),
  ]);

  // Default to 'self' (read-only) when account lookup fails for security
  const userType = (account?.user_type ?? 'self') as UserType;
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
          <TopicsClient line={line} userType={userType} disabled={isTrialExpired} />
        </div>
      </PageBody>
    </>
  );
}
