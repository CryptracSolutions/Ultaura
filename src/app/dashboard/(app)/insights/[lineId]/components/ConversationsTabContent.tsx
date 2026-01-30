'use client';

import type { InsightsDashboard, ConversationHighlightsData } from '~/lib/ultaura/types';
import { TopicsChart } from '../../components/TopicsChart';
import { ConversationHighlights } from '../../components/ConversationHighlights';
import { TierGateNotice, type TierAccess } from './shared';

interface ConversationsTabContentProps {
  dashboard: InsightsDashboard | null;
  conversationHighlights: ConversationHighlightsData | null;
  timezone: string;
  tierAccess: TierAccess;
}

export function ConversationsTabContent({
  dashboard,
  conversationHighlights,
  timezone,
  tierAccess,
}: ConversationsTabContentProps) {
  const { isFamilyManaged, allowTopics, allowConcerns, allowMood, lineName } = tierAccess;

  if (!allowTopics) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Conversation highlights and topics from recent calls.
        </p>
        <TierGateNotice title="Topics discussed" requiredTier="tier_3" lineName={lineName} />
        <TierGateNotice title="Conversation highlights" requiredTier="tier_3" lineName={lineName} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Conversation highlights and topics from recent calls.
      </p>
      {/* Topics Chart */}
      {dashboard && <TopicsChart topics={dashboard.topics} />}

      {/* Conversation Highlights */}
      {conversationHighlights ? (
        <ConversationHighlights
          data={conversationHighlights}
          timezone={timezone}
          showMemoryKeys={allowConcerns && !isFamilyManaged}
          showMilestones={allowConcerns && !isFamilyManaged}
          showMood={allowMood}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground">Conversation Highlights</h3>
          <p className="mt-3 text-sm text-muted-foreground">No conversation highlights available yet.</p>
        </div>
      )}

      {/* Fallback when no dashboard */}
      {!dashboard && !conversationHighlights && (
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            No conversation data available yet.
          </p>
        </div>
      )}
    </div>
  );
}
