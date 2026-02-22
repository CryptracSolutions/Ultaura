'use client';

import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { getI18n } from 'react-i18next';

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '~/core/ui/Table';
import { getOrganizations } from '~/app/admin/organizations/queries';
import SubscriptionStatusBadge from '~/app/dashboard/(app)/components/organizations/SubscriptionStatusBadge';
import AdminPagination from '~/app/admin/components/AdminPagination';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '~/core/ui/Dropdown';

import Button from '~/core/ui/Button';
import configuration from '~/configuration';

type Response = Awaited<ReturnType<typeof getOrganizations>>;
type Organizations = Response['organizations'];

function OrganizationsTable({
  organizations,
  pageCount,
  perPage,
  page,
}: React.PropsWithChildren<{
  organizations: Organizations;
  pageCount: number;
  perPage: number;
  page: number;
}>) {
  return (
    <div data-cy="admin-organizations-table" className="flex flex-col gap-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>UUID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Subscription</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Members</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>

        <TableBody>
          {organizations.map((org) => {
            const priceId = org.subscription?.data?.priceId;
            const plan = configuration.stripe.products.find((product) =>
              product.plans.some((p) => p.stripePriceId === priceId),
            );
            const price = plan?.plans.find((p) => p.stripePriceId === priceId);
            const subscriptionLabel = plan && price ? `${plan.name} - ${price.name}` : '-';

            const subscription = org.subscription?.data;
            const i18n = getI18n();
            const language = i18n?.language ?? 'en';
            let periodLabel: React.ReactNode = '-';

            if (subscription) {
              const canceled = subscription.cancelAtPeriodEnd;
              const formattedDate = new Date(subscription.periodEndsAt).toLocaleDateString(language);
              periodLabel = canceled ? (
                <span className="text-orange-500">Stops on {formattedDate}</span>
              ) : (
                <span className="text-green-500">Renews on {formattedDate}</span>
              );
            }

            const memberships = org.memberships.filter((item) => !item.code);
            const invites = org.memberships.length - memberships.length;
            const memberCount = memberships.length;

            return (
              <TableRow key={org.uuid}>
                <TableCell>{org.id}</TableCell>
                <TableCell className="font-mono text-xs">{org.uuid}</TableCell>
                <TableCell>{org.name}</TableCell>
                <TableCell>{subscriptionLabel}</TableCell>
                <TableCell>
                  {subscription ? (
                    <SubscriptionStatusBadge subscription={subscription} />
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>{periodLabel}</TableCell>
                <TableCell>
                  <Link
                    data-cy="organization-members-link"
                    href={`organizations/${org.uuid}/members`}
                    className="hover:underline cursor-pointer"
                  >
                    {memberCount} member{memberCount === 1 ? '' : 's'}{' '}
                    {invites ? `(${invites} invites)` : ''}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <span className="sr-only">Open menu</span>
                          <EllipsisHorizontalIcon className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => navigator.clipboard.writeText(org.uuid)}
                        >
                          Copy UUID
                        </DropdownMenuItem>

                        <DropdownMenuItem asChild>
                          <Link href={`/admin/organizations/${org.uuid}/members`}>
                            View Members
                          </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem asChild>
                          <Link
                            className="text-red-500"
                            href={`/admin/organizations/${org.uuid}/delete`}
                          >
                            Delete
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <AdminPagination page={page} pageCount={pageCount} perPage={perPage} />
    </div>
  );
}

export default OrganizationsTable;
