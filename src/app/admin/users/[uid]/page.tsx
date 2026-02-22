import Link from 'next/link';

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import AdminHeader from '~/app/admin/components/AdminHeader';
import AdminGuard from '~/app/admin/components/AdminGuard';
import AdminBreadcrumbs from '~/app/admin/components/AdminBreadcrumbs';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/core/ui/Table';

import Badge from '~/core/ui/Badge';
import Label from '~/core/ui/Label';
import { PageBody } from '~/core/ui/Page';

import RoleBadge from '~/app/dashboard/(app)/settings/organization/components/RoleBadge';
import UserActionsDropdown from '~/app/admin/users/[uid]/components/UserActionsDropdown';

import configuration from '~/configuration';
import MembershipRole from '~/lib/organizations/types/membership-role';
import {
  writeAdminAuditLog,
  getCurrentAdminContext,
} from '~/lib/ultaura/admin/audit-log';

interface Params {
  params: {
    uid: string;
  };
}

export const metadata = {
  title: `Manage User | ${configuration.site.siteName}`,
};

async function AdminUserPage({ params }: Params) {
  const uid = params.uid;

  const [data] = await Promise.all([
    loadData(uid),
    getCurrentAdminContext().then((admin) =>
      admin
        ? writeAdminAuditLog(admin, {
            action: 'admin.view.user',
            targetType: 'user',
            targetId: uid,
          })
        : undefined,
    ).catch(() => {}),
  ]);
  const { auth, user } = data;
  const displayName = user?.displayName;
  const authUser = auth?.user;
  const email = authUser?.email;
  const phone = authUser?.phone;
  const organizations = data.organizations ?? [];

  const isBanned = Boolean(
    authUser && 'banned_until' in authUser && authUser.banned_until !== 'none',
  );

  return (
    <div className={'flex flex-col flex-1'}>
      <AdminHeader description="View and manage user details">Manage User</AdminHeader>

      <PageBody>
        <div className={'flex flex-col space-y-6'}>
          <div className={'flex justify-between'}>
            <AdminBreadcrumbs
              items={[
                { label: 'Users', href: '/admin/users' },
                { label: displayName ?? email ?? '' },
              ]}
            />

            <div>
              <UserActionsDropdown uid={uid} isBanned={isBanned} />
            </div>
          </div>

          <div className="rounded-xl bg-card p-5 card-border-accent">
            <h3 className="text-lg font-semibold text-foreground">User Details</h3>

            <div className={'flex space-x-2 items-center mt-4'}>
              <div>
                <Label>Status</Label>
              </div>

              <div className={'inline-flex'}>
                {isBanned ? (
                  <Badge size={'small'} color={'error'}>
                    Banned
                  </Badge>
                ) : (
                  <Badge size={'small'} color={'success'}>
                    Active
                  </Badge>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Display name</span>
                <span className="text-sm text-foreground">{displayName || '—'}</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Email</span>
                <span className="text-sm text-foreground">{email || '—'}</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Phone number</span>
                <span className="text-sm text-foreground">{phone || '—'}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-card p-5 card-border-accent">
            <h3 className="text-lg font-semibold text-foreground">Organizations</h3>

            <Table className="mt-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Organization ID</TableHead>
                  <TableHead>UUID</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {organizations.map((membership) => {
                  const organization = membership.organization;
                  const href = `/admin/organizations/${organization.uuid}/members`;

                  return (
                    <TableRow key={membership.id}>
                      <TableCell>{organization.id}</TableCell>
                      <TableCell>{organization.uuid}</TableCell>

                      <TableCell>
                        <Link className={'hover:underline'} href={href}>
                          {organization.name}
                        </Link>
                      </TableCell>

                      <TableCell>
                        <div className={'inline-flex'}>
                          <RoleBadge role={membership.role} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </PageBody>
    </div>
  );
}

export default AdminGuard(AdminUserPage);

async function loadData(uid: string) {
  const client = getSupabaseServerComponentClient({ admin: true });
  const authUser = client.auth.admin.getUserById(uid);

  const userData = client
    .from('users')
    .select(
      `
      id,
      displayName: display_name,
      photoURL: photo_url,
      onboarded
  `,
    )
    .eq('id', uid)
    .single();

  const organizationsQuery = client
    .from('memberships')
    .select<
      string,
      {
        id: number;
        role: MembershipRole;
        organization: {
          id: number;
          uuid: string;
          name: string;
        };
      }
    >(
      `
        id,
        role,
        organization: organization_id !inner (
          id,
          uuid,
          name
        )
    `,
    )
    .eq('user_id', uid);

  const [auth, user, organizations] = await Promise.all([
    authUser,
    userData,
    organizationsQuery,
  ]);

  return {
    auth: auth.data,
    user: user.data,
    organizations: organizations.data,
  };
}
