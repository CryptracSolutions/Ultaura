import type { InsightsDashboard } from '~/lib/ultaura/types';

interface ConcernsListProps {
  concerns: InsightsDashboard['concerns'];
}

const NOVELTY_COLORS: Record<string, string> = {
  new: 'bg-warning/10 text-warning',
  recurring: 'bg-primary/10 text-primary',
  resolved: 'bg-success/10 text-success',
};

function titleCase(value: string): string {
  if (!value) return value;
  return value[0].toUpperCase() + value.slice(1);
}

export function ConcernsList({ concerns }: ConcernsListProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Wellbeing Notes</h3>
      </div>

      {concerns.length > 0 ? (
        <div className="mt-4 space-y-3">
          {concerns.map((concern) => {
            const noveltyLabel = titleCase(concern.novelty);
            const severityText =
              concern.novelty === 'resolved'
                ? ` (was ${concern.severity})`
                : ` (${concern.severity})`;
            return (
              <div key={`${concern.code}-${concern.novelty}`} className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    NOVELTY_COLORS[concern.novelty]
                  }`}
                >
                  {noveltyLabel}
                </span>
                <span className="text-sm text-foreground">
                  {concern.label}
                  {severityText}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground mt-4">
          No wellbeing concerns detected this week.
        </p>
      )}
    </div>
  );
}
