'use client';

import type { RelationshipRow } from '~/lib/ultaura/types';
import { Relationships } from '../../components/Relationships';
import { TierGateNotice, type TierAccess } from './shared';

interface RelationshipsTabContentProps {
  relationships: RelationshipRow[];
  timezone: string;
  tierAccess: TierAccess;
}

export function RelationshipsTabContent({
  relationships,
  timezone,
  tierAccess,
}: RelationshipsTabContentProps) {
  const { allowConcerns, lineName } = tierAccess;

  if (!allowConcerns) {
    return (
      <div className="space-y-6">
        <TierGateNotice title="Relationships" requiredTier="tier_4" lineName={lineName} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Relationships relationships={relationships} timezone={timezone} />
    </div>
  );
}
