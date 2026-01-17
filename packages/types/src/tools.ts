import type {
  MemoryType,
  LifeStoryMemoryValue,
  RelationshipMemoryValue,
  TemporalMemoryValue,
  RoutineMemoryValue,
  ExclusionCategory,
} from './memory.js';
import type { SafetyCategory, SafetyTier } from './safety.js';
import type { TopicCode, ConcernCode, FollowUpReasonCode } from './insights.js';
import type { SharingTier } from './privacy.js';

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

export interface SkipScheduleArgs {
  schedule_id?: string;
}

export interface SnoozeScheduleArgs {
  schedule_id?: string;
  snooze_minutes: number;
}

export interface RescheduleScheduleArgs {
  schedule_id?: string;
  new_datetime_local: string;
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
  permanent?: boolean;
  confirmed?: boolean;
  clarification?: string;
}

export interface StoreMemoryArgs {
  memory_type: MemoryType;
  key: string;
  value: string | LifeStoryMemoryValue | RelationshipMemoryValue | TemporalMemoryValue | RoutineMemoryValue;
  confidence?: number;
  suggest_reminder?: boolean;
  expected_end_date?: string;
  routine_level?: 'general' | 'time_specific' | 'day_specific';
}

export interface UpdateMemoryArgs {
  existing_key: string;
  new_value: string | LifeStoryMemoryValue | RelationshipMemoryValue | TemporalMemoryValue | RoutineMemoryValue;
  memory_type?: MemoryType;
  confidence?: number;
  confirmed?: boolean;
  clarification?: string;
}

export type GrantMemoryConsentArgs = Record<string, never>;

export type DenyMemoryConsentArgs = Record<string, never>;

export type GrantRecordingConsentArgs = Record<string, never>;

export type DenyRecordingConsentArgs = Record<string, never>;

export type RevokeRecordingConsentArgs = Record<string, never>;

export interface SetRecordingPreferencePermanentArgs {
  never_ask: boolean;
}

export interface SetSharingTierArgs {
  tier: SharingTier;
  consent?: 'granted' | 'denied';
}

export type GetSharingTierArgs = Record<string, never>;

export type EnableFamilySharingArgs = Record<string, never>;

export interface MarkPrivateArgs {
  what_to_keep_private: string;
  confirmed?: boolean;
  clarification?: string;
}

export interface ExcludeMemoryTopicArgs {
  category: ExclusionCategory;
}

export interface IncludeMemoryTopicArgs {
  category: ExclusionCategory;
}

export type ListTopicExclusionsArgs = Record<string, never>;

export interface ReviewMemoriesArgs {
  category?: string;
}

