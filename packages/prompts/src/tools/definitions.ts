import type { GrokTool } from '@ultaura/types';

export const GROK_TOOLS: GrokTool[] = [
  { type: 'web_search' },
  {
    type: 'function',
    name: 'set_reminder',
    description: `Set a reminder for the user. Supports one-time and recurring reminders.

For recurring reminders, parse natural language like:
- "every day at 9am" -> is_recurring: true, frequency: "daily"
- "every 3 days" -> is_recurring: true, frequency: "custom", interval: 3
- "every Monday and Friday at 2pm" -> is_recurring: true, frequency: "weekly", days_of_week: [1, 5]
- "on the 15th of every month" -> is_recurring: true, frequency: "monthly", day_of_month: 15
- "remind me daily about medication" -> is_recurring: true, frequency: "daily"
- "every week on Tuesday until next month" -> is_recurring: true, frequency: "weekly", days_of_week: [2], ends_at_local: date`,
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The reminder message',
        },
        due_at_local: {
          type: 'string',
          description: 'First occurrence: ISO 8601 format in user\'s local time (e.g., 2025-12-27T14:00:00)',
        },
        is_recurring: {
          type: 'boolean',
          description: 'Whether this reminder repeats. Default false for one-time reminders.',
        },
        frequency: {
          type: 'string',
          enum: ['daily', 'weekly', 'monthly', 'custom'],
          description: 'How often the reminder repeats. Required if is_recurring is true.',
        },
        interval: {
          type: 'integer',
          description: 'For custom frequency: repeat every N days. Default 1.',
          minimum: 1,
          maximum: 365,
        },
        days_of_week: {
          type: 'array',
          items: { type: 'integer', minimum: 0, maximum: 6 },
          description: 'For weekly: days of week (0=Sunday, 1=Monday, ..., 6=Saturday)',
        },
        day_of_month: {
          type: 'integer',
          description: 'For monthly: day of month (1-31)',
          minimum: 1,
          maximum: 31,
        },
        ends_at_local: {
          type: 'string',
          description: 'Optional: ISO 8601 date when recurrence ends',
        },
      },
      required: ['message', 'due_at_local'],
    },
  },
  {
    type: 'function',
    name: 'schedule_call',
    description: 'Update the call schedule for the user',
    parameters: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['one_off', 'update_recurring'],
          description: 'Whether to schedule a one-time call or update recurring schedule',
        },
        when: {
          type: 'string',
          description: 'For one_off: ISO 8601 timestamp of when to call',
        },
        days_of_week: {
          type: 'array',
          items: { type: 'integer', minimum: 0, maximum: 6 },
          description: 'For update_recurring: Days of week (0=Sunday, 6=Saturday)',
        },
        time_local: {
          type: 'string',
          description: 'For update_recurring: Time in HH:mm format',
        },
      },
      required: ['mode'],
    },
  },
  {
    type: 'function',
    name: 'choose_overage_action',
    description: 'Record the user decision when asked about overage charges or trial expiration',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['continue', 'upgrade', 'stop'],
          description: 'The user choice after the overage or trial prompt',
        },
        plan_id: {
          type: 'string',
          enum: ['care', 'comfort', 'family', 'payg'],
          description: 'Required when action is upgrade',
        },
      },
      required: ['action'],
    },
  },
  {
    type: 'function',
    name: 'request_opt_out',
    description: 'User has requested to stop receiving calls. Call this when the user says things like "stop calling me", "don\'t call anymore", "unsubscribe", or similar phrases.',
    parameters: {
      type: 'object',
      properties: {
        confirmed: {
          type: 'boolean',
          description: 'Whether the user confirmed they want to opt out',
        },
      },
      required: ['confirmed'],
    },
  },
  {
    type: 'function',
    name: 'forget_memory',
    description: 'User wants to forget something they previously shared. Call this when user says "forget that", "never mind", "don\'t remember that", etc.',
    parameters: {
      type: 'object',
      properties: {
        what_to_forget: {
          type: 'string',
          description: 'Brief description of what to forget',
        },
      },
      required: ['what_to_forget'],
    },
  },
  {
    type: 'function',
    name: 'store_memory',
    description: `Store something important about the user to remember in future calls.
Call this PROACTIVELY when the user shares personal information. Examples:
- "My name is..." or "Call me..."
- "I have three grandchildren"
- "I love gardening" or "I enjoy..."
- "I used to be a teacher"
- "My daughter visits on Sundays"
- "I have a doctor appointment next week"

Do NOT confirm storage verbally - just store silently and continue conversation naturally.`,
    parameters: {
      type: 'object',
      properties: {
        memory_type: {
          type: 'string',
          enum: ['fact', 'preference', 'follow_up', 'context', 'history', 'wellbeing'],
          description: `Type of memory:
- fact: Personal info (name, family, pets, location)
- preference: Likes/dislikes, interests
- follow_up: Things to ask about later
- context: Living situation, environment
- history: Past experiences, life stories
- wellbeing: Wellness observations (energy, mood)`,
        },
        key: {
          type: 'string',
          description: 'Semantic key for the memory (e.g., "preferred_name", "favorite_hobby", "upcoming_surgery")',
        },
        value: {
          type: 'string',
          description: 'The memory content to store',
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Confidence level (0-1). Use lower values for inferred information.',
        },
        suggest_reminder: {
          type: 'boolean',
          description: 'For follow_up type: should we suggest creating a reminder for this?',
        },
      },
      required: ['memory_type', 'key', 'value'],
    },
  },
  {
    type: 'function',
    name: 'update_memory',
    description: `Update an existing memory when the user provides new or corrected information.
Use this when:
- User corrects previous info: "Actually, I have FOUR grandchildren, not three"
- Information has changed: "I moved to a new apartment"
- Adding to existing memory: "I also like jazz, not just classical"

Do NOT confirm the update verbally - just update silently and continue.`,
    parameters: {
      type: 'object',
      properties: {
        existing_key: {
          type: 'string',
          description: 'The key of the existing memory to update',
        },
        new_value: {
          type: 'string',
          description: 'The updated memory content',
        },
        memory_type: {
          type: 'string',
          enum: ['fact', 'preference', 'follow_up', 'context', 'history', 'wellbeing'],
          description: 'Type to use if creating new memory (when key not found). Defaults to fact.',
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Confidence in the update (0-1)',
        },
      },
      required: ['existing_key', 'new_value'],
    },
  },
  {
    type: 'function',
    name: 'mark_private',
    description: 'User wants to keep something private from their family. Call when user says "don\'t tell my family", "keep this between us", "this is private", etc.',
    parameters: {
      type: 'object',
      properties: {
        what_to_keep_private: {
          type: 'string',
          description: 'Brief description of what to keep private',
        },
      },
      required: ['what_to_keep_private'],
    },
  },
  {
    type: 'function',
    name: 'log_safety_concern',
    description: `Log when you detect genuine safety concerns during the conversation.

WHEN TO CALL:
- tier: 'high' -> User mentions suicide, self-harm, or wanting to die. Action: suggested_988 or suggested_911
- tier: 'medium' -> User expresses hopelessness, despair, or "giving up". Action: none or suggested_988
- tier: 'low' -> User seems persistently sad, lonely, or isolated. Action: none

IMPORTANT: Call this tool AFTER providing an empathetic response, not before.

DO NOT call for normal sadness, missing loved ones, or everyday frustrations.`,
    parameters: {
      type: 'object',
      properties: {
        tier: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Severity: low=persistent sadness, medium=hopelessness/despair, high=self-harm ideation',
        },
        signals: {
          type: 'string',
          description: 'Brief summary of what concerned you (e.g., "expressed feeling hopeless about the future")',
        },
        action_taken: {
          type: 'string',
          enum: ['none', 'suggested_988', 'suggested_911'],
          description: 'What action you recommended to the user',
        },
      },
      required: ['tier', 'signals', 'action_taken'],
    },
  },
  // Reminder management tools
  {
    type: 'function',
    name: 'list_reminders',
    description: 'List the user\'s upcoming reminders. Call this when they ask "what reminders do I have?", "show me my reminders", etc.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    type: 'function',
    name: 'edit_reminder',
    description: 'Edit an existing reminder. Can change the message or time. Call when user says "change my reminder", "update the medication reminder", etc.',
    parameters: {
      type: 'object',
      properties: {
        reminder_id: {
          type: 'string',
          description: 'The ID of the reminder to edit (from list_reminders)',
        },
        new_message: {
          type: 'string',
          description: 'New reminder message (optional)',
        },
        new_time_local: {
          type: 'string',
          description: 'New time in ISO 8601 format in user\'s local time (optional)',
        },
      },
      required: ['reminder_id'],
    },
  },
  {
    type: 'function',
    name: 'pause_reminder',
    description: 'Pause a reminder so it stops firing until resumed. Call when user says "pause my reminder", "stop the medication reminder for now", etc.',
    parameters: {
      type: 'object',
      properties: {
        reminder_id: {
          type: 'string',
          description: 'The ID of the reminder to pause',
        },
      },
      required: ['reminder_id'],
    },
  },
  {
    type: 'function',
    name: 'resume_reminder',
    description: 'Resume a paused reminder. Call when user says "start my reminder again", "unpause the medication reminder", etc.',
    parameters: {
      type: 'object',
      properties: {
        reminder_id: {
          type: 'string',
          description: 'The ID of the reminder to resume',
        },
      },
      required: ['reminder_id'],
    },
  },
  {
    type: 'function',
    name: 'snooze_reminder',
    description: 'Snooze a reminder for a specified duration. Best used during a reminder call when user says "remind me later", "snooze for an hour", etc.',
    parameters: {
      type: 'object',
      properties: {
        reminder_id: {
          type: 'string',
          description: 'The ID of the reminder to snooze (optional if this is a reminder call)',
        },
        snooze_minutes: {
          type: 'integer',
          enum: [15, 30, 60, 120, 1440],
          description: 'How long to snooze: 15 (15 min), 30 (30 min), 60 (1 hour), 120 (2 hours), or 1440 (tomorrow)',
        },
      },
      required: ['snooze_minutes'],
    },
  },
  {
    type: 'function',
    name: 'cancel_reminder',
    description: 'Cancel a reminder completely. For recurring reminders, this cancels the entire series. Call when user says "delete my reminder", "cancel the appointment reminder", etc.',
    parameters: {
      type: 'object',
      properties: {
        reminder_id: {
          type: 'string',
          description: 'The ID of the reminder to cancel',
        },
      },
      required: ['reminder_id'],
    },
  },
  {
    type: 'function',
    name: 'request_upgrade',
    description: 'User wants to upgrade their plan or learn about plan options. Call when user says "I want to upgrade", "can I get more minutes", "tell me about your plans", "what plans do you have", or similar.',
    parameters: {
      type: 'object',
      properties: {
        plan_id: {
          type: 'string',
          enum: ['care', 'comfort', 'family', 'payg'],
          description: 'The plan to upgrade to. If not specified, explain all plans first and ask which they prefer.',
        },
        send_link: {
          type: 'boolean',
          description: 'Set to true after user confirms their plan choice to send the checkout link via text message.',
        },
      },
      required: [],
    },
  },
];
