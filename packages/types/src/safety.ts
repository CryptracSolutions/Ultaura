export type SafetyTier = 'low' | 'medium' | 'high';
export type SafetyActionTaken = 'none' | 'suggested_988' | 'suggested_911' | 'notified_contact' | 'transferred_call';

export type SafetyCategory =
  | 'SUICIDAL_IDEATION'
  | 'SELF_HARM'
  | 'HOPELESSNESS'
  | 'ISOLATION_DISTRESS'
  | 'PHYSICAL_DANGER'
  | 'MEDICAL_EMERGENCY'
  | 'ABUSE_CONCERN'
  | 'COGNITIVE_DECLINE'
  | 'GENERAL_CONCERN';

export const SAFETY_CATEGORY_TIERS: Record<SafetyCategory, SafetyTier | null> = {
  SUICIDAL_IDEATION: 'high',
  SELF_HARM: 'high',
  HOPELESSNESS: 'medium',
  ISOLATION_DISTRESS: 'low',
  PHYSICAL_DANGER: 'high',
  MEDICAL_EMERGENCY: 'high',
  ABUSE_CONCERN: 'high',
  COGNITIVE_DECLINE: 'low',
  GENERAL_CONCERN: null,
};

export interface SafetyMatch {
  tier: SafetyTier;
  matchedKeyword: string;
}

export interface SafetySignals {
  source: 'model' | 'keyword_backstop' | 'sweep' | 'soft_signal';
  verifier_result?: 'confirm' | 'clear' | 'uncertain';
  verifier_latency_ms?: number;
  imminent_risk?: boolean;
  has_plan_or_means?: boolean;
  rationale_codes?: string[];
  context_window_stats?: {
    turns: number;
    chars: number;
  };
}
