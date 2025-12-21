import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLine, getSchedule } from '~/lib/ultaura/actions';
import { EditScheduleClient } from './EditScheduleClient';

export const metadata: Metadata = {
  title: 'Edit Schedule - Ultaura',
};

interface PageProps {
  params: { organization: string; lineId: string; scheduleId: string };
}

export default async function EditSchedulePage({ params }: PageProps) {
  const [line, schedule] = await Promise.all([
    getLine(params.lineId),
    getSchedule(params.scheduleId),
  ]);

  if (!line || !schedule) {
    redirect(`/dashboard/${params.organization}/lines`);
  }

  // Verify the schedule belongs to this line
  if (schedule.line_id !== params.lineId) {
    redirect(`/dashboard/${params.organization}/lines/${params.lineId}`);
  }

  return (
    <EditScheduleClient
      line={line}
      schedule={schedule}
      organizationSlug={params.organization}
    />
  );
}
