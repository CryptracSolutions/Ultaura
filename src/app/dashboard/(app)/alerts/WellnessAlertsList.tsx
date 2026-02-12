'use client';

import type { ElementType } from 'react';
import { DateTime } from 'luxon';
import { CheckCircle, AlertTriangle, AlertCircle, BellRing, Info } from 'lucide-react';
import type { WellnessAlert } from '~/lib/ultaura/types';

interface WellnessAlertsListProps {
  alerts: WellnessAlert[];
  disabled?: boolean;
}

const SEVERITY_STYLES: Record<WellnessAlert['severity'], string> = {
  info: 'bg-primary/10 text-primary',
  warning: 'bg-amber-500/10 text-amber-600',
  urgent: 'bg-destructive/10 text-destructive',
};

const SEVERITY_ICONS: Record<WellnessAlert['severity'], ElementType> = {
  info: Info,
  warning: AlertTriangle,
  urgent: AlertCircle,
};

function formatAlertDate(value: string): string {
  const date = DateTime.fromISO(value);
  if (!date.isValid) return value;
  return date.toLocaleString(DateTime.DATETIME_MED);
}

export function WellnessAlertsList({ alerts, disabled: _disabled = false }: WellnessAlertsListProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Wellness Alerts</h3>
        <p className="text-xs text-muted-foreground">
          Alerts are summaries only. No private details are shared.
        </p>
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No wellness alerts yet.
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const acknowledged = Boolean(alert.acknowledgedAt);
            const SeverityIcon = SEVERITY_ICONS[alert.severity];
            return (
              <div
                key={alert.id}
                className="rounded-lg border border-border/60 bg-muted/20 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${SEVERITY_STYLES[alert.severity]}`}
                      >
                        <SeverityIcon className="h-3 w-3" aria-hidden="true" />
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
                      <span className="text-xs text-muted-foreground">
                        Acknowledgement unavailable
                      </span>
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
