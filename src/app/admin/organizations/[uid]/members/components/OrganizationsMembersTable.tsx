'use client';

import Link from 'next/link';

import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';

import Membership from '~/lib/organizations/types/membership';
import UserData from '~/core/session/types/user-data';
import RoleBadge from '~/app/dashboard/(app)/settings/organization/components/RoleBadge';

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '~/core/ui/Table';
import TableContainer from '~/core/ui/TableContainer';
import TableEmptyState from '~/core/ui/TableEmptyState';
import TablePagination from '~/core/ui/TablePagination';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/core/ui/Dropdown';

import Button from '~/core/ui/Button';

type Data = {
  id: Membership['id'];
  role: Membership['role'];
  user: {
    id: UserData['id'];
    displayName: UserData['displayName'];
  };
};

function OrganizationsMembersTable({
  memberships,
  page,
  perPage,
  pageCount,
}: React.PropsWithChildren<{
  memberships: Data[];
  page: number;
  perPage: number;
  pageCount: number;
}>) {
  const data = memberships.filter((membership) => membership.user);

  return (
    <TableContainer>
      {data.length === 0 ? (
        <TableEmptyState message="No members found." />
      ) : (
        <Table data-cy="admin-organization-members-table">
          <TableHeader>
            <TableRow>
              <TableHead>Membership ID</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {data.map((membership) => (
              <TableRow key={membership.id}>
                <TableCell>{membership.id}</TableCell>

                <TableCell>
                  <Link
                    className="hover:underline"
                    href={`/admin/users/${membership.user.id}`}
                  >
                    {membership.user.id}
                  </Link>
                </TableCell>

                <TableCell>{membership.user.displayName}</TableCell>

                <TableCell>
                  <div className="inline-flex">
                    <RoleBadge role={membership.role} />
                  </div>
                </TableCell>

                <TableCell>
                  <div className="flex">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <span className="sr-only">Open menu</span>
                          <EllipsisHorizontalIcon className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/users/${membership.user.id}`}>
                            View User
                          </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem asChild>
                          <Link
                            href={`/admin/users/${membership.user.id}/impersonate`}
                          >
                            Impersonate User
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <TablePagination page={page} pageCount={pageCount} perPage={perPage} />
    </TableContainer>
  );
}

export default OrganizationsMembersTable;
