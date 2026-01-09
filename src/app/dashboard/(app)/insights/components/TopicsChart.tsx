import type { InsightsDashboard } from '~/lib/ultaura/types';

interface TopicsChartProps {
  topics: InsightsDashboard['topics'];
}

export function TopicsChart({ topics }: TopicsChartProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Topics This Week</h3>
      </div>

      {topics.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {topics.map((topic) => (
            <span
              key={topic.code}
              className="inline-flex items-center rounded-full border border-primary/10 bg-primary/10 px-3 py-1 text-xs text-primary"
            >
              {topic.label}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground mt-4">
          No topics captured this week.
        </p>
      )}
    </div>
  );
}
