'use client';

import TableContainer from '~/core/ui/TableContainer';
import TableEmptyState from '~/core/ui/TableEmptyState';
import TablePagination from '~/core/ui/TablePagination';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '~/core/ui/Table';
import { formatDateTime } from '~/lib/utils/format-date';
import type { DebugLog } from '~/lib/ultaura/admin-types';

function renderIdCell(value: string | null) {
  if (!value) return <span className="text-muted-foreground">-</span>;
  return (
    <span
      className="inline-block max-w-[200px] truncate font-mono text-xs"
      title={value}
    >
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
        <span className="ml-2 text-xs text-primary/80 group-open:hidden">
          View full
        </span>
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
      <TableContainer>
        {logs.length === 0 ? (
          <TableEmptyState message="No logs found." />
        ) : (
          <Table striped stickyHeader className="min-w-[1120px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[170px]">Created</TableHead>
                <TableHead className="w-[120px]">Event</TableHead>
                <TableHead className="w-[140px]">Tool</TableHead>
                <TableHead className="w-[220px]">Call Session</TableHead>
                <TableHead className="w-[220px]">Account</TableHead>
                <TableHead className="min-w-[220px]">Payload</TableHead>
                <TableHead className="min-w-[220px]">Metadata</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <span className="text-sm">
                      {formatDateTime(log.created_at)}
                    </span>
                  </TableCell>
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
                          <div className="mt-1">
                            {renderJsonCell(log.payload_summary)}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div>
                        {log.payload_encrypted ? (
                          <span className="mr-2 text-xs text-muted-foreground">
                            [Encrypted]
                          </span>
                        ) : null}
                        {renderJsonCell(log.payload)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    {renderJsonCell(log.metadata)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <TablePagination page={page} pageCount={pageCount} perPage={perPage} />
      </TableContainer>
    </div>
  );
}
