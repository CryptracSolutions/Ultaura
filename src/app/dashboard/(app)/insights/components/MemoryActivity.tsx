import { DateTime } from 'luxon';
import { Brain } from 'lucide-react';
import { InfoTip } from '~/core/ui/InfoTip';
import type { MemoryActivityData } from '~/lib/ultaura/types';

interface MemoryActivityProps {
  data: MemoryActivityData;
  timezone: string;
}

function formatKeyToTitle(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTypeToTitle(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function MemoryActivity({ data, timezone }: MemoryActivityProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <Brain className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Memory Activity</h3>
        <InfoTip content="Shows memory identifiers (keys) only — not the stored content itself. Full details stay private and are only accessible to Ultaura during calls." />
      </div>

      {data.items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No memories added yet.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {data.items.map((item) => {
            const dateLabel = DateTime.fromISO(item.createdAt).setZone(timezone).toFormat('MMM d, yyyy');
            return (
              <div
                key={item.memoryId}
                className="min-h-12 rounded-xl border border-border/60 border-l-4 px-4 py-3.5"
                style={{ borderLeftColor: 'var(--primary)' }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{formatKeyToTitle(item.key)}</p>
                  <span className="text-xs text-muted-foreground">{dateLabel}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatTypeToTitle(item.type)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
