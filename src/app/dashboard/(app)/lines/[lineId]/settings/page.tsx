import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLine } from '~/lib/ultaura/actions';
import { SettingsClient } from './SettingsClient';
import AppHeader from '../../../components/AppHeader';
import { PageBody } from '~/core/ui/Page';

export const metadata: Metadata = {
  title: 'Line Settings - Ultaura',
};

interface PageProps {
  params: { lineId: string };
}

export default async function LineSettingsPage({ params }: PageProps) {
  const line = await getLine(params.lineId);

  if (!line) {
    redirect('/dashboard/lines');
  }

  // If not verified, redirect to verification
  if (!line.phone_verified_at) {
    redirect(`/dashboard/lines/${params.lineId}/verify`);
  }

  return (
    <>
      <AppHeader title={`Settings for ${line.display_name}`} description="Manage line preferences and information" />
      <PageBody>
        <SettingsClient line={line} />
      </PageBody>
    </>
  );
}
