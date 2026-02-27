import { DateTime } from 'luxon';
import { MessageCircle } from 'lucide-react';
import { InfoTip } from '~/core/ui/InfoTip';
import type { ConversationHighlightsData } from '~/lib/ultaura/types';

interface ConversationHighlightsProps {
  data: ConversationHighlightsData;
  timezone: string;
  showMood?: boolean;
  showTopics?: boolean;
  showMemoryKeys?: boolean;
  showMilestones?: boolean;
}

export function ConversationHighlights({
  data,
  timezone,
  showMood = true,
  showTopics = true,
  showMemoryKeys = true,
  showMilestones = true,
}: ConversationHighlightsProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <MessageCircle className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Conversation Highlights</h3>
        <InfoTip content="A per-call summary of topics discussed, new memories added, and milestones mentioned. Drawn from recent calls." />
      </div>

      {data.highlights.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No conversation highlights yet.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {data.highlights.map((highlight) => {
            const dateLabel = DateTime.fromISO(highlight.occurredAt).setZone(timezone).toFormat('MMM d, yyyy');
            return (
              <div
                key={highlight.callSessionId}
                className="min-h-12 rounded-xl border border-border/60 border-l-4 px-4 py-3.5"
                style={{ borderLeftColor: 'var(--primary)' }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{dateLabel}</p>
                </div>

                <div className="mt-3 space-y-2 text-sm">
                  {showTopics ? (
                    <div>
                      <p className="text-xs text-muted-foreground">Topics discussed</p>
                      <p className="text-sm text-foreground">
                        {highlight.topics.length ? highlight.topics.join(', ') : 'General conversation'}
                      </p>
                    </div>
                  ) : null}

                  {showMemoryKeys ? (
                    <div>
                      <p className="text-xs text-muted-foreground">New memories (keys only)</p>
                      <p className="text-sm text-foreground">
                        {highlight.newMemoryKeys.length ? highlight.newMemoryKeys.join(', ') : 'No new memories'}
                      </p>
                    </div>
                  ) : null}

                  {showMilestones ? (
                    <div>
                      <p className="text-xs text-muted-foreground">Milestones mentioned</p>
                      <p className="text-sm text-foreground">
                        {highlight.milestones.length ? highlight.milestones.join(', ') : 'None mentioned'}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
