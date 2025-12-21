import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLine, getSchedules, getUsageSummary } from '~/lib/ultaura/actions';
import { LineDetailClient } from './LineDetailClient';

export const metadata: Metadata = {
  title: 'Line Details - Ultaura',
};

interface PageProps {
  params: { organization: string; lineId: string };
}

export default async function LineDetailPage({ params }: PageProps) {
  const [line, schedules, usage] = await Promise.all([
    getLine(params.lineId),
    getSchedules(params.lineId),
    getUsageSummary(),
  ]);

  if (!line) {
    redirect(`/dashboard/${params.organization}/lines`);
  }

  // If not verified, redirect to verification
  if (!line.phone_verified_at) {
    redirect(`/dashboard/${params.organization}/lines/${params.lineId}/verify`);
  }

  return (
    <LineDetailClient
      line={line}
      schedules={schedules}
      usage={usage}
      organizationSlug={params.organization}
    />
  );
}
