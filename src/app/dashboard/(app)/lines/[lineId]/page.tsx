import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTrialInfo } from '~/lib/ultaura/accounts';
import { getLine } from '~/lib/ultaura/lines';
import { getSchedules } from '~/lib/ultaura/schedules';
import { getUsageSummary, getCallSessions } from '~/lib/ultaura/usage';
import { getReminders } from '~/lib/ultaura/reminders';
import { LineDetailClient } from './LineDetailClient';
import AppHeader from '../../components/AppHeader';
import { PageBody } from '~/core/ui/Page';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { TrialStatusBadge } from '~/components/ultaura/TrialStatusBadge';
import { PLANS } from '~/lib/ultaura/constants';
import type { PlanId } from '~/lib/ultaura/types';

// Helper to get counts without fetching full data
async function getScheduleAndReminderCounts(lineId: string) {
  const [schedules, reminders] = await Promise.all([
    getSchedules(lineId),
    getReminders(lineId),
  ]);

  return {
    activeSchedulesCount: schedules.filter(s => s.enabled).length,
    pendingRemindersCount: reminders.filter(r => r.status === 'scheduled').length,
  };
}

export const metadata: Metadata = {
  title: 'Line Details - Ultaura',
};

interface PageProps {
  params: { lineId: string };
}

export default async function LineDetailPage({ params }: PageProps) {
  const line = await getLine(params.lineId);

  if (!line) {
    redirect('/dashboard/lines');
  }

  // If not verified, redirect to verification
  if (!line.phone_verified_at) {
    redirect(`/dashboard/lines/${params.lineId}/verify`);
  }

  const [usage, callSessions, counts] = await Promise.all([
    getUsageSummary(line.account_id),
    getCallSessions(line.id, 10),
    getScheduleAndReminderCounts(line.id),
  ]);

  const trialInfo = await getTrialInfo(line.account_id);
  const isTrialExpired = trialInfo?.isExpired ?? false;
  const isOnTrial = trialInfo?.isOnTrial ?? false;
  const isTrialActive = isOnTrial && !isTrialExpired;
  const trialPlanId = trialInfo?.trialPlanId ?? null;
  const trialPlanKey = (trialPlanId ?? 'free_trial') as PlanId;
  const trialPlanName = PLANS[trialPlanKey]?.displayName ?? 'Trial';

  return (
    <>
      <AppHeader title={line.display_name} description="View and manage this phone line">
        {isTrialActive && trialInfo ? (
          <TrialStatusBadge daysRemaining={trialInfo.daysRemaining} planName={trialPlanName} />
        ) : null}
      </AppHeader>
      <PageBody>
        <div className="space-y-6">
          {isTrialExpired ? <TrialExpiredBanner trialPlanName={trialPlanName} /> : null}

          <LineDetailClient
            line={line}
            usage={usage}
            callSessions={callSessions}
            activeSchedulesCount={counts.activeSchedulesCount}
            pendingRemindersCount={counts.pendingRemindersCount}
            isReadOnly={isTrialExpired}
            isTrialActive={isTrialActive}
          />
        </div>
      </PageBody>
    </>
  );
}
