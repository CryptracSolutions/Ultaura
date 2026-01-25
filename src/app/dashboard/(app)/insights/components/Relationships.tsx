import { DateTime } from 'luxon';
import type { RelationshipRow } from '~/lib/ultaura/types';

interface RelationshipsProps {
  relationships: RelationshipRow[];
  timezone: string;
}

function formatLastMentioned(value: string | null, timezone: string): string {
  if (!value) return 'Not recent';
  const date = DateTime.fromISO(value).setZone(timezone);
  return date.isValid ? date.toFormat('MMM d, yyyy') : value;
}

export function Relationships({ relationships, timezone }: RelationshipsProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Relationships</h3>
        <span className="text-xs text-muted-foreground">Mention tracking</span>
      </div>

      {relationships.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No relationships recorded yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {relationships.map((relationship) => (
            <div
              key={relationship.id}
              className="rounded-lg border border-border/60 bg-muted/20 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {relationship.name}
                    {relationship.nickname ? ` ("${relationship.nickname}")` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {relationship.relation_role} - {relationship.relation_type}
                  </p>
                </div>
                {relationship.is_deceased ? (
                  <span className="text-xs text-destructive">Deceased</span>
                ) : null}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>Contact: {relationship.contact_frequency ?? 'unknown'}</span>
                <span>Sentiment: {relationship.sentiment ?? 'neutral'}</span>
                <span>Mentions: {relationship.times_mentioned ?? 0}</span>
                <span>Last mentioned {formatLastMentioned(relationship.last_mentioned_at, timezone)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