export interface LogSafetyConcernArgs {
  category: SafetyCategory;
  tier?: SafetyTier;
  confidence: number;
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

export interface StoreLifeChapterArgs {
  chapter_type: 'childhood' | 'education' | 'career' | 'marriage' | 'parenting' | 'military' | 'travel' | 'retirement' | 'accomplishment' | 'loss' | 'other';
  title: string;
  era_start_year?: number;
  era_end_year?: number;
  narrative_summary: string;
  key_people?: string[];
  emotional_tone?: 'joyful' | 'proud' | 'bittersweet' | 'difficult' | 'neutral';
}

export interface LogMoodSnapshotArgs {
  mood_start: 'positive' | 'neutral' | 'low' | 'anxious' | 'sad' | 'frustrated';
  mood_mid?: 'positive' | 'neutral' | 'low' | 'anxious' | 'sad' | 'frustrated';
  mood_end: 'positive' | 'neutral' | 'low' | 'anxious' | 'sad' | 'frustrated';
  mood_trajectory: 'improved' | 'declined' | 'stable';
  techniques_used?: string[];
  energy_level: 'high' | 'normal' | 'low' | 'very_low';
}

export interface UpdateContentPreferenceArgs {
  content_type: 'trivia' | 'story' | 'memory_lane' | 'brain_games';
  preference_change: 'increase' | 'decrease';
  specific_update?: Record<string, unknown>;
}

export interface UpdateRelationshipArgs {
  name: string;
  updates: {
    nickname?: string;
    contact_frequency?: string;
    sentiment?: string;
    recent_topic?: string;
    location?: string;
    shared_activity?: string;
  };
}

export interface MarkRelationshipDeceasedArgs {
  name: string;
  passed_at?: string;
  grief_sensitivity?: 'high' | 'medium' | 'low';
}

export interface LogCognitiveObservationArgs {
  observation_type: 'confusion' | 'repetition' | 'word_finding' | 'orientation' | 'memory_lapse';
  severity: 'mild' | 'moderate' | 'significant';
  context?: string;
  response_given?: string;
}

export interface AdjustAccessibilityArgs {
  setting: 'speech_rate' | 'hearing_mode' | 'cognitive_mode';
  value: string;
  source?: 'senior_request' | 'ai_detected';
}

export interface StoreMilestoneArgs {
  milestone_type: 'birthday' | 'anniversary' | 'memorial' | 'achievement' | 'holiday' | 'custom';
  title: string;
  date_month: number;
  date_day: number;
  date_year?: number;
  related_person_name?: string;
  is_recurring?: boolean;
}

export interface MarkMilestoneCelebratedArgs {
  milestone_id?: string;
  milestone_title?: string;
}

export interface LogHealthMentionArgs {
  category: 'pain' | 'medication' | 'appointment' | 'symptom' | 'sleep' | 'appetite' | 'mobility' | 'energy' | 'general';
  summary: string;
  severity?: 'mild' | 'moderate' | 'concerning';
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
  | { name: 'grant_recording_consent'; args: GrantRecordingConsentArgs }
  | { name: 'deny_recording_consent'; args: DenyRecordingConsentArgs }
  | { name: 'revoke_recording_consent'; args: RevokeRecordingConsentArgs }
  | { name: 'set_recording_preference_permanent'; args: SetRecordingPreferencePermanentArgs }
  | { name: 'set_sharing_tier'; args: SetSharingTierArgs }
  | { name: 'get_sharing_tier'; args: GetSharingTierArgs }
  | { name: 'enable_family_sharing'; args: EnableFamilySharingArgs }
  | { name: 'mark_private'; args: MarkPrivateArgs }
  | { name: 'exclude_memory_topic'; args: ExcludeMemoryTopicArgs }
  | { name: 'include_memory_topic'; args: IncludeMemoryTopicArgs }
  | { name: 'list_topic_exclusions'; args: ListTopicExclusionsArgs }
  | { name: 'review_memories'; args: ReviewMemoriesArgs }
  | { name: 'log_safety_concern'; args: LogSafetyConcernArgs }
  | { name: 'report_conversation_language'; args: ReportConversationLanguageArgs }
  | { name: 'list_reminders'; args: ListRemindersArgs }
  | { name: 'edit_reminder'; args: EditReminderArgs }
  | { name: 'pause_reminder'; args: PauseReminderArgs }
  | { name: 'resume_reminder'; args: ResumeReminderArgs }
  | { name: 'snooze_reminder'; args: SnoozeReminderArgs }
  | { name: 'cancel_reminder'; args: CancelReminderArgs }
  | { name: 'request_upgrade'; args: RequestUpgradeArgs }
  | { name: 'store_life_chapter'; args: StoreLifeChapterArgs }
  | { name: 'log_mood_snapshot'; args: LogMoodSnapshotArgs }
  | { name: 'update_content_preference'; args: UpdateContentPreferenceArgs }
  | { name: 'update_relationship'; args: UpdateRelationshipArgs }
  | { name: 'mark_relationship_deceased'; args: MarkRelationshipDeceasedArgs }
  | { name: 'log_cognitive_observation'; args: LogCognitiveObservationArgs }
  | { name: 'adjust_accessibility'; args: AdjustAccessibilityArgs }
  | { name: 'store_milestone'; args: StoreMilestoneArgs }
  | { name: 'mark_milestone_celebrated'; args: MarkMilestoneCelebratedArgs }
  | { name: 'log_health_mention'; args: LogHealthMentionArgs }
  | { name: 'log_call_insights'; args: LogCallInsightsArgs }
  | { name: 'set_pause_mode'; args: SetPauseModeArgs }
  | { name: 'mark_topic_private'; args: MarkTopicPrivateArgs };
