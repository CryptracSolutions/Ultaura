import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLine, getSchedules, getUsageSummary, getCallSessions, getReminders } from '~/lib/ultaura/actions';
import { LineDetailClient } from './LineDetailClient';

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

  const [schedules, usage, callSessions, reminders] = await Promise.all([
    getSchedules(params.lineId),
    getUsageSummary(line.account_id),
    getCallSessions(params.lineId, 10),
    getReminders(params.lineId),
  ]);

  // If not verified, redirect to verification
  if (!line.phone_verified_at) {
    redirect(`/dashboard/lines/${params.lineId}/verify`);
  }

  // Compute pending reminders count and next reminder
  const scheduledReminders = reminders.filter(r => r.status === 'scheduled');
  const pendingRemindersCount = scheduledReminders.length;
  const nextReminder = scheduledReminders.length > 0 ? scheduledReminders[0] : null;

  return (
    <LineDetailClient
      line={line}
      schedules={schedules}
      usage={usage}
      callSessions={callSessions}
      pendingRemindersCount={pendingRemindersCount}
      nextReminder={nextReminder}
    />
  );
}
