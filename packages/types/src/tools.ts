import type { MemoryType } from './memory.js';
import type { SafetyTier } from './safety.js';
import type { TopicCode, ConcernCode, FollowUpReasonCode } from './insights.js';

export interface GrokTool {
  type: 'web_search' | 'function';
  name?: string;
  description?: string;
  parameters?: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export type AccountStatus = 'trial' | 'active' | 'past_due' | 'canceled';
export type PlanId = 'free_trial' | 'care' | 'comfort' | 'family' | 'payg';
export type UpgradePlanId = 'care' | 'comfort' | 'family' | 'payg';

export interface SetReminderArgs {
  message: string;
  due_at_local: string;
  is_recurring?: boolean;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval?: number;
  days_of_week?: number[];
  day_of_month?: number;
  ends_at_local?: string;
}

export interface ScheduleCallArgs {
  mode: 'update_recurring';
  days_of_week: number[];
  time_local: string;
}

export interface StoreCallPreviewArgs {
  topic_type: 'memory_follow_up' | 'web_search' | 'segment' | 'free_form';
  topic_key: string;
  topic_display: string;
  segment_type?: 'trivia' | 'story' | 'learning';
  segment_context?: Record<string, unknown>;
}

export interface MarkPreviewOutcomeArgs {
  outcome: 'engaged' | 'declined' | 'redirected';
  preview_id?: string;
}

export interface LogSegmentEngagementArgs {
  segment_type: 'trivia' | 'story' | 'learning' | 'memory_lane';
  segment_domain?: string;
  segment_context?: Record<string, unknown>;
  engagement_signals?: Record<string, unknown>;
  duration_seconds?: number;
  completed?: boolean;
  senior_response: 'enjoyed' | 'neutral' | 'declined' | 'interrupted';
  story_arc_id?: string;
  chapter_completed?: number;
}

export interface ManageStoryArcArgs {
  action: 'create' | 'update' | 'complete' | 'abandon';
  story_arc_id?: string;
  story_type?: 'serial' | 'learning_journey';
  title?: string;
  description?: string;
  total_chapters?: number;
  chapter_completed?: number;
  story_state?: Record<string, unknown>;
}

export interface ChooseOverageActionArgs {
  action: 'continue' | 'upgrade' | 'stop';
  plan_id?: UpgradePlanId;
}

export interface RequestOptOutArgs {
  confirmed: boolean;
}

export interface ForgetMemoryArgs {
  what_to_forget: string;
}

export interface StoreMemoryArgs {
  memory_type: MemoryType;
  key: string;
  value: string;
  confidence?: number;
  suggest_reminder?: boolean;
}

export interface UpdateMemoryArgs {
  existing_key: string;
  new_value: string;
  memory_type?: MemoryType;
  confidence?: number;
}

export type GrantMemoryConsentArgs = Record<string, never>;

export type DenyMemoryConsentArgs = Record<string, never>;

export interface MarkPrivateArgs {
  what_to_keep_private: string;
}

export interface LogSafetyConcernArgs {
  tier: SafetyTier;
  signals: string;
  action_taken: 'none' | 'suggested_988' | 'suggested_911';
}

export interface ReportConversationLanguageArgs {
  language_code: string;
}

export type ListRemindersArgs = Record<string, never>;

export interface EditReminderArgs {
  reminder_id: string;
  new_message?: string;
  new_time_local?: string;
}

export interface ReminderIdArgs {
  reminder_id: string;
}

export type PauseReminderArgs = ReminderIdArgs;

export type ResumeReminderArgs = ReminderIdArgs;

export interface SnoozeReminderArgs {
  reminder_id?: string;
  snooze_minutes: 15 | 30 | 60 | 120 | 1440;
}

export type CancelReminderArgs = ReminderIdArgs;

export interface RequestUpgradeArgs {
  plan_id?: UpgradePlanId;
  send_link?: boolean;
}

export interface LogCallInsightsArgs {
  mood_overall: 'positive' | 'neutral' | 'low';
  mood_intensity: number;
  engagement_score: number;
  social_need_level: number;
  topics: Array<{
    code: TopicCode;
    weight: number;
  }>;
  private_topics?: TopicCode[];
  concerns?: Array<{
    code: ConcernCode;
    severity: number;
    confidence: number;
    is_novel?: boolean;
  }>;
  needs_follow_up: boolean;
  follow_up_reasons?: FollowUpReasonCode[];
  confidence_overall: number;
}

export interface SetPauseModeArgs {
  enabled: boolean;
  reason?: string;
}

export interface MarkTopicPrivateArgs {
  topic_code: TopicCode;
}

export type ToolCallArgs =
  | { name: 'set_reminder'; args: SetReminderArgs }
  | { name: 'schedule_call'; args: ScheduleCallArgs }
  | { name: 'store_call_preview'; args: StoreCallPreviewArgs }
  | { name: 'mark_preview_outcome'; args: MarkPreviewOutcomeArgs }
  | { name: 'log_segment_engagement'; args: LogSegmentEngagementArgs }
  | { name: 'manage_story_arc'; args: ManageStoryArcArgs }
  | { name: 'choose_overage_action'; args: ChooseOverageActionArgs }
  | { name: 'request_opt_out'; args: RequestOptOutArgs }
  | { name: 'forget_memory'; args: ForgetMemoryArgs }
  | { name: 'store_memory'; args: StoreMemoryArgs }
  | { name: 'update_memory'; args: UpdateMemoryArgs }
  | { name: 'grant_memory_consent'; args: GrantMemoryConsentArgs }
  | { name: 'deny_memory_consent'; args: DenyMemoryConsentArgs }
  | { name: 'mark_private'; args: MarkPrivateArgs }
  | { name: 'log_safety_concern'; args: LogSafetyConcernArgs }
  | { name: 'report_conversation_language'; args: ReportConversationLanguageArgs }
  | { name: 'list_reminders'; args: ListRemindersArgs }
  | { name: 'edit_reminder'; args: EditReminderArgs }
  | { name: 'pause_reminder'; args: PauseReminderArgs }
  | { name: 'resume_reminder'; args: ResumeReminderArgs }
  | { name: 'snooze_reminder'; args: SnoozeReminderArgs }
  | { name: 'cancel_reminder'; args: CancelReminderArgs }
  | { name: 'request_upgrade'; args: RequestUpgradeArgs }
  | { name: 'log_call_insights'; args: LogCallInsightsArgs }
  | { name: 'set_pause_mode'; args: SetPauseModeArgs }
  | { name: 'mark_topic_private'; args: MarkTopicPrivateArgs };
