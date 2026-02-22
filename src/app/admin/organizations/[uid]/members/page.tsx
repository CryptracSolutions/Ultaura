import { use } from 'react';

import AdminHeader from '~/app/admin/components/AdminHeader';
import AdminBreadcrumbs from '~/app/admin/components/AdminBreadcrumbs';
import { getMembershipsByOrganizationUid } from '~/app/admin/organizations/queries';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import OrganizationsMembersTable from '~/app/admin/organizations/[uid]/members/components/OrganizationsMembersTable';
import getPageFromQueryParams from '~/app/admin/utils/get-page-from-query-param';

import configuration from '~/configuration';
import { PageBody } from '~/core/ui/Page';
import { ORGANIZATIONS_TABLE } from '~/lib/db-tables';

interface AdminMembersPageParams {
  params: {
    uid: string;
  };

  searchParams: {
    page?: string;
  };
}

export const metadata = {
  title: `Members | ${configuration.site.siteName}`,
};

function AdminMembersPage(params: AdminMembersPageParams) {
  const adminClient = getSupabaseServerComponentClient({ admin: true });
  const uid = params.params.uid;
  const perPage = 20;
  const page = getPageFromQueryParams(params.searchParams.page);

  const { data: memberships, count } = use(
    getMembershipsByOrganizationUid(adminClient, { uid, page, perPage }),
  );

  const orgResult = use(
    adminClient
      .from(ORGANIZATIONS_TABLE)
      .select('name')
      .eq('uuid', uid)
      .single(),
  );

  const orgName = orgResult.data?.name ?? 'Organization';
  const pageCount = count ? Math.ceil(count / perPage) : 0;

  return (
    <div className={'flex flex-col flex-1'}>
      <AdminHeader description="Organization member management">Manage Members</AdminHeader>

      <PageBody>
        <div className={'flex flex-col space-y-4'}>
          <AdminBreadcrumbs
            items={[
              { label: 'Organizations', href: '/admin/organizations' },
              { label: orgName, href: `/admin/organizations/${uid}` },
              { label: 'Members' },
            ]}
          />

          <OrganizationsMembersTable
            page={page}
            perPage={perPage}
            pageCount={pageCount}
            memberships={memberships}
          />
        </div>
      </PageBody>
    </div>
  );
}

export default AdminMembersPage;
