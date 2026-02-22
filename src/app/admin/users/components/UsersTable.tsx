'use client';

import Link from 'next/link';
import { getI18n } from 'react-i18next';
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '~/core/ui/Table';

import UserData from '~/core/session/types/user-data';
import { Avatar, AvatarFallback, AvatarImage } from '~/core/ui/Avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '~/core/ui/Dropdown';

import Button from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import If from '~/core/ui/If';
import AdminPagination from '~/app/admin/components/AdminPagination';

type UserRow = {
  id: string;
  email: string | undefined;
  phone: string | undefined;
  createdAt: string;
  updatedAt: string | undefined;
  lastSignInAt: string | undefined;
  banDuration: string | undefined;
  data: UserData;
};

function UsersTable({
  users,
  page,
  pageCount,
  perPage,
}: React.PropsWithChildren<{
  users: UserRow[];
  pageCount: number;
  page: number;
  perPage: number;
}>) {
  return (
    <div className="flex flex-col gap-4">
      <Table data-cy="admin-users-table">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>ID</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Created at</TableHead>
            <TableHead>Last sign in</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {users.map((user) => {
            const data = user.data;
            const displayName = data?.displayName;
            const photoUrl = data?.photoUrl;
            const displayText = displayName ?? user.email ?? user.phone ?? '';
            const isBanned = user.banDuration && user.banDuration !== 'none';

            const i18n = getI18n();
            const language = i18n.language ?? 'en';
            const createdAtLabel = new Date(user.createdAt).toLocaleDateString(language);

            return (
              <TableRow key={user.id}>
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger>
                      <Avatar>
                        {photoUrl ? <AvatarImage src={photoUrl} /> : null}
                        <AvatarFallback>{displayText[0]}</AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>{displayText}</TooltipContent>
                  </Tooltip>
                </TableCell>

                <TableCell>
                  <Link className={'hover:underline'} href={`/admin/users/${user.id}`}>
                    {user.id}
                  </Link>
                </TableCell>

                <TableCell>
                  <span title={user.email} className={'truncate max-w-full block'}>
                    {user.email}
                  </span>
                </TableCell>

                <TableCell>{displayName ?? ''}</TableCell>

                <TableCell>
                  <span>{createdAtLabel}</span>
                </TableCell>

                <TableCell>
                  {user.lastSignInAt ? (
                    <span suppressHydrationWarning>
                      {new Date(user.lastSignInAt).toLocaleString()}
                    </span>
                  ) : (
                    <span>-</span>
                  )}
                </TableCell>

                <TableCell>
                  {!isBanned ? (
                    <Badge size={'small'} className={'inline-flex'} color={'success'}>
                      Active
                    </Badge>
                  ) : (
                    <Badge size={'small'} className={'inline-flex'} color={'error'}>
                      Banned
                    </Badge>
                  )}
                </TableCell>

                <TableCell>
                  <div className={'flex justify-end'}>
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
                          onClick={() => navigator.clipboard.writeText(user.id)}
                        >
                          Copy user ID
                        </DropdownMenuItem>

                        <If condition={!isBanned}>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/users/${user.id}/impersonate`}>
                              Impersonate User
                            </Link>
                          </DropdownMenuItem>

                          <DropdownMenuItem asChild>
                            <Link
                              className={
                                'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/5'
                              }
                              href={`/admin/users/${user.id}/ban`}
                            >
                              Ban User
                            </Link>
                          </DropdownMenuItem>

                          <DropdownMenuItem asChild>
                            <Link
                              className={
                                'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/5'
                              }
                              href={`/admin/users/${user.id}/delete`}
                            >
                              Delete User
                            </Link>
                          </DropdownMenuItem>
                        </If>

                        <If condition={!!isBanned}>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/users/${user.id}/reactivate`}>
                              Reactivate User
                            </Link>
                          </DropdownMenuItem>
                        </If>
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

export default UsersTable;
