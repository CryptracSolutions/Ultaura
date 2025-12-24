import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLine } from '~/lib/ultaura/actions';
import { ScheduleClient } from './ScheduleClient';

export const metadata: Metadata = {
  title: 'Schedule Calls - Ultaura',
};

interface PageProps {
  params: { lineId: string };
}

export default async function SchedulePage({ params }: PageProps) {
  const line = await getLine(params.lineId);

  if (!line) {
    redirect('/dashboard/lines');
  }

  // If not verified, redirect to verification
  if (!line.phone_verified_at) {
    redirect(`/dashboard/lines/${params.lineId}/verify`);
  }

  return <ScheduleClient line={line} />;
}
