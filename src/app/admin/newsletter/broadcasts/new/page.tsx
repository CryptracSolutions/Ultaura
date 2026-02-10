import { Metadata } from 'next';

import AdminHeader from '~/app/admin/components/AdminHeader';
import { PageBody } from '~/core/ui/Page';
import BroadcastComposer from '../../components/BroadcastComposer';

export const metadata: Metadata = {
  title: 'New Broadcast',
};

export default function NewBroadcastPage() {
  return (
    <div className={'flex flex-1 flex-col'}>
      <AdminHeader>New Broadcast</AdminHeader>

      <PageBody>
        <div className="flex flex-col gap-6 pb-12">
          <BroadcastComposer />
        </div>
      </PageBody>
    </div>
  );
}
