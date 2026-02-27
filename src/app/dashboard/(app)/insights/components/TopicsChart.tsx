import { Tag } from 'lucide-react';
import { InfoTip } from '~/core/ui/InfoTip';
import type { InsightsDashboard } from '~/lib/ultaura/types';

interface TopicsChartProps {
  topics: InsightsDashboard['topics'];
}

export function TopicsChart({ topics }: TopicsChartProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <Tag className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Topics This Week</h3>
        <InfoTip content="Topics discussed during calls this week, extracted automatically from each conversation." />
      </div>

      {topics.length > 0 ? (
        <div className="mt-4 -ml-1 flex flex-wrap gap-2">
          {topics.map((topic) => (
            <span
              key={topic.code}
              className="inline-flex rounded-full px-3 py-1.5 text-xs font-medium transition-colors bg-primary/10 text-primary ring-1 ring-primary/30"
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
