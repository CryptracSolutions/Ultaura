'use client';

import type { MemoryActivityData } from '~/lib/ultaura/types';
import { MemoryActivity } from '../../components/MemoryActivity';
import { TierGateNotice, type TierAccess } from './shared';

interface MemoryTabContentProps {
  memoryActivity: MemoryActivityData | null;
  timezone: string;
  tierAccess: TierAccess;
}

export function MemoryTabContent({
  memoryActivity,
  timezone,
  tierAccess,
}: MemoryTabContentProps) {
  const { allowConcerns, lineName } = tierAccess;

  if (!allowConcerns) {
    return (
      <div className="space-y-6">
        <TierGateNotice title="Memory activity" requiredTier="tier_4" lineName={lineName} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {memoryActivity ? (
        <MemoryActivity data={memoryActivity} timezone={timezone} />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground">Memory Activity</h3>
          <p className="mt-3 text-sm text-muted-foreground">No memory activity available yet.</p>
        </div>
      )}
    </div>
  );
}
