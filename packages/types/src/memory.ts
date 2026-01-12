export type MemoryType =
  | 'fact'
  | 'preference'
  | 'follow_up'
  | 'context'
  | 'history'
  | 'wellbeing'
  | 'relationship'
  | 'temporal'
  | 'routine';

export type ExclusionCategory =
  | 'health_medical'
  | 'family_relationships'
  | 'finances'
  | 'location_address';

export interface RelationshipMemoryValue {
  name: string;
  role: string;
  contactFrequency?: 'daily' | 'weekly' | 'monthly' | 'rarely';
  topicsDiscussed?: string[];
  lastMentioned?: string;
  sentiment?: 'positive' | 'neutral' | 'complicated';
  notes?: string;
}

export interface TemporalMemoryValue {
  description: string;
  expectedEndDate: string;
  durationEstimateWeeks?: number;
  context?: string;
  reviewBeforeArchive: boolean;
}

export interface RoutineMemoryValue {
  description: string;
  level: 'general' | 'time_specific' | 'day_specific';
  timeOfDay?: string;
  daysOfWeek?: number[];
  frequency?: 'daily' | 'weekly' | 'occasional';
  proactivePrompt?: string;
}
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
  lastAccessedAt?: string | null;
  accessCount?: number | null;
  pinned?: boolean;
  pinnedReason?: string | null;
  excludedCategory?: ExclusionCategory | null;
  embeddingPending?: boolean;
  expectedEndDate?: string | null;
  expiryPending?: boolean;
}
