'use client';

import DataTable from '~/core/ui/DataTable';
import type { ColumnDef } from '@tanstack/react-table';

interface BroadcastTableProps {
  broadcasts: any[];
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  queued: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  sending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  sent: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const columns: ColumnDef<any>[] = [
  {
    header: 'Subject',
    accessorKey: 'name',
    cell: ({ row }) => (
      <a
        href={`/admin/newsletter/broadcasts/${row.original.id}`}
        className="text-primary hover:underline"
      >
        {row.original.name || row.original.subject || 'Untitled'}
      </a>
    ),
  },
  {
    header: 'Status',
    accessorKey: 'status',
    cell: ({ row }) => {
      const status = row.original.status || 'draft';
      const style = STATUS_STYLES[status] || STATUS_STYLES.draft;
      return (
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${style}`}
        >
          {status}
        </span>
      );
    },
  },
  {
    header: 'Created',
    accessorKey: 'created_at',
    cell: ({ row }) => (
      <span suppressHydrationWarning>
        {row.original.created_at
          ? new Date(row.original.created_at).toLocaleDateString()
          : '-'}
      </span>
    ),
  },
];

export default function BroadcastTable({ broadcasts }: BroadcastTableProps) {
  return <DataTable data={broadcasts} columns={columns} />;
}
