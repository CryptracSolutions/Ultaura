import AdminStatCard from '~/app/admin/components/AdminStatCard';
import {
  UsersIcon,
  UserGroupIcon,
  CreditCardIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';

interface Data {
  usersCount: number;
  organizationsCount: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
}

function AdminDashboard({
  data,
}: React.PropsWithChildren<{
  data: Data;
}>) {
  return (
    <div className={'grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}>
      <AdminStatCard
        icon={UsersIcon}
        label="Users"
        value={data.usersCount}
      />

      <AdminStatCard
        icon={UserGroupIcon}
        label="Organizations"
        value={data.organizationsCount}
      />

      <AdminStatCard
        icon={CreditCardIcon}
        label="Paying Customers"
        value={data.activeSubscriptions}
      />

      <AdminStatCard
        icon={BeakerIcon}
        label="Trials"
        value={data.trialSubscriptions}
      />
    </div>
  );
}

export default AdminDashboard;
