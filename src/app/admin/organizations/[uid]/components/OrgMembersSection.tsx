'use client';

import { useTransition, useState } from 'react';
import Link from 'next/link';

import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';

import Button from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import Alert from '~/core/ui/Alert';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/core/ui/Table';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/core/ui/Dropdown';

import MembershipRole from '~/lib/organizations/types/membership-role';

import {
  adminChangeMemberRole,
  adminRemoveMember,
} from '~/app/admin/organizations/[uid]/actions.server';

import TransferOwnershipDialog from './TransferOwnershipDialog';
import AddMemberDialog from './AddMemberDialog';

interface MemberData {
  id: number;
  role: MembershipRole;
  user: {
    id: string;
    displayName: string;
    photoURL: string;
  };
}

interface OrgMembersSectionProps {
  orgUid: string;
  memberships: MemberData[];
  currentOwnerName: string;
}

function getRoleBadge(role: MembershipRole) {
  switch (role) {
    case MembershipRole.Owner:
      return (
        <Badge
          color="custom"
          size="small"
          className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-medium"
        >
          Owner
        </Badge>
      );
    case MembershipRole.Admin:
      return (
        <Badge color="info" size="small">
          Admin
        </Badge>
      );
    default:
      return (
        <Badge color="normal" size="small">
          Member
        </Badge>
      );
  }
}

function OrgMembersSection({
  orgUid,
  memberships,
  currentOwnerName,
}: OrgMembersSectionProps) {
  const [error, setError] = useState('');

  return (
    <div className="rounded-xl bg-card p-6 card-border-accent">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Members ({memberships.length})</h3>

        <AddMemberDialog orgUid={orgUid} />
      </div>

      {error && (
        <Alert type="error" useCloseButton>
          <Alert.Heading>Error</Alert.Heading>
          <span>{error}</span>
        </Alert>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Membership ID</TableHead>
            <TableHead>User</TableHead>
            <TableHead>User ID</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {memberships
            .filter((m) => m.user)
            .map((membership) => (
              <MemberRow
                key={membership.id}
                membership={membership}
                orgUid={orgUid}
                currentOwnerName={currentOwnerName}
                onError={setError}
              />
            ))}
        </TableBody>
      </Table>
    </div>
  );
}

function MemberRow({
  membership,
  orgUid,
  currentOwnerName,
  onError,
}: {
  membership: MemberData;
  orgUid: string;
  currentOwnerName: string;
  onError: (msg: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const isOwner = membership.role === MembershipRole.Owner;
  const displayName = membership.user.displayName || 'Unnamed';

  function handleChangeRole(newRole: MembershipRole) {
    onError('');

    const formData = new FormData();
    formData.set('membershipId', String(membership.id));
    formData.set('newRole', String(newRole));
    formData.set('orgUid', orgUid);

    startTransition(async () => {
      try {
        await adminChangeMemberRole(formData);
      } catch (e) {
        onError(e instanceof Error ? e.message : 'Failed to change role');
      }
    });
  }

  function handleRemove() {
    onError('');

    const formData = new FormData();
    formData.set('membershipId', String(membership.id));
    formData.set('orgUid', orgUid);

    startTransition(async () => {
      try {
        await adminRemoveMember(formData);
      } catch (e) {
        onError(e instanceof Error ? e.message : 'Failed to remove member');
      }
    });
  }

  return (
    <TableRow className={pending ? 'opacity-50' : ''}>
      <TableCell>{membership.id}</TableCell>

      <TableCell>{displayName}</TableCell>

      <TableCell>
        <Link
          className="hover:underline text-sm"
          href={`/admin/users/${membership.user.id}`}
        >
          {membership.user.id}
        </Link>
      </TableCell>

      <TableCell>
        <div className="inline-flex">{getRoleBadge(membership.role)}</div>
      </TableCell>

      <TableCell>
        <div className="flex items-center space-x-2">
          {!isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={pending}>
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

                <DropdownMenuSeparator />

                {membership.role !== MembershipRole.Admin && (
                  <DropdownMenuItem
                    onClick={() => handleChangeRole(MembershipRole.Admin)}
                  >
                    Set as Admin
                  </DropdownMenuItem>
                )}

                {membership.role !== MembershipRole.Member && (
                  <DropdownMenuItem
                    onClick={() => handleChangeRole(MembershipRole.Member)}
                  >
                    Set as Member
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleRemove}
                >
                  Remove Member
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!isOwner && (
            <TransferOwnershipDialog
              orgUid={orgUid}
              currentOwnerName={currentOwnerName}
              newOwnerName={displayName}
              newOwnerMembershipId={membership.id}
            />
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export default OrgMembersSection;
