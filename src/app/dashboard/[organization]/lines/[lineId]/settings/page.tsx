import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLine } from '~/lib/ultaura/actions';
import { SettingsClient } from './SettingsClient';

export const metadata: Metadata = {
  title: 'Line Settings - Ultaura',
};

interface PageProps {
  params: { organization: string; lineId: string };
}

export default async function LineSettingsPage({ params }: PageProps) {
  const line = await getLine(params.lineId);

  if (!line) {
    redirect(`/dashboard/${params.organization}/lines`);
  }

  // If not verified, redirect to verification
  if (!line.phone_verified_at) {
    redirect(`/dashboard/${params.organization}/lines/${params.lineId}/verify`);
  }

  return <SettingsClient line={line} organizationSlug={params.organization} />;
}
