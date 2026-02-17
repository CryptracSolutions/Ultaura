import Badge from '~/core/ui/Badge';

type DiagnosticStatus = 'pass' | 'fail' | 'warn';

interface DiagnosticCardProps {
  name: string;
  status: DiagnosticStatus;
  details: string;
  error?: string;
}

const statusConfig: Record<
  DiagnosticStatus,
  { label: string; color: 'success' | 'error' | 'warn' }
> = {
  pass: { label: 'Pass', color: 'success' },
  fail: { label: 'Fail', color: 'error' },
  warn: { label: 'Warn', color: 'warn' },
};

function DiagnosticCard({ name, status, details, error }: DiagnosticCardProps) {
  const config = statusConfig[status];

  return (
    <div className="flex flex-col rounded-lg border border-border bg-background p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{name}</h3>
        <Badge color={config.color} size="small">
          {config.label}
        </Badge>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">{details}</p>

      {error && (
        <p className="mt-2 text-xs text-destructive break-all">{error}</p>
      )}
    </div>
  );
}

export default DiagnosticCard;
export type { DiagnosticStatus };
