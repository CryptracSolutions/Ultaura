import Link from 'next/link';

import AdminGuard from '~/app/admin/components/AdminGuard';
import AdminHeader from '~/app/admin/components/AdminHeader';
import AdminBreadcrumbs from '~/app/admin/components/AdminBreadcrumbs';
import { PageBody } from '~/core/ui/Page';
import Badge from '~/core/ui/Badge';
import Button from '~/core/ui/Button';

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import { getMembershipsByOrganizationUid } from '~/app/admin/organizations/queries';
import { ORGANIZATIONS_TABLE } from '~/lib/db-tables';
import MembershipRole from '~/lib/organizations/types/membership-role';
import configuration from '~/configuration';

import OrgMembersSection from './components/OrgMembersSection';
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
  title: `Organization Details | ${configuration.site.siteName}`,
};

async function AdminOrganizationDetailPage({ params }: Params) {
  const uid = params.uid;
  const client = getSupabaseServerComponentClient({ admin: true });

  const [orgResult, membershipsResult] = await Promise.all([
    client
      .from(ORGANIZATIONS_TABLE)
      .select('id, uuid, name, created_at')
      .eq('uuid', uid)
      .single(),
    getMembershipsByOrganizationUid(client, { uid, page: 1, perPage: 100 }),
    getCurrentAdminContext().then((admin) =>
      admin
        ? writeAdminAuditLog(admin, {
            action: 'admin.view.org',
            targetType: 'organization',
            targetId: uid,
          })
        : undefined,
    ).catch(() => {}),
  ]);

  const org = orgResult.data;

  if (!org) {
    return (
      <div className="flex flex-col flex-1">
        <AdminHeader>Organization Not Found</AdminHeader>
        <PageBody>
          <p>No organization found with UUID: {uid}</p>
        </PageBody>
      </div>
    );
  }

  const accountResult = await client
    .from('ultaura_accounts')
    .select('id, name, status, plan_id')
    .eq('organization_id', org.id);

  const memberships = membershipsResult.data ?? [];
  const accounts = accountResult.data ?? [];

  const ownerMembership = memberships.find(
    (m) => m.role === MembershipRole.Owner,
  );
  const currentOwnerName =
    ownerMembership?.user?.displayName || 'Unknown Owner';

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader description="Organization details and linked accounts">Organization Details</AdminHeader>

      <PageBody>
        <div className="flex flex-col space-y-6">
          <AdminBreadcrumbs
            items={[
              { label: 'Organizations', href: '/admin/organizations' },
              { label: org.name },
            ]}
          />

          {/* Organization Info */}
          <div className="rounded-xl bg-card p-5 card-border-accent">
            <h3 className="text-lg font-semibold text-foreground mb-4">Organization Info</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Name</span>
                <span className="text-sm text-foreground">{org.name}</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">UUID</span>
                <span className="text-sm text-foreground font-mono break-all">{org.uuid}</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Internal ID</span>
                <span className="text-sm text-foreground">{org.id}</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Created At</span>
                <span className="text-sm text-foreground">{new Date(org.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Linked Ultaura Accounts */}
          <div className="rounded-xl bg-card p-5 card-border-accent">
            <h3 className="text-lg font-semibold text-foreground mb-4">Ultaura Accounts</h3>

            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No Ultaura account linked to this organization.
              </p>
            ) : (
              <div className="flex flex-col space-y-3">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between rounded-lg border border-border p-4"
                  >
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="font-medium">{account.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {account.id}
                        </p>
                      </div>

                      <div className="inline-flex">
                        <StatusBadge status={account.status} />
                      </div>

                      {account.plan_id && (
                        <span className="text-xs text-muted-foreground">
                          Plan: {account.plan_id}
                        </span>
                      )}
                    </div>

                    <Button variant="outline" size="small">
                      <Link href={`/admin/accounts/${account.id}`}>
                        View Account
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Members Section */}
          <OrgMembersSection
            orgUid={uid}
            memberships={memberships}
            currentOwnerName={currentOwnerName}
          />

          {/* Quick Links */}
          <div className="rounded-xl bg-card p-5 card-border-accent">
            <h3 className="text-lg font-semibold text-foreground mb-4">Quick Links</h3>

            <div className="flex space-x-3">
              <Button variant="outline" size="small">
                <Link href={`/admin/organizations/${uid}/members`}>
                  Full Members List
                </Link>
              </Button>

              <Button variant="outline" size="small">
                <Link href={`/admin/organizations/${uid}/delete`}>
                  Delete Organization
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </PageBody>
    </div>
  );
}

export default AdminGuard(AdminOrganizationDetailPage);

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return (
        <Badge color="success" size="small">
          Active
        </Badge>
      );
    case 'trial':
      return (
        <Badge color="info" size="small">
          Trial
        </Badge>
      );
    case 'past_due':
      return (
        <Badge color="warn" size="small">
          Past Due
        </Badge>
      );
    case 'canceled':
      return (
        <Badge color="error" size="small">
          Canceled
        </Badge>
      );
    default:
      return (
        <Badge color="normal" size="small">
          {status}
        </Badge>
      );
  }
}
