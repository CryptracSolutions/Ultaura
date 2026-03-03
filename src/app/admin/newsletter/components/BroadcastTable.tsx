'use client';

import Badge from '~/core/ui/Badge';
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
import { formatDate } from '~/lib/utils/format-date';

interface BroadcastTableProps {
  broadcasts: any[];
}

function statusBadgeColor(
  status: string,
): 'normal' | 'info' | 'success' | 'error' | 'warn' {
  switch (status) {
    case 'draft':
      return 'normal';
    case 'queued':
    case 'sending':
      return 'info';
    case 'sent':
      return 'success';
    case 'failed':
    case 'cancelled':
      return 'error';
    case 'scheduled':
      return 'warn';
    default:
      return 'normal';
  }
}

export default function BroadcastTable({ broadcasts }: BroadcastTableProps) {
  return (
    <TableContainer>
      {broadcasts.length === 0 ? (
        <TableEmptyState message="No broadcasts found." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {broadcasts.map((broadcast) => {
              const status = broadcast.status || 'draft';
              return (
                <TableRow key={broadcast.id}>
                  <TableCell>
                    <a
                      href={`/admin/newsletter/broadcasts/${broadcast.id}`}
                      className="text-primary hover:underline"
                    >
                      {broadcast.name || broadcast.subject || 'Untitled'}
                    </a>
                  </TableCell>
                  <TableCell>
                    <Badge color={statusBadgeColor(status)} size="small">
                      {status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(broadcast.created_at)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </TableContainer>
  );
}
