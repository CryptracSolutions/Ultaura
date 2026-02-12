import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTrialInfo } from '~/lib/ultaura/accounts';
import { getLine, getLines } from '~/lib/ultaura/lines';
import {
  getEffectiveReminderLimit,
  getUltauraAccountById,
} from '~/lib/ultaura/helpers';
import { getSchedules } from '~/lib/ultaura/schedules';
import { getUsageSummary, getCallSessions, getLineUsage } from '~/lib/ultaura/usage';
import { getReminders } from '~/lib/ultaura/reminders';
import { getMilestones } from '~/lib/ultaura/milestones';
import { getTrustedContacts } from '~/lib/ultaura/contacts';
import { isUUID } from '~/lib/ultaura/short-id';
import { LineDetailClient } from './LineDetailClient';
import { PageBody } from '~/core/ui/Page';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { PLANS } from '~/lib/ultaura/constants';
import AppHeader from '../../components/AppHeader';
import type { PlanId } from '~/lib/ultaura/types';

// Helper to get counts without fetching full data
async function getScheduleAndReminderCounts(lineId: string) {
  const [schedules, reminders, milestones, trustedContacts] = await Promise.all([
    getSchedules(lineId),
    getReminders(lineId),
    getMilestones(lineId),
    getTrustedContacts(lineId),
  ]);

  return {
    activeSchedulesCount: schedules.filter(s => s.enabled).length,
    pendingRemindersCount: reminders.filter(r => r.status === 'scheduled').length,
    milestonesCount: milestones.length,
    trustedContactsCount: trustedContacts.length,
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
    notFound();
  }

  if (isUUID(params.lineId)) {
    redirect(`/dashboard/lines/${line.short_id}`);
  }

  // If not verified, redirect to verification
  if (!line.phone_verified_at) {
    redirect(`/dashboard/lines/${line.short_id}/verify`);
  }

  const [usage, callSessions, counts, lines, lineUsage] = await Promise.all([
    getUsageSummary(line.account_id),
    getCallSessions(line.id, 500),
    getScheduleAndReminderCounts(line.id),
    getLines(line.account_id),
    getLineUsage(line.id),
  ]);

  const account = await getUltauraAccountById(line.account_id);
  const isFamilyManaged = account?.user_type === 'family_managed';

  const trialInfo = await getTrialInfo(line.account_id);
  const isTrialExpired = trialInfo?.isExpired ?? false;
  const isTrialActive = (trialInfo?.isOnTrial ?? false) && !isTrialExpired;
  const trialPlanKey = (trialInfo?.trialPlanId ?? 'free_trial') as PlanId;
  const trialPlanName = PLANS[trialPlanKey]?.displayName ?? 'Trial';
  const reminderLimitPerLine = account ? getEffectiveReminderLimit(account) : null;

  return (
    <>
      <AppHeader title="Lines" description="Manage settings for this line" />
      <PageBody>
        <div className="space-y-6">
          {isTrialExpired && <TrialExpiredBanner trialPlanName={trialPlanName} />}
          <LineDetailClient
            line={line}
            lines={lines}
            usage={usage}
            lineUsage={lineUsage}
            callSessions={callSessions}
            activeSchedulesCount={counts.activeSchedulesCount}
            pendingRemindersCount={counts.pendingRemindersCount}
            reminderLimitPerLine={reminderLimitPerLine}
            milestonesCount={counts.milestonesCount}
            trustedContactsCount={counts.trustedContactsCount}
            isReadOnly={isTrialExpired}
            isTrialActive={isTrialActive}
            isFamilyManaged={isFamilyManaged}
          />
        </div>
      </PageBody>
    </>
  );
}
