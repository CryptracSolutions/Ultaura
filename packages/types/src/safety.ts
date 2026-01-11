export type SafetyTier = 'low' | 'medium' | 'high';
export type SafetyActionTaken = 'none' | 'suggested_988' | 'suggested_911' | 'notified_contact' | 'transferred_call';

export interface SafetyMatch {
  tier: SafetyTier;
  matchedKeyword: string;
}
