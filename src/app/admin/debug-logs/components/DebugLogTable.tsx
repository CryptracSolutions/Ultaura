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
  logs: DebugLog[];
  page: number;
  perPage: number;
  pageCount: number;
}) {
  return (
    <div data-cy="ultaura-debug-logs-table">
      <div className="rounded-xl bg-card card-border-accent overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Created</TableHead>
              <TableHead className="w-[80px]">Event</TableHead>
              <TableHead className="w-[120px]">Tool</TableHead>
              <TableHead className="w-[200px]">Call Session</TableHead>
              <TableHead className="w-[200px]">Account</TableHead>
              <TableHead>Payload</TableHead>
              <TableHead>Metadata</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No logs found.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {log.created_at ? (
                      <span suppressHydrationWarning>
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {log.event_type}
                    </span>
                  </TableCell>
                  <TableCell>{log.tool_name ?? '-'}</TableCell>
                  <TableCell>{renderIdCell(log.call_session_id)}</TableCell>
                  <TableCell>{renderIdCell(log.account_id)}</TableCell>
                  <TableCell>
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
                  <TableCell>{renderJsonCell(log.metadata)}</TableCell>
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
