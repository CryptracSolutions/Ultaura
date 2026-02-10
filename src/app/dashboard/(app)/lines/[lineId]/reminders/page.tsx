import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTrialInfo } from '~/lib/ultaura/accounts';
import { getLine, getLines } from '~/lib/ultaura/lines';
import { getPendingReminderCount, getReminders } from '~/lib/ultaura/reminders';
import { RemindersClient } from './RemindersClient';
import { isUUID } from '~/lib/ultaura/short-id';
import { PageBody } from '~/core/ui/Page';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { PLANS } from '~/lib/ultaura/constants';
import AppHeader from '../../../components/AppHeader';
import type { PlanId } from '~/lib/ultaura/types';
import { LinePageHeader } from '../components/LinePageHeader';
import { getUltauraAccountById } from '~/lib/ultaura/helpers';

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

  const [account, reminders, trialInfo, lines, activeReminderCount] = await Promise.all([
    getUltauraAccountById(line.account_id),
    getReminders(line.id),
    getTrialInfo(line.account_id),
    getLines(line.account_id),
    getPendingReminderCount(line.id),
  ]);

  const isTrialExpired = trialInfo?.isExpired ?? false;
  const trialPlanId = trialInfo?.trialPlanId ?? null;
  const trialPlanKey = (trialPlanId ?? 'free_trial') as PlanId;
  const trialPlanName = PLANS[trialPlanKey]?.displayName ?? 'Trial';
  const isOnTrial = trialInfo?.isOnTrial ?? account?.status === 'trial';
  const isTrialActive = isOnTrial && !isTrialExpired;

  const effectivePlanIdRaw = isTrialActive
    ? (trialInfo?.trialPlanId ?? account?.trial_plan_id ?? account?.plan_id ?? 'free_trial')
    : (account?.plan_id ?? 'free_trial');
  const effectivePlanId: PlanId = effectivePlanIdRaw in PLANS
    ? (effectivePlanIdRaw as PlanId)
    : 'free_trial';
  const reminderLimit = PLANS[effectivePlanId].remindersPerLine;

  return (
    <>
      <AppHeader title="Lines" description="Manage settings for this line" />
      <PageBody>
        <div className="space-y-6">
          <LinePageHeader
            lines={lines}
            currentLineShortId={line.short_id}
            showTabs={false}
          />
          {isTrialExpired ? <TrialExpiredBanner trialPlanName={trialPlanName} /> : null}
          <RemindersClient
            line={line}
            reminders={reminders}
            disabled={isTrialExpired}
            reminderLimit={reminderLimit}
            activeReminderCount={activeReminderCount}
          />
        </div>
      </PageBody>
    </>
  );
}
