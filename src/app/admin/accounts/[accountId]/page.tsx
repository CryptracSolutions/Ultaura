import Link from 'next/link';

import AdminGuard from '~/app/admin/components/AdminGuard';
import AdminHeader from '~/app/admin/components/AdminHeader';
import AdminBreadcrumbs from '~/app/admin/components/AdminBreadcrumbs';
import AdminStatCard from '~/app/admin/components/AdminStatCard';
import { PageBody } from '~/core/ui/Page';
import Badge from '~/core/ui/Badge';
import Button from '~/core/ui/Button';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/core/ui/Table';
import TableEmptyState from '~/core/ui/TableEmptyState';
import { formatDate, formatDateTime } from '~/lib/utils/format-date';

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import configuration from '~/configuration';
import {
  writeAdminAuditLog,
  getCurrentAdminContext,
} from '~/lib/ultaura/admin/audit-log';

interface Params {
  params: {
    accountId: string;
  };
}

export const metadata = {
  title: `Account Details | ${configuration.site.siteName}`,
};

async function AdminAccountDetailPage({ params }: Params) {
  const accountId = params.accountId;
  const client = getSupabaseServerComponentClient({ admin: true });

  const [accountResult, subscriptionResult, linesResult, usageResult] =
    await Promise.all([
      client
        .from('ultaura_accounts')
        .select(
          'id, name, status, plan_id, billing_email, minutes_included, minutes_used, cycle_start, cycle_end, created_at, organization_id, trial_ends_at, trial_starts_at, user_type, overage_cents_cap',
        )
        .eq('id', accountId)
        .single(),
      client
        .from('ultaura_subscriptions')
        .select(
          'id, status, plan_id, billing_interval, stripe_subscription_id, stripe_customer_id, current_period_start, current_period_end, cancel_at_period_end, created_at',
        )
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      client
        .from('ultaura_lines')
        .select('id, display_name, phone_e164, status, timezone, created_at')
        .eq('account_id', accountId)
        .order('created_at', { ascending: true }),
      client
        .from('ultaura_minute_ledger')
        .select('billable_minutes, billable_type, seconds_connected')
        .eq('account_id', accountId),
      getCurrentAdminContext()
        .then((admin) =>
          admin
            ? writeAdminAuditLog(admin, {
                action: 'admin.view.account',
                targetType: 'account',
                targetId: accountId,
              })
            : undefined,
        )
        .catch(() => {}),
    ]);

  const account = accountResult.data;

  if (!account) {
    return (
      <div className="flex flex-col flex-1">
        <AdminHeader>Account Not Found</AdminHeader>
        <PageBody>
          <p>No account found with ID: {accountId}</p>
        </PageBody>
      </div>
    );
  }

  const subscription = subscriptionResult.data;
  const lines = linesResult.data ?? [];
  const ledgerEntries = usageResult.data ?? [];

  // Aggregate usage
  const totalBillableMinutes = ledgerEntries.reduce(
    (sum, e) => sum + (e.billable_minutes ?? 0),
    0,
  );
  const totalSecondsConnected = ledgerEntries.reduce(
    (sum, e) => sum + (e.seconds_connected ?? 0),
    0,
  );
  const overageMinutes = ledgerEntries
    .filter((e) => e.billable_type === 'overage' || e.billable_type === 'payg')
    .reduce((sum, e) => sum + (e.billable_minutes ?? 0), 0);

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader description="Account details, usage, and subscription">
        Account Details
      </AdminHeader>

      <PageBody>
        <div className="flex flex-col space-y-6">
          <AdminBreadcrumbs items={[{ label: account.name }]} />

          {/* Account Info */}
          <div className="rounded-xl bg-card p-5 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Account Info
              </h3>

              <div className="inline-flex">
                <AccountStatusBadge status={account.status} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">
                  Account ID
                </span>
                <span className="text-sm text-foreground">
                  {account.id || '—'}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">
                  Name
                </span>
                <span className="text-sm text-foreground">
                  {account.name || '—'}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">
                  Billing Email
                </span>
                <span className="text-sm text-foreground">
                  {account.billing_email || '—'}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">
                  Plan ID
                </span>
                <span className="text-sm text-foreground">
                  {account.plan_id ?? 'None'}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">
                  User Type
                </span>
                <span className="text-sm text-foreground">
                  {account.user_type || '—'}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">
                  Organization ID
                </span>
                <span className="text-sm text-foreground">
                  {account.organization_id ?? '—'}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">
                  Created At
                </span>
                <span className="text-sm text-foreground">
                  {formatDateTime(account.created_at)}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">
                  Overage Cap (cents)
                </span>
                <span className="text-sm text-foreground">
                  {String(account.overage_cents_cap)}
                </span>
              </div>
            </div>

            {account.trial_starts_at && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Trial Starts
                  </span>
                  <span className="text-sm text-foreground">
                    {formatDateTime(account.trial_starts_at)}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Trial Ends
                  </span>
                  <span className="text-sm text-foreground">
                    {account.trial_ends_at
                      ? formatDateTime(account.trial_ends_at)
                      : 'N/A'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Minutes Usage */}
          <div className="rounded-xl bg-card p-5 border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Minutes Usage
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <AdminStatCard
                label="Included Minutes"
                value={account.minutes_included}
              />

              <AdminStatCard
                label="Minutes Used"
                value={account.minutes_used}
              />

              <AdminStatCard label="Overage Minutes" value={overageMinutes} />

              <AdminStatCard
                label="Total Connected (min)"
                value={Math.round(totalSecondsConnected / 60)}
              />
            </div>

            {account.cycle_start && account.cycle_end && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Cycle Start
                  </span>
                  <span className="text-sm text-foreground">
                    {formatDate(account.cycle_start)}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Cycle End
                  </span>
                  <span className="text-sm text-foreground">
                    {formatDate(account.cycle_end)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Subscription Details */}
          <div className="rounded-xl bg-card p-5 border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Subscription
            </h3>

            {subscription ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Subscription ID
                  </span>
                  <span className="text-sm text-foreground">
                    {subscription.id || '—'}
                  </span>
                </div>

                <div className="flex flex-col space-y-1">
                  <span className="text-sm font-medium">Status</span>
                  <div className="inline-flex pt-2">
                    <SubscriptionStatusBadge status={subscription.status} />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Plan ID
                  </span>
                  <span className="text-sm text-foreground">
                    {subscription.plan_id ?? 'None'}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Billing Interval
                  </span>
                  <span className="text-sm text-foreground">
                    {subscription.billing_interval ?? 'N/A'}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Stripe Subscription ID
                  </span>
                  <span className="text-sm text-foreground">
                    {subscription.stripe_subscription_id ?? 'None'}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Stripe Customer ID
                  </span>
                  <span className="text-sm text-foreground">
                    {subscription.stripe_customer_id ?? 'None'}
                  </span>
                </div>

                {subscription.current_period_start &&
                  subscription.current_period_end && (
                    <>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-muted-foreground">
                          Period Start
                        </span>
                        <span className="text-sm text-foreground">
                          {formatDate(subscription.current_period_start)}
                        </span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-muted-foreground">
                          Period End
                        </span>
                        <span className="text-sm text-foreground">
                          {formatDate(subscription.current_period_end)}
                        </span>
                      </div>
                    </>
                  )}

                <div className="flex flex-col space-y-1">
                  <span className="text-sm font-medium">
                    Cancel at Period End
                  </span>
                  <div className="inline-flex pt-2">
                    {subscription.cancel_at_period_end ? (
                      <Badge color="warn" size="small">
                        Yes
                      </Badge>
                    ) : (
                      <Badge color="normal" size="small">
                        No
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No subscription found for this account.
              </p>
            )}
          </div>

          {/* Lines */}
          <div className="rounded-xl bg-card p-5 border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Lines ({lines.length})
            </h3>

            {lines.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Timezone</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">
                        {line.display_name}
                      </TableCell>

                      <TableCell>{line.phone_e164}</TableCell>

                      <TableCell>
                        <div className="inline-flex">
                          <LineStatusBadge status={line.status} />
                        </div>
                      </TableCell>

                      <TableCell>{line.timezone}</TableCell>

                      <TableCell>
                        <Button variant="ghost" size="small">
                          <Link href={`/admin/lines/${line.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <TableEmptyState message="No lines configured for this account." />
            )}
          </div>

          {/* Quick Links */}
          <div className="rounded-xl bg-card p-5 border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Quick Links
            </h3>

            <div className="flex space-x-3">
              <Button variant="outline" size="small">
                <Link href={`/admin/timeline?accountId=${accountId}`}>
                  View Timeline
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </PageBody>
    </div>
  );
}

export default AdminGuard(AdminAccountDetailPage);

function AccountStatusBadge({ status }: { status: string }) {
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

function SubscriptionStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return (
        <Badge color="success" size="small">
          Active
        </Badge>
      );
    case 'trialing':
      return (
        <Badge color="info" size="small">
          Trialing
        </Badge>
      );
    case 'past_due':
      return (
        <Badge color="warn" size="small">
          Past Due
        </Badge>
      );
    case 'canceled':
    case 'cancelled':
      return (
        <Badge color="error" size="small">
          Canceled
        </Badge>
      );
    case 'incomplete':
      return (
        <Badge color="warn" size="small">
          Incomplete
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

function LineStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return (
        <Badge color="success" size="small">
          Active
        </Badge>
      );
    case 'paused':
      return (
        <Badge color="warn" size="small">
          Paused
        </Badge>
      );
    case 'disabled':
      return (
        <Badge color="error" size="small">
          Disabled
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
