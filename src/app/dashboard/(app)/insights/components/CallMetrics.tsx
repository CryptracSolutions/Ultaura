import type { InsightsDashboard } from '~/lib/ultaura/types';

interface CallMetricsProps {
  activity: InsightsDashboard['callActivity'];
}

const COLORS = {
  scheduled: 'bg-primary/40',
  reminder: 'bg-amber-400/40',
  inbound: 'bg-sky-400/40',
};

export function CallMetrics({ activity }: CallMetricsProps) {
  const maxTotal = activity.reduce((max, entry) => {
    const total = entry.scheduled + entry.reminder + entry.inbound;
    return Math.max(max, total);
  }, 0) || 1;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Call Activity</h3>
        <span className="text-xs text-muted-foreground">Last 30 days</span>
      </div>

      <div className="mt-4 flex h-36 items-end gap-1">
        {activity.map((entry) => {
          const total = entry.scheduled + entry.reminder + entry.inbound;
          const scheduledHeight = total ? (entry.scheduled / maxTotal) * 100 : 0;
          const reminderHeight = total ? (entry.reminder / maxTotal) * 100 : 0;
          const inboundHeight = total ? (entry.inbound / maxTotal) * 100 : 0;
          const title = `${entry.date}: ${entry.scheduled} scheduled, ${entry.reminder} reminder, ${entry.inbound} inbound`;

          return (
            <div
              key={entry.date}
              className="flex-1 min-w-[4px] flex flex-col justify-end"
              title={title}
            >
              <div className="w-full flex flex-col justify-end gap-[2px]">
                {entry.inbound > 0 ? (
                  <div
                    className={`w-full rounded-sm ${COLORS.inbound}`}
                    style={{ height: `${inboundHeight}%` }}
                  />
                ) : null}
                {entry.reminder > 0 ? (
                  <div
                    className={`w-full rounded-sm ${COLORS.reminder}`}
                    style={{ height: `${reminderHeight}%` }}
                  />
                ) : null}
                {entry.scheduled > 0 ? (
                  <div
                    className={`w-full rounded-sm ${COLORS.scheduled}`}
                    style={{ height: `${scheduledHeight}%` }}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${COLORS.scheduled}`} />
          Scheduled
        </span>
        <span className="inline-flex items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${COLORS.reminder}`} />
          Reminder
        </span>
        <span className="inline-flex items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${COLORS.inbound}`} />
          Inbound
        </span>
      </div>
    </div>
  );
}
