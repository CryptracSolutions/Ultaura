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
        <div className="mt-4 divide-y divide-border/40">
          {relationships.map((relationship) => (
            <div
              key={relationship.id}
              className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {relationship.name}
                    {relationship.nickname && (
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        &ldquo;{relationship.nickname}&rdquo;
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Last mentioned{' '}
                    {formatLastMentioned(relationship.last_mentioned_at, timezone)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {relationship.is_deceased && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                    Deceased
                  </span>
                )}
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {relationship.relation_role}
                </span>
                {relationship.contact_frequency && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {relationship.contact_frequency}
                  </span>
                )}
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  {relationship.times_mentioned ?? 0} mentions
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
