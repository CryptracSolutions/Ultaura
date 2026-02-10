import { Metadata } from 'next';

import AdminHeader from '~/app/admin/components/AdminHeader';
import { PageBody } from '~/core/ui/Page';
import { adminGetBroadcast } from '~/lib/ultaura/newsletter-admin-actions';
import BroadcastDetailView from '../../components/BroadcastDetailView';

export const metadata: Metadata = {
  title: 'Broadcast Detail',
};

interface BroadcastDetailPageProps {
  params: { id: string };
}

export default async function BroadcastDetailPage({
  params,
}: BroadcastDetailPageProps) {
  const { broadcast, error } = await adminGetBroadcast(params.id);

  return (
    <div className={'flex flex-1 flex-col'}>
      <AdminHeader>Broadcast Detail</AdminHeader>

      <PageBody>
        <div className="flex flex-col gap-6 pb-12">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {!broadcast && !error && (
            <p className="text-sm text-muted-foreground">
              Broadcast not found.
            </p>
          )}

          {broadcast && <BroadcastDetailView broadcast={broadcast} />}
        </div>
      </PageBody>
    </div>
  );
}
