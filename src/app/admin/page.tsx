import AdminHeader from '~/app/admin/components/AdminHeader';
import AdminGuard from '~/app/admin/components/AdminGuard';
import AdminDashboard from '~/app/admin/components/AdminDashboard';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';

import configuration from '~/configuration';
import { PageBody } from '~/core/ui/Page';
import Alert from '~/core/ui/Alert';
import getLogger from '~/core/logger';

export const metadata = {
  title: `Admin | ${configuration.site.siteName}`,
};

async function AdminPage() {
  const { data, errors } = await loadData();

  return (
    <div className={'flex flex-col flex-1'}>
      <AdminHeader description="Platform overview and system health">Admin</AdminHeader>

      <PageBody>
        <div className={'flex flex-col space-y-4'}>
          {errors.length > 0 && (
            <Alert type={'error'}>
              <Alert.Heading>Dashboard Data Errors</Alert.Heading>
              <ul className={'list-disc pl-4 text-sm'}>
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </Alert>
          )}

          <AdminDashboard data={data} />
        </div>
      </PageBody>
    </div>
  );
}

export default AdminGuard(AdminPage);

async function loadData() {
  const client = getSupabaseServerComponentClient({ admin: true });
  const logger = getLogger();
  const errors: string[] = [];

  const usersResult = await client.from('users').select('*', {
    count: 'exact',
    head: true,
  });

  if (usersResult.error) {
    logger.error({ error: usersResult.error }, 'Admin: failed to count users');
    errors.push(`Users count failed: ${usersResult.error.message}`);
  }

  const orgsResult = await client.from('organizations').select('*', {
    count: 'exact',
    head: true,
  });

  if (orgsResult.error) {
    logger.error(
      { error: orgsResult.error },
      'Admin: failed to count organizations',
    );
    errors.push(`Organizations count failed: ${orgsResult.error.message}`);
  }

  const activeResult = await client
    .from('subscriptions')
    .select(`*`, { count: 'exact', head: true })
    .eq('status', 'active');

  if (activeResult.error) {
    logger.error(
      { error: activeResult.error },
      'Admin: failed to count active subscriptions',
    );
    errors.push(
      `Active subscriptions count failed: ${activeResult.error.message}`,
    );
  }

  const trialResult = await client
    .from('subscriptions')
    .select(`*`, { count: 'exact', head: true })
    .eq('status', 'trialing');

  if (trialResult.error) {
    logger.error(
      { error: trialResult.error },
      'Admin: failed to count trial subscriptions',
    );
    errors.push(
      `Trial subscriptions count failed: ${trialResult.error.message}`,
    );
  }

  return {
    data: {
      usersCount: usersResult.count ?? 0,
      organizationsCount: orgsResult.count ?? 0,
      activeSubscriptions: activeResult.count ?? 0,
      trialSubscriptions: trialResult.count ?? 0,
    },
    errors,
  };
}
