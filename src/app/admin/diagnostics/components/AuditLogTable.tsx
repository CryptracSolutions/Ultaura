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
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-2 text-left font-medium">Timestamp</th>
            <th className="px-4 py-2 text-left font-medium">Admin</th>
            <th className="px-4 py-2 text-left font-medium">Action</th>
            <th className="px-4 py-2 text-left font-medium">Target</th>
            <th className="px-4 py-2 text-left font-medium">Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-border last:border-0">
              <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                {formatTimestamp(log.created_at)}
              </td>
              <td className="px-4 py-2">{log.admin_email}</td>
              <td className="px-4 py-2 font-mono text-xs">{log.action}</td>
              <td className="px-4 py-2 font-mono text-xs">
                {formatTarget(log.target_type, log.target_id)}
              </td>
              <td className="max-w-xs truncate px-4 py-2 text-xs text-muted-foreground">
                {truncateDetails(log.metadata)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AuditLogTable;
