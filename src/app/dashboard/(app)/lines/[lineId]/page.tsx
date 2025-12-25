import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLine, getSchedules, getUsageSummary, getCallSessions, getReminders } from '~/lib/ultaura/actions';
import { LineDetailClient } from './LineDetailClient';
import AppHeader from '../../components/AppHeader';
import { PageBody } from '~/core/ui/Page';

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
    getCallSessions(params.lineId, 10),
    getScheduleAndReminderCounts(params.lineId),
  ]);

  return (
    <>
      <AppHeader title={line.display_name} description="View and manage this phone line" />
      <PageBody>
        <LineDetailClient
          line={line}
          usage={usage}
          callSessions={callSessions}
          activeSchedulesCount={counts.activeSchedulesCount}
          pendingRemindersCount={counts.pendingRemindersCount}
        />
      </PageBody>
    </>
  );
}
