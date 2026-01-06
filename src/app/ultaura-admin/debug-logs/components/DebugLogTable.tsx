'use client';

import type { ColumnDef } from '@tanstack/react-table';

import DataTable from '~/core/ui/DataTable';
import type { DebugLog } from '~/lib/ultaura/admin-types';

type DebugLogRow = DebugLog;

const columns: Array<ColumnDef<DebugLogRow>> = [
  {
    header: 'Created',
    id: 'created_at',
    size: 120,
    cell: ({ row }) => {
      const value = row.original.created_at;
      if (!value) return <span className="text-muted-foreground">-</span>;
      return <span suppressHydrationWarning>{new Date(value).toLocaleString()}</span>;
    },
  },
  {
    header: 'Event',
    id: 'event_type',
    size: 80,
    cell: ({ row }) => (
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {row.original.event_type}
      </span>
    ),
  },
  {
    header: 'Tool',
    id: 'tool_name',
    size: 120,
    cell: ({ row }) => row.original.tool_name ?? '-',
  },
  {
    header: 'Call Session',
    id: 'call_session_id',
    size: 200,
    cell: ({ row }) => renderIdCell(row.original.call_session_id),
  },
  {
    header: 'Account',
    id: 'account_id',
    size: 200,
    cell: ({ row }) => renderIdCell(row.original.account_id),
  },
  {
    header: 'Payload',
    id: 'payload',
    cell: ({ row }) => renderJsonCell(row.original.payload),
  },
  {
    header: 'Metadata',
    id: 'metadata',
    cell: ({ row }) => renderJsonCell(row.original.metadata),
  },
];

function renderIdCell(value: string | null) {
  if (!value) return <span className="text-muted-foreground">-</span>;
  return <span className="font-mono text-xs break-all">{value}</span>;
}

function renderJsonCell(value: Record<string, unknown> | null) {
  if (!value || Object.keys(value).length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  const full = JSON.stringify(value, null, 2);
  const preview = full.length > 180 ? `${full.slice(0, 180)}…` : full;

  return (
    <details className="group">
      <summary className="cursor-pointer text-xs text-muted-foreground">
        {preview}
      </summary>
      <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-2 text-xs">
        {full}
      </pre>
    </details>
  );
}

export function DebugLogTable({
  logs,
  page,
  perPage,
  pageCount,
}: {
  logs: DebugLogRow[];
  page: number;
  perPage: number;
  pageCount: number;
}) {
  return (
    <DataTable
      tableProps={{
        'data-cy': 'ultaura-debug-logs-table',
      }}
      pageSize={perPage}
      pageIndex={page - 1}
      pageCount={pageCount}
      columns={columns}
      data={logs}
    />
  );
}
