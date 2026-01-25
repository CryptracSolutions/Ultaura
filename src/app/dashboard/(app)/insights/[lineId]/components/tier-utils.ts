// Server-safe utilities for tier access computation
// This file has no 'use client' directive so it can be imported into Server Components

export const SHARING_TIER_LABELS: Record<string, string> = {
  tier_1: 'Basic Updates & Safety',
  tier_2: 'Wellness Check',
  tier_3: 'Full Summary',
  tier_4: 'Complete Visibility',
};

export const TIER_REQUIREMENTS = {
  tier_2: 'Wellness Check sharing level or higher.',
  tier_3: 'Full Summary sharing level or higher.',
  tier_4: 'Complete Visibility sharing level.',
};

export interface TierAccess {
  isFamilyManaged: boolean;
  effectiveTier: string | null | undefined;
  allowMood: boolean;
  allowTopics: boolean;
  allowConcerns: boolean;
  lineName: string;
}

export interface SafetyEvent {
  id: string;
  occurredAt: string;
  severity: 'low' | 'medium' | 'high';
  actionTaken: string | null;
  eventType: string | null;
}

export function computeTierAccess(
  userType: string | null | undefined,
  sharingConsent: string | null | undefined,
  sharingTier: string | null | undefined,
  lineName: string
): TierAccess {
  const isFamilyManaged = userType === 'family_managed';
  const effectiveTier = isFamilyManaged
    ? (sharingConsent === 'granted' ? sharingTier : 'tier_1')
    : null;
  const allowMood = !isFamilyManaged || effectiveTier !== 'tier_1';
  const allowTopics = !isFamilyManaged || effectiveTier === 'tier_3' || effectiveTier === 'tier_4';
  const allowConcerns = !isFamilyManaged || effectiveTier === 'tier_4';

  return {
    isFamilyManaged,
    effectiveTier,
    allowMood,
    allowTopics,
    allowConcerns,
    lineName,
  };
}
