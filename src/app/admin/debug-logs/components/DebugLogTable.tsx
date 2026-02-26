'use client';

import AdminPagination from '~/app/admin/components/AdminPagination';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '~/core/ui/Table';
import type { DebugLog } from '~/lib/ultaura/admin-types';

function renderIdCell(value: string | null) {
  if (!value) return <span className="text-muted-foreground">-</span>;
  return (
    <span className="inline-block max-w-[200px] truncate font-mono text-xs" title={value}>
      {value}
    </span>
  );
}

function renderJsonCell(value: Record<string, unknown> | null) {
  if (!value || Object.keys(value).length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  const full = JSON.stringify(value, null, 2);
  const preview = full.length > 180 ? `${full.slice(0, 180)}…` : full;

  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-xs text-muted-foreground">
        <span className="inline-block max-w-[320px] truncate rounded bg-muted px-2 py-1 font-mono">
          {preview}
        </span>
        <span className="ml-2 text-xs text-primary/80 group-open:hidden">View full</span>
      </summary>
      <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-2 text-xs">
        {full}
      </pre>
    </details>
  );
}

function renderCreatedAtCell(value: string | null) {
  if (!value) return <span className="text-muted-foreground">-</span>;

  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <div className="flex flex-col leading-tight">
      <span suppressHydrationWarning className="text-sm">
        {createdAt.toLocaleDateString()}
      </span>
      <span suppressHydrationWarning className="text-xs text-muted-foreground">
        {createdAt.toLocaleTimeString()}
      </span>
    </div>
  );
}

export function DebugLogTable({
  logs,
  page,
  perPage,
  pageCount,
}: {
  logs: DebugLog[];
  page: number;
  perPage: number;
  pageCount: number;
}) {
  return (
    <div data-cy="ultaura-debug-logs-table">
      <div className="rounded-xl bg-card card-border-accent overflow-hidden">
        <Table className="min-w-[1120px]">
          <TableHeader>
            <TableRow>
              <TableHead className="sticky top-0 z-10 w-[170px] bg-card">Created</TableHead>
              <TableHead className="sticky top-0 z-10 w-[120px] bg-card">Event</TableHead>
              <TableHead className="sticky top-0 z-10 w-[140px] bg-card">Tool</TableHead>
              <TableHead className="sticky top-0 z-10 w-[220px] bg-card">Call Session</TableHead>
              <TableHead className="sticky top-0 z-10 w-[220px] bg-card">Account</TableHead>
              <TableHead className="sticky top-0 z-10 min-w-[220px] bg-card">Payload</TableHead>
              <TableHead className="sticky top-0 z-10 min-w-[220px] bg-card">Metadata</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr:nth-child(even)]:bg-muted/15">
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No logs found.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{renderCreatedAtCell(log.created_at)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                      {log.event_type}
                    </span>
                  </TableCell>
                  <TableCell>
                    {log.tool_name ? (
                      <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs font-medium">
                        {log.tool_name}
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>{renderIdCell(log.call_session_id)}</TableCell>
                  <TableCell>{renderIdCell(log.account_id)}</TableCell>
                  <TableCell className="align-top">
                    {log.payload_decrypt_failed ? (
                      <div className="text-destructive text-xs">
                        [Unable to decrypt]
                        {log.payload_summary ? (
                          <div className="mt-1">{renderJsonCell(log.payload_summary)}</div>
                        ) : null}
                      </div>
                    ) : (
                      <div>
                        {log.payload_encrypted ? (
                          <span className="mr-2 text-xs text-muted-foreground">[Encrypted]</span>
                        ) : null}
                        {renderJsonCell(log.payload)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="align-top">{renderJsonCell(log.metadata)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AdminPagination page={page} pageCount={pageCount} perPage={perPage} />
    </div>
  );
}
