export type {
  AccountStatus,
  PlanId,
  SafetyTier,
  PrivacyScope,
  MemoryType,
} from '@ultaura/types';

export type ReminderDeliveryMethod = 'outbound_call' | 'sms';
export type VoicemailBehavior = 'none' | 'brief' | 'detailed';
export type LineStatus = 'active' | 'paused' | 'disabled';
