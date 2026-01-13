import { DateTime } from 'luxon';
import type { RelationshipIndicatorsData } from '~/lib/ultaura/types';

interface RelationshipIndicatorsProps {
  data: RelationshipIndicatorsData;
  timezone: string;
}

const SENTIMENT_LABELS: Record<string, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  complicated: 'Complicated',
};

export function RelationshipIndicators({ data, timezone }: RelationshipIndicatorsProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Relationship indicators</h3>
        <span className="text-xs text-muted-foreground">Last 30 days</span>
      </div>

      {data.indicators.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No relationship indicators yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {data.indicators.map((indicator) => {
            const lastMentioned = indicator.lastMentionedAt
              ? DateTime.fromISO(indicator.lastMentionedAt).setZone(timezone).toFormat('MMM d')
              : 'Not recent';

            return (
              <div key={indicator.name} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{indicator.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {indicator.relationRole} - {indicator.relationType}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {SENTIMENT_LABELS[indicator.sentiment] ?? indicator.sentiment}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>{indicator.mentionCount30d} mentions</span>
                  <span>Last mentioned {lastMentioned}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
