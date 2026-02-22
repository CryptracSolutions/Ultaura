import { Metadata } from 'next';

import AdminHeader from '~/app/admin/components/AdminHeader';
import AdminGuard from '~/app/admin/components/AdminGuard';
import Alert from '~/core/ui/Alert';
import { PageBody } from '~/core/ui/Page';
import { adminListBroadcasts } from '~/lib/ultaura/newsletter-admin-actions';
import BroadcastTable from '../components/BroadcastTable';
import Button from '~/core/ui/Button';

export const metadata: Metadata = {
  title: 'Newsletter Broadcasts',
};

async function BroadcastsPage() {
  const { broadcasts, error } = await adminListBroadcasts();

  return (
    <div className={'flex flex-1 flex-col'}>
      <AdminHeader description="Manage email campaigns">Newsletter Broadcasts</AdminHeader>

      <PageBody>
        <div className="flex flex-col gap-6 pb-12">
          <div className="flex justify-end">
            <Button href="/admin/newsletter/broadcasts/new">
              New Broadcast
            </Button>
          </div>

          {error && <Alert type="error">{error}</Alert>}

          <BroadcastTable broadcasts={broadcasts} />
        </div>
      </PageBody>
    </div>
  );
}

export default AdminGuard(BroadcastsPage);
