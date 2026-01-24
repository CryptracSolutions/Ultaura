import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getLine } from '~/lib/ultaura/lines';
import { getSchedule } from '~/lib/ultaura/schedules';
import { isUUID } from '~/lib/ultaura/short-id';

export const metadata: Metadata = {
  title: 'Edit Schedule - Ultaura',
};

interface PageProps {
  params: { lineId: string; scheduleId: string };
}

export default async function EditSchedulePage({ params }: PageProps) {
  const [line, schedule] = await Promise.all([
    getLine(params.lineId),
    getSchedule(params.scheduleId),
  ]);

  if (!line || !schedule) {
    notFound();
  }

  // Verify the schedule belongs to this line
  if (schedule.line_id !== line.id) {
    notFound();
  }

  if (isUUID(params.lineId)) {
    redirect(`/dashboard/lines/${line.short_id}/schedule?edit=${params.scheduleId}`);
  }

  redirect(`/dashboard/lines/${line.short_id}/schedule?edit=${params.scheduleId}`);
}
