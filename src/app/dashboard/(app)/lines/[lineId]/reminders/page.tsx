import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLine, getReminders } from '~/lib/ultaura/actions';
import { RemindersClient } from './RemindersClient';

export const metadata: Metadata = {
  title: 'Reminders - Ultaura',
};

interface PageProps {
  params: { lineId: string };
}

export default async function RemindersPage({ params }: PageProps) {
  const line = await getLine(params.lineId);

  if (!line) {
    redirect('/dashboard/lines');
  }

  // If not verified, redirect to verification
  if (!line.phone_verified_at) {
    redirect(`/dashboard/lines/${params.lineId}/verify`);
  }

  const reminders = await getReminders(params.lineId);

  return <RemindersClient line={line} reminders={reminders} />;
}
