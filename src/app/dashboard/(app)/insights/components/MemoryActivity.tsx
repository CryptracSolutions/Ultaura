import { DateTime } from 'luxon';
import type { MemoryActivityData } from '~/lib/ultaura/types';

interface MemoryActivityProps {
  data: MemoryActivityData;
  timezone: string;
}

export function MemoryActivity({ data, timezone }: MemoryActivityProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Memory activity</h3>
        <span className="text-xs text-muted-foreground">Keys only</span>
      </div>

      {data.items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No memories added yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {data.items.map((item) => {
            const dateLabel = DateTime.fromISO(item.createdAt).setZone(timezone).toFormat('MMM d, yyyy');
            return (
              <div key={item.memoryId} className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{item.key}</p>
                  <span className="text-xs text-muted-foreground">{dateLabel}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                    {item.type.replace(/_/g, ' ')}
                  </span>
                  <span>{item.isPrivate ? 'Private to senior' : 'Shareable with payer'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
