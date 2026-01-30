import { AlertTriangle } from 'lucide-react';
import type { InsightsDashboard } from '~/lib/ultaura/types';

interface InsightsSummaryProps {
  summary: InsightsDashboard['summary'];
  showMood?: boolean;
}

function formatDelta(value: number | null, unit = ''): string | null {
  if (value === null) return null;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}${unit}`;
}

function StatRow({ label, value, delta }: { label: string; value: React.ReactNode; delta?: string | null }): React.ReactElement {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">
        {value}
        {delta && <span className="text-muted-foreground ml-2">({delta})</span>}
      </span>
    </div>
  );
}

export function InsightsSummary({ summary, showMood = true }: InsightsSummaryProps): React.ReactElement {
  const durationDisplay = summary.avgDurationMinutes === null ? '-' : `${summary.avgDurationMinutes}m`;
  const notablePatterns = [summary.moodShiftNote, summary.socialNeedNote].filter(Boolean) as string[];

  return (
    <div className="rounded-xl bg-card p-6 card-border-accent">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">This Week Summary</h3>
        <span className="text-xs text-muted-foreground">Past 7 days</span>
      </div>

      <div className="mt-4 space-y-3">
        <StatRow
          label="Calls answered"
          value={`${summary.answeredCalls}/${summary.scheduledCalls}`}
          delta={formatDelta(summary.answeredDelta)}
        />
        <StatRow label="Inbound calls" value={summary.inboundCalls} />
        <StatRow
          label="Avg duration"
          value={durationDisplay}
          delta={formatDelta(summary.durationDeltaMinutes, 'm')}
        />
        {showMood && <StatRow label="Mood" value={summary.moodSummary || 'No insights yet'} />}
      </div>

      {notablePatterns.length > 0 && (
        <div className="mt-4 rounded-lg border border-border/60 bg-muted/20 p-4 text-sm">
          <div className="font-medium text-foreground">Notable patterns</div>
          <div className="text-muted-foreground mt-1 space-y-1">
            {notablePatterns.map((note, index) => (
              <div key={`${note}-${index}`}>{note}</div>
            ))}
          </div>
        </div>
      )}

      {summary.showMissedCallsWarning && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
          <div>
            <div className="font-medium">Missed calls rising</div>
            <div className="text-muted-foreground">
              {summary.missedCalls} missed scheduled calls this week.
            </div>
          </div>
        </div>
      )}

      {summary.needsFollowUp && (
        <div className="mt-4 rounded-lg border border-border/60 bg-muted/20 p-4 text-sm">
          <div className="font-medium text-foreground">Follow-up suggested</div>
          <div className="text-muted-foreground mt-1">{summary.followUpReasons.join(', ')}</div>
        </div>
      )}
    </div>
  );
}
