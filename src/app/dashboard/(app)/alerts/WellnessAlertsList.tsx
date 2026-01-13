'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DateTime } from 'luxon';
import { toast } from 'sonner';
import { CheckCircle, AlertTriangle, BellRing } from 'lucide-react';
import Button from '~/core/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import type { LineRow, WellnessAlert } from '~/lib/ultaura/types';
import { acknowledgeWellnessAlert } from '~/lib/ultaura/alerts';

interface WellnessAlertsListProps {
  alerts: WellnessAlert[];
  lines: LineRow[];
  disabled?: boolean;
}

const SEVERITY_STYLES: Record<WellnessAlert['severity'], string> = {
  info: 'bg-primary/10 text-primary',
  warning: 'bg-amber-500/10 text-amber-600',
  urgent: 'bg-destructive/10 text-destructive',
};

function formatAlertDate(value: string): string {
  const date = DateTime.fromISO(value);
  if (!date.isValid) return value;
  return date.toLocaleString(DateTime.DATETIME_MED);
}

export function WellnessAlertsList({ alerts, lines, disabled = false }: WellnessAlertsListProps) {
  const router = useRouter();
  const [selectedLineId, setSelectedLineId] = useState('all');
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const filteredAlerts = useMemo(() => {
    if (selectedLineId === 'all') return alerts;
    return alerts.filter((alert) => alert.lineId === selectedLineId);
  }, [alerts, selectedLineId]);

  const handleAcknowledge = async (alertId: string) => {
    if (disabled) return;
    setAcknowledgingId(alertId);
    const result = await acknowledgeWellnessAlert(alertId);
    setAcknowledgingId(null);

    if (!result.success) {
      toast.error(result.error.message || 'Failed to acknowledge alert');
      return;
    }

    toast.success('Alert acknowledged');
    router.refresh();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Wellness Alerts</h3>
          <p className="text-xs text-muted-foreground">
            Alerts are summaries only. No private details are shared.
          </p>
        </div>
        <div className="min-w-[180px]">
          <Select value={selectedLineId} onValueChange={setSelectedLineId}>
            <SelectTrigger className="w-full py-2.5">
              <SelectValue placeholder="All lines" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All lines</SelectItem>
              {lines.map((line) => (
                <SelectItem key={line.id} value={line.id}>
                  {line.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredAlerts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No wellness alerts yet.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const acknowledged = Boolean(alert.acknowledgedAt);
            return (
              <div
                key={alert.id}
                className="rounded-lg border border-border/70 bg-muted/20 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${SEVERITY_STYLES[alert.severity]}`}
                      >
                        {alert.severity}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <BellRing className="h-3.5 w-3.5" />
                        {alert.lineName}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                      <p className="text-sm text-muted-foreground">{alert.summary}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatAlertDate(alert.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {acknowledged ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-success" />
                        Acknowledged
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="small"
                        onClick={() => handleAcknowledge(alert.id)}
                        disabled={disabled || acknowledgingId === alert.id}
                        loading={acknowledgingId === alert.id}
                      >
                        Acknowledge
                      </Button>
                    )}
                  </div>
                </div>

                {alert.severity === 'urgent' ? (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-3">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                    <p className="text-xs text-destructive">
                      If you believe this is an emergency, contact local services immediately.
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
