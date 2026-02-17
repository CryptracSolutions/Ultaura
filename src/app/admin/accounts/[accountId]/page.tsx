import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

import AdminGuard from '~/app/admin/components/AdminGuard';
import AdminHeader from '~/app/admin/components/AdminHeader';
import { PageBody } from '~/core/ui/Page';
import Tile from '~/core/ui/Tile';
import Heading from '~/core/ui/Heading';
import Badge from '~/core/ui/Badge';
import Button from '~/core/ui/Button';
import { TextFieldInput, TextFieldLabel } from '~/core/ui/TextField';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/core/ui/Table';

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import configuration from '~/configuration';

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
      <AdminHeader>Account Details</AdminHeader>

      <PageBody>
        <div className="flex flex-col space-y-6">
          <Breadcrumbs accountName={account.name} />

          {/* Account Info */}
          <Tile>
            <div className="flex items-center justify-between">
              <Heading type={4}>Account Info</Heading>

              <div className="inline-flex">
                <AccountStatusBadge status={account.status} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextFieldLabel>
                Account ID
                <TextFieldInput
                  className="max-w-full"
                  defaultValue={account.id}
                  disabled
                />
              </TextFieldLabel>

              <TextFieldLabel>
                Name
                <TextFieldInput
                  className="max-w-full"
                  defaultValue={account.name}
                  disabled
                />
              </TextFieldLabel>

              <TextFieldLabel>
                Billing Email
                <TextFieldInput
                  className="max-w-full"
                  defaultValue={account.billing_email}
                  disabled
                />
              </TextFieldLabel>

              <TextFieldLabel>
                Plan ID
                <TextFieldInput
                  className="max-w-full"
                  defaultValue={account.plan_id ?? 'None'}
                  disabled
                />
              </TextFieldLabel>

              <TextFieldLabel>
                User Type
                <TextFieldInput
                  className="max-w-full"
                  defaultValue={account.user_type}
                  disabled
                />
              </TextFieldLabel>

              <TextFieldLabel>
                Organization ID
                <TextFieldInput
                  className="max-w-full"
                  defaultValue={String(account.organization_id)}
                  disabled
                />
              </TextFieldLabel>

              <TextFieldLabel>
                Created At
                <TextFieldInput
                  className="max-w-full"
                  defaultValue={new Date(account.created_at).toLocaleString()}
                  disabled
                />
              </TextFieldLabel>

              <TextFieldLabel>
                Overage Cap (cents)
                <TextFieldInput
                  className="max-w-full"
                  defaultValue={String(account.overage_cents_cap)}
                  disabled
                />
              </TextFieldLabel>
            </div>

            {account.trial_starts_at && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <TextFieldLabel>
                  Trial Starts
                  <TextFieldInput
                    className="max-w-full"
                    defaultValue={new Date(
                      account.trial_starts_at,
                    ).toLocaleString()}
                    disabled
                  />
                </TextFieldLabel>

                <TextFieldLabel>
                  Trial Ends
                  <TextFieldInput
                    className="max-w-full"
                    defaultValue={
                      account.trial_ends_at
                        ? new Date(account.trial_ends_at).toLocaleString()
                        : 'N/A'
                    }
                    disabled
                  />
                </TextFieldLabel>
              </div>
            )}
          </Tile>

          {/* Minutes Usage */}
          <Tile>
            <Heading type={4}>Minutes Usage</Heading>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-lg border border-border p-4 text-center">
                <p className="text-2xl font-bold">
                  {account.minutes_included}
                </p>
                <p className="text-xs text-muted-foreground">
                  Included Minutes
                </p>
              </div>

              <div className="rounded-lg border border-border p-4 text-center">
                <p className="text-2xl font-bold">{account.minutes_used}</p>
                <p className="text-xs text-muted-foreground">Minutes Used</p>
              </div>

              <div className="rounded-lg border border-border p-4 text-center">
                <p className="text-2xl font-bold">{overageMinutes}</p>
                <p className="text-xs text-muted-foreground">
                  Overage Minutes
                </p>
              </div>

              <div className="rounded-lg border border-border p-4 text-center">
                <p className="text-2xl font-bold">
                  {Math.round(totalSecondsConnected / 60)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Total Connected (min)
                </p>
              </div>
            </div>

            {account.cycle_start && account.cycle_end && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <TextFieldLabel>
                  Cycle Start
                  <TextFieldInput
                    className="max-w-full"
                    defaultValue={new Date(
                      account.cycle_start,
                    ).toLocaleDateString()}
                    disabled
                  />
                </TextFieldLabel>

                <TextFieldLabel>
                  Cycle End
                  <TextFieldInput
                    className="max-w-full"
                    defaultValue={new Date(
                      account.cycle_end,
                    ).toLocaleDateString()}
                    disabled
                  />
                </TextFieldLabel>
              </div>
            )}
          </Tile>

          {/* Subscription Details */}
          <Tile>
            <Heading type={4}>Subscription</Heading>

            {subscription ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextFieldLabel>
                  Subscription ID
                  <TextFieldInput
                    className="max-w-full"
                    defaultValue={subscription.id}
                    disabled
                  />
                </TextFieldLabel>

                <div className="flex flex-col space-y-1">
                  <span className="text-sm font-medium">Status</span>
                  <div className="inline-flex pt-2">
                    <SubscriptionStatusBadge status={subscription.status} />
                  </div>
                </div>

                <TextFieldLabel>
                  Plan ID
                  <TextFieldInput
                    className="max-w-full"
                    defaultValue={subscription.plan_id ?? 'None'}
                    disabled
                  />
                </TextFieldLabel>

                <TextFieldLabel>
                  Billing Interval
                  <TextFieldInput
                    className="max-w-full"
                    defaultValue={subscription.billing_interval ?? 'N/A'}
                    disabled
                  />
                </TextFieldLabel>

                <TextFieldLabel>
                  Stripe Subscription ID
                  <TextFieldInput
                    className="max-w-full"
                    defaultValue={
                      subscription.stripe_subscription_id ?? 'None'
                    }
                    disabled
                  />
                </TextFieldLabel>

                <TextFieldLabel>
                  Stripe Customer ID
                  <TextFieldInput
                    className="max-w-full"
                    defaultValue={subscription.stripe_customer_id ?? 'None'}
                    disabled
                  />
                </TextFieldLabel>

                {subscription.current_period_start &&
                  subscription.current_period_end && (
                    <>
                      <TextFieldLabel>
                        Period Start
                        <TextFieldInput
                          className="max-w-full"
                          defaultValue={new Date(
                            subscription.current_period_start,
                          ).toLocaleDateString()}
                          disabled
                        />
                      </TextFieldLabel>

                      <TextFieldLabel>
                        Period End
                        <TextFieldInput
                          className="max-w-full"
                          defaultValue={new Date(
                            subscription.current_period_end,
                          ).toLocaleDateString()}
                          disabled
                        />
                      </TextFieldLabel>
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
          </Tile>

          {/* Lines */}
          <Tile>
            <Heading type={4}>Lines ({lines.length})</Heading>

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
              <p className="text-sm text-muted-foreground">
                No lines configured for this account.
              </p>
            )}
          </Tile>

          {/* Quick Links */}
          <Tile>
            <Heading type={4}>Quick Links</Heading>

            <div className="flex space-x-3">
              <Button variant="outline" size="small">
                <Link href={`/admin/timeline?accountId=${accountId}`}>
                  View Timeline
                </Link>
              </Button>
            </div>
          </Tile>
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

function Breadcrumbs({ accountName }: { accountName: string }) {
  return (
    <div className="flex space-x-1 items-center text-xs p-2">
      <Link href="/admin">Admin</Link>
      <ChevronRightIcon className="w-3" />
      <span>Accounts</span>
      <ChevronRightIcon className="w-3" />
      <span>{accountName}</span>
    </div>
  );
}
