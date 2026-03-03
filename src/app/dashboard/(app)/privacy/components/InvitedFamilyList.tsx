'use client';

import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/core/ui/Table';
import TableContainer from '~/core/ui/TableContainer';
import TableEmptyState from '~/core/ui/TableEmptyState';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import type { NotificationRecipient } from '~/lib/ultaura/types';
import { formatUsPhoneForDisplay } from '~/lib/ultaura/phone';
import { ResponsiveActionMenu } from '~/components/ultaura/ResponsiveActionMenu';

interface InvitedFamilyListProps {
  recipients: NotificationRecipient[];
  onRemove: (recipientId: string) => Promise<void>;
  disabled?: boolean;
}

function getStatus(recipient: NotificationRecipient): {
  label: string;
  className: string;
} {
  if (recipient.unsubscribedAt) {
    return { label: 'Unsubscribed', className: 'text-muted-foreground' };
  }
  if (recipient.confirmedAt) {
    return { label: 'Confirmed', className: 'text-success' };
  }
  return { label: 'Pending', className: 'text-warning' };
}

export function InvitedFamilyList({
  recipients,
  onRemove,
  disabled = false,
}: InvitedFamilyListProps) {
  const [pendingRemove, setPendingRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const sorted = useMemo(
    () =>
      [...recipients].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [recipients],
  );

  if (sorted.length === 0) {
    return (
      <TableContainer>
        <TableEmptyState message="No invited family members yet." />
      </TableContainer>
    );
  }

  return (
    <TableContainer>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((recipient) => {
            const status = getStatus(recipient);
            return (
              <TableRow key={recipient.id}>
                <TableCell>{recipient.name}</TableCell>
                <TableCell>{recipient.email}</TableCell>
                <TableCell>
                  {recipient.phoneE164 ? (
                    <span className="text-sm">
                      {formatUsPhoneForDisplay(recipient.phoneE164)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className={`text-xs font-medium ${status.className}`}>
                    {status.label}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <ResponsiveActionMenu
                    actions={[
                      {
                        label: 'Remove',
                        icon: <Trash2 className="w-5 h-5" />,
                        onClick: () =>
                          setPendingRemove({
                            id: recipient.id,
                            name: recipient.name,
                          }),
                        variant: 'destructive',
                      },
                    ]}
                    disabled={disabled}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <ConfirmationDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => !open && setPendingRemove(null)}
        title="Remove recipient?"
        description={
          pendingRemove
            ? `Remove ${pendingRemove.name} from family notifications?`
            : 'Remove this recipient from family notifications?'
        }
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={async () => {
          if (!pendingRemove) return;
          await onRemove(pendingRemove.id);
          setPendingRemove(null);
        }}
      />
    </TableContainer>
  );
}
