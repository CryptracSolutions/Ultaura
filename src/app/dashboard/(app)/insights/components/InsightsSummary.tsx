import { AlertTriangle } from 'lucide-react';
import type { InsightsDashboard } from '~/lib/ultaura/types';

interface InsightsSummaryProps {
  summary: InsightsDashboard['summary'];
}

function formatDelta(value: number | null, unit?: string): string | null {
  if (value === null) return null;
  const sign = value > 0 ? `+${value}` : `${value}`;
  return `${sign}${unit ?? ''}`;
}

export function InsightsSummary({ summary }: InsightsSummaryProps) {
  const answeredDelta = formatDelta(summary.answeredDelta);
  const durationDelta = formatDelta(summary.durationDeltaMinutes, 'm');

  const durationDisplay =
    summary.avgDurationMinutes === null ? '-' : `${summary.avgDurationMinutes}m`;
  const notablePatterns = [summary.moodShiftNote, summary.socialNeedNote].filter(
    Boolean
  ) as string[];

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">This Week Summary</h3>
        <span className="text-xs text-muted-foreground">Past 7 days</span>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Calls answered</span>
          <span className="font-medium text-foreground">
            {summary.answeredCalls}/{summary.scheduledCalls}
            {answeredDelta !== null ? (
              <span className="text-muted-foreground ml-2">({answeredDelta})</span>
            ) : null}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Avg duration</span>
          <span className="font-medium text-foreground">
            {durationDisplay}
            {durationDelta !== null ? (
              <span className="text-muted-foreground ml-2">({durationDelta})</span>
            ) : null}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Mood</span>
          <span className="font-medium text-foreground">
            {summary.moodSummary || 'No insights yet'}
          </span>
        </div>
      </div>

      {notablePatterns.length > 0 ? (
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <div className="font-medium text-foreground">Notable patterns</div>
          <div className="text-muted-foreground mt-1 space-y-1">
            {notablePatterns.map((note, index) => (
              <div key={`${note}-${index}`}>{note}</div>
            ))}
          </div>
        </div>
      ) : null}

      {summary.showMissedCallsWarning ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
          <div>
            <div className="font-medium">Missed calls rising</div>
            <div className="text-muted-foreground">
              {summary.missedCalls} missed scheduled calls this week.
            </div>
          </div>
        </div>
      ) : null}

      {summary.needsFollowUp ? (
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <div className="font-medium text-foreground">Follow-up suggested</div>
          <div className="text-muted-foreground mt-1">
            {summary.followUpReasons.join(', ')}
          </div>
        </div>
      ) : null}
    </div>
  );
}
