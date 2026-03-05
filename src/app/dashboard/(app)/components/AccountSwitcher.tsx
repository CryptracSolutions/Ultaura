'use client';

import { useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/core/ui/Select';
import { setCookie } from '~/core/generic/cookies';
import MembershipRole from '~/lib/organizations/types/membership-role';

type OrganizationOption = {
  organization: {
    id: number;
    uuid: string;
    name: string;
  };
  role: number;
};

const ROLE_LABELS: Record<number, string> = {
  [MembershipRole.Viewer]: 'Viewing',
  [MembershipRole.Member]: 'Member',
  [MembershipRole.Admin]: 'Admin',
  [MembershipRole.Owner]: 'Owner',
};

function getRoleLabel(role: number): string {
  return ROLE_LABELS[role] ?? 'Unknown';
}

function AccountSwitcher(props: {
  organizations: OrganizationOption[];
  currentOrganizationUuid: string | undefined;
  userId: string | undefined;
  className?: string;
}) {
  const { organizations, currentOrganizationUuid, userId, className } = props;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const sortedOrganizations = useMemo(() => {
    return [...organizations].sort((a, b) =>
      a.organization.name.localeCompare(b.organization.name),
    );
  }, [organizations]);

  if (sortedOrganizations.length < 2 || !userId) {
    return null;
  }

  const onValueChange = (organizationUuid: string) => {
    if (!organizationUuid || organizationUuid === currentOrganizationUuid) {
      return;
    }

    const cookieName = `${userId}-organizationId`;
    setCookie(cookieName, organizationUuid);
    const selectionModeCookieName = `${userId}-organizationSelectionMode`;
    setCookie(selectionModeCookieName, 'manual');

    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className={className}>
      <Select
        value={currentOrganizationUuid}
        onValueChange={onValueChange}
        disabled={isPending}
      >
        <SelectTrigger className="h-10 w-full text-left">
          <SelectValue placeholder="Switch account" />
        </SelectTrigger>
        <SelectContent align="start" className="w-[var(--radix-select-trigger-width)]">
          {sortedOrganizations.map((entry) => {
            const roleLabel = getRoleLabel(entry.role);

            return (
              <SelectItem key={entry.organization.uuid} value={entry.organization.uuid}>
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="truncate font-medium">{entry.organization.name}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {roleLabel}
                  </span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

export default AccountSwitcher;
