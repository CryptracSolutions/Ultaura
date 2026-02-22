import { Metadata } from 'next';

import AdminHeader from '~/app/admin/components/AdminHeader';
import AdminGuard from '~/app/admin/components/AdminGuard';
import { PageBody } from '~/core/ui/Page';
import BroadcastComposer from '../../components/BroadcastComposer';

export const metadata: Metadata = {
  title: 'New Broadcast',
};

function NewBroadcastPage() {
  return (
    <div className={'flex flex-1 flex-col'}>
      <AdminHeader description="Compose a new broadcast">New Broadcast</AdminHeader>

      <PageBody>
        <div className="flex flex-col gap-6 pb-12">
          <BroadcastComposer />
        </div>
      </PageBody>
    </div>
  );
}

export default AdminGuard(NewBroadcastPage);
