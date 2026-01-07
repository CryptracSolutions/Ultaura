import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTrialInfo } from '~/lib/ultaura/accounts';
import { getLine } from '~/lib/ultaura/lines';
import { getReminders } from '~/lib/ultaura/reminders';
import { RemindersClient } from './RemindersClient';
import { isUUID } from '~/lib/ultaura/short-id';
import AppHeader from '../../../components/AppHeader';
import { PageBody } from '~/core/ui/Page';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { TrialStatusBadge } from '~/components/ultaura/TrialStatusBadge';
import { PLANS } from '~/lib/ultaura/constants';
import type { PlanId } from '~/lib/ultaura/types';

export const metadata: Metadata = {
  title: 'Reminders - Ultaura',
};

interface PageProps {
  params: { lineId: string };
}

export default async function RemindersPage({ params }: PageProps) {
  const line = await getLine(params.lineId);

  if (!line) {
    notFound();
  }

  if (isUUID(params.lineId)) {
    redirect(`/dashboard/lines/${line.short_id}/reminders`);
  }

  // If not verified, redirect to verification
  if (!line.phone_verified_at) {
    redirect(`/dashboard/lines/${line.short_id}/verify`);
  }

  const [reminders, trialInfo] = await Promise.all([
    getReminders(line.id),
    getTrialInfo(line.account_id),
  ]);

  const isTrialExpired = trialInfo?.isExpired ?? false;
  const isTrialActive = (trialInfo?.isOnTrial ?? false) && !isTrialExpired;
  const trialPlanId = trialInfo?.trialPlanId ?? null;
  const trialPlanKey = (trialPlanId ?? 'free_trial') as PlanId;
  const trialPlanName = PLANS[trialPlanKey]?.displayName ?? 'Trial';

  return (
    <>
      <AppHeader
        title={`Reminders for ${line.display_name}`}
        description="Set up helpful reminders for any routine, task, or event"
      >
        {isTrialActive && trialInfo ? (
          <TrialStatusBadge daysRemaining={trialInfo.daysRemaining} planName={trialPlanName} />
        ) : null}
      </AppHeader>
      <PageBody>
        <div className="space-y-6">
          {isTrialExpired ? <TrialExpiredBanner trialPlanName={trialPlanName} /> : null}
          <RemindersClient line={line} reminders={reminders} disabled={isTrialExpired} />
        </div>
      </PageBody>
    </>
  );
}
