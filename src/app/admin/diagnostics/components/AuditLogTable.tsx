import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '~/core/ui/Table';

interface AuditLogRow {
  id: string;
  created_at: string;
  admin_email: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
}

interface AuditLogTableProps {
  logs: AuditLogRow[];
}

function formatTarget(type: string | null, id: string | null): string {
  if (!type && !id) return '-';
  if (type && id) return `${type}/${id}`;
  return type ?? id ?? '-';
}

function truncateDetails(
  metadata: Record<string, unknown> | null,
  maxLength = 100,
): string {
  if (!metadata) return '-';
  const raw = JSON.stringify(metadata);
  if (raw.length <= maxLength) return raw;
  return raw.slice(0, maxLength) + '...';
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function AuditLogTable({ logs }: AuditLogTableProps) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No audit log entries.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Timestamp</TableHead>
            <TableHead>Admin</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatTimestamp(log.created_at)}
              </TableCell>
              <TableCell>{log.admin_email}</TableCell>
              <TableCell className="font-mono text-xs">{log.action}</TableCell>
              <TableCell className="font-mono text-xs">
                {formatTarget(log.target_type, log.target_id)}
              </TableCell>
              <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                {truncateDetails(log.metadata)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default AuditLogTable;
