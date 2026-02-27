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

const TYPE_BORDER_COLORS: Record<string, string> = {
  preference: 'var(--success)',
  wellbeing: 'var(--warning)',
  follow_up: 'var(--info)',
  relationship: 'var(--info)',
};

function getTypeBorderColor(type: string): string {
  const normalizedType = type.toLowerCase().replace(/\s/g, '_');
  return TYPE_BORDER_COLORS[normalizedType] || 'var(--muted)';
}

export function MemoryActivity({ data, timezone }: MemoryActivityProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <Brain className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Memory Activity</h3>
        <InfoTip content="Shows memory identifiers (keys) only — not the stored content itself. Full details stay private and are only accessible to Ara during calls." />
      </div>

      {data.items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No memories added yet.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {data.items.map((item) => {
            const dateLabel = DateTime.fromISO(item.createdAt).setZone(timezone).toFormat('MMM d, yyyy');
            const borderColor = getTypeBorderColor(item.type);
            return (
              <div
                key={item.memoryId}
                className="min-h-12 rounded-xl border border-border/60 border-l-4 px-4 py-3.5"
                style={{ borderLeftColor: borderColor }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{formatKeyToTitle(item.key)}</p>
                  <span className="text-xs text-muted-foreground">{dateLabel}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {item.type.replace(/_/g, ' ')}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
