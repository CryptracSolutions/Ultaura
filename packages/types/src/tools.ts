import type { MemoryType } from './memory.js';
import type { SafetyTier } from './safety.js';

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
  mode: 'one_off' | 'update_recurring';
  when?: string;
  days_of_week?: number[];
  time_local?: string;
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

export interface MarkPrivateArgs {
  what_to_keep_private: string;
}

export interface LogSafetyConcernArgs {
  tier: SafetyTier;
  signals: string;
  action_taken: 'none' | 'suggested_988' | 'suggested_911';
}

export interface ListRemindersArgs {}

export interface EditReminderArgs {
  reminder_id: string;
  new_message?: string;
  new_time_local?: string;
}

export interface PauseReminderArgs {
  reminder_id: string;
}

export interface ResumeReminderArgs {
  reminder_id: string;
}

export interface SnoozeReminderArgs {
  reminder_id?: string;
  snooze_minutes: 15 | 30 | 60 | 120 | 1440;
}

export interface CancelReminderArgs {
  reminder_id: string;
}

export interface RequestUpgradeArgs {
  plan_id?: UpgradePlanId;
  send_link?: boolean;
}

export type ToolCallArgs =
  | { name: 'set_reminder'; args: SetReminderArgs }
  | { name: 'schedule_call'; args: ScheduleCallArgs }
  | { name: 'choose_overage_action'; args: ChooseOverageActionArgs }
  | { name: 'request_opt_out'; args: RequestOptOutArgs }
  | { name: 'forget_memory'; args: ForgetMemoryArgs }
  | { name: 'store_memory'; args: StoreMemoryArgs }
  | { name: 'update_memory'; args: UpdateMemoryArgs }
  | { name: 'mark_private'; args: MarkPrivateArgs }
  | { name: 'log_safety_concern'; args: LogSafetyConcernArgs }
  | { name: 'list_reminders'; args: ListRemindersArgs }
  | { name: 'edit_reminder'; args: EditReminderArgs }
  | { name: 'pause_reminder'; args: PauseReminderArgs }
  | { name: 'resume_reminder'; args: ResumeReminderArgs }
  | { name: 'snooze_reminder'; args: SnoozeReminderArgs }
  | { name: 'cancel_reminder'; args: CancelReminderArgs }
  | { name: 'request_upgrade'; args: RequestUpgradeArgs };
