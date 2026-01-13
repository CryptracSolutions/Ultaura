'use client';

import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/core/ui/Table';
import Button from '~/core/ui/Button';
import type { NotificationRecipient } from '~/lib/ultaura/types';

interface InvitedFamilyListProps {
  recipients: NotificationRecipient[];
  onRemove: (recipientId: string) => Promise<void>;
  disabled?: boolean;
}

function getStatus(recipient: NotificationRecipient): { label: string; className: string } {
  if (recipient.unsubscribedAt) {
    return { label: 'Unsubscribed', className: 'text-muted-foreground' };
  }
  if (recipient.confirmedAt) {
    return { label: 'Confirmed', className: 'text-success' };
  }
  return { label: 'Pending', className: 'text-warning' };
}

export function InvitedFamilyList({ recipients, onRemove, disabled = false }: InvitedFamilyListProps) {
  const sorted = useMemo(() => {
    return [...recipients].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [recipients]);

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground">No invited family members yet.</p>;
  }

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
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
                  <span className={`text-xs font-medium ${status.className}`}>{status.label}</span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(recipient.id)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
