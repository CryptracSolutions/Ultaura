export type MemoryType = 'fact' | 'preference' | 'follow_up' | 'context' | 'history' | 'wellbeing';
export type PrivacyScope = 'line_only' | 'shareable_with_payer';

export interface Memory {
  id: string;
  accountId: string;
  lineId: string;
  createdAt: string;
  updatedAt: string | null;
  type: MemoryType;
  key: string;
  value: unknown;
  confidence: number | null;
  source: 'onboarding' | 'conversation' | 'caregiver_seed' | null;
  version: number;
  active: boolean;
  privacyScope: PrivacyScope;
  redactionLevel: 'none' | 'low' | 'high';
}
