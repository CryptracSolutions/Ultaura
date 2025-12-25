import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLine } from '~/lib/ultaura/actions';
import { ContactsClient } from './ContactsClient';
import AppHeader from '../../../components/AppHeader';
import { PageBody } from '~/core/ui/Page';

export const metadata: Metadata = {
  title: 'Trusted Contacts - Ultaura',
};

interface PageProps {
  params: { lineId: string };
}

export default async function TrustedContactsPage({ params }: PageProps) {
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
      <AppHeader title="Trusted Contacts" description={`Emergency contacts for ${line.display_name}`} />
      <PageBody>
        <ContactsClient lineId={params.lineId} />
      </PageBody>
    </>
  );
}
