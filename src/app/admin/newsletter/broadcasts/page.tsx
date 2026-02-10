import { Metadata } from 'next';

import AdminHeader from '~/app/admin/components/AdminHeader';
import { PageBody } from '~/core/ui/Page';
import { adminListBroadcasts } from '~/lib/ultaura/newsletter-admin-actions';
import BroadcastTable from '../components/BroadcastTable';
import Button from '~/core/ui/Button';

export const metadata: Metadata = {
  title: 'Newsletter Broadcasts',
};

export default async function BroadcastsPage() {
  const { broadcasts, error } = await adminListBroadcasts();

  return (
    <div className={'flex flex-1 flex-col'}>
      <AdminHeader>Newsletter Broadcasts</AdminHeader>

      <PageBody>
        <div className="flex flex-col gap-6 pb-12">
          <div className="flex justify-end">
            <Button href="/admin/newsletter/broadcasts/new">
              New Broadcast
            </Button>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <BroadcastTable broadcasts={broadcasts} />
        </div>
      </PageBody>
    </div>
  );
}
