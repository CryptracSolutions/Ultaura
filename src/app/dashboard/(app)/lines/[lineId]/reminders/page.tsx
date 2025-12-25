import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLine, getReminders } from '~/lib/ultaura/actions';
import { RemindersClient } from './RemindersClient';
import AppHeader from '../../../components/AppHeader';
import { PageBody } from '~/core/ui/Page';

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

  return (
    <>
      <AppHeader title={`Reminders for ${line.display_name}`} description="Set up medication and activity reminders" />
      <PageBody>
        <RemindersClient line={line} reminders={reminders} />
      </PageBody>
    </>
  );
}
