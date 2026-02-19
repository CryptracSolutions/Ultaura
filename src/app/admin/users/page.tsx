import AdminHeader from '~/app/admin/components/AdminHeader';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import AdminGuard from '~/app/admin/components/AdminGuard';
import UsersTable from '~/app/admin/users/components/UsersTable';
import { getUsers } from '~/app/admin/users/queries';
import UserData from '~/core/session/types/user-data';
import getPageFromQueryParams from '~/app/admin/utils/get-page-from-query-param';
import { PageBody } from '~/core/ui/Page';
import Alert from '~/core/ui/Alert';
import configuration from '~/configuration';
import getLogger from '~/core/logger';

const VALID_PER_PAGE = [20, 50, 100] as const;

interface UsersAdminPageProps {
  searchParams: {
    page?: string;
    perPage?: string;
  };
}

export const metadata = {
  title: `Users | ${configuration.site.siteName}`,
};

function getPerPage(param?: string): number {
  const parsed = param ? parseInt(param, 10) : 20;
  if (VALID_PER_PAGE.includes(parsed as (typeof VALID_PER_PAGE)[number])) {
    return parsed;
  }
  return 20;
}

async function UsersAdminPage({ searchParams }: UsersAdminPageProps) {
  const page = getPageFromQueryParams(searchParams.page);
  const perPage = getPerPage(searchParams.perPage);

  let users: Awaited<ReturnType<typeof loadUsers>>['users'] = [];
  let total = 0;
  let loadError: string | null = null;

  try {
    const result = await loadUsers(page, perPage);
    users = result.users;
    total = result.total;
  } catch (err) {
    const logger = getLogger();
    logger.error({ err }, 'Failed to load admin users');
    loadError =
      err instanceof Error ? err.message : 'Failed to load users';
  }

  const pageCount = Math.ceil(total / perPage);

  return (
    <div className={'flex flex-1 flex-col'}>
      <AdminHeader>Users</AdminHeader>

      <PageBody>
        <div className={'flex flex-col space-y-4'}>
          {loadError && (
            <Alert type={'error'}>
              <Alert.Heading>Error Loading Users</Alert.Heading>
              {loadError}
            </Alert>
          )}

          <UsersTable
            users={users}
            page={page}
            pageCount={pageCount}
            perPage={perPage}
          />
        </div>
      </PageBody>
    </div>
  );
}

export default AdminGuard(UsersAdminPage);

async function loadAuthUsers(page = 1, perPage = 20) {
  const client = getSupabaseServerComponentClient({ admin: true });

  const response = await client.auth.admin.listUsers({
    page,
    perPage,
  });

  if (response.error) {
    throw response.error;
  }

  return response.data;
}

async function loadUsers(page = 1, perPage = 20) {
  const { users: authUsers, total } = await loadAuthUsers(page, perPage);

  const ids = authUsers.map((user) => user.id);
  const usersData = await getUsers(ids);

  const users = authUsers
    .map((user) => {
      const data = usersData.find((u) => u.id === user.id) as UserData;

      const banDuration =
        'banned_until' in user ? (user.banned_until as string) : 'none';

      return {
        id: user.id,
        email: user.email,
        phone: user.phone,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastSignInAt: user.last_sign_in_at,
        banDuration,
        data,
        profileMissing: !data,
      };
    })
    .filter(Boolean);

  return {
    total,
    users,
  };
}
