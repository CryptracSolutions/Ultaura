import type { GrokTool } from '@ultaura/types';

const EMPTY_PARAMS = { type: 'object', properties: {}, required: [] as string[] };

const REMINDER_ID_PARAM = {
  reminder_id: { type: 'string', description: 'The ID of the reminder' },
} as const;

const TOPIC_CODES = [
  'family',
  'friends',
  'activities',
  'interests',
  'memories',
  'plans',
  'daily_life',
  'entertainment',
  'feelings',
  'requests',
] as const;

const CONCERN_CODES = [
  'loneliness',
  'sadness',
  'anxiety',
  'sleep',
  'pain',
  'fatigue',
  'appetite',
] as const;

export const GROK_TOOLS: GrokTool[] = [
  { type: 'web_search' },
  {
    type: 'function',
    name: 'store_call_preview',
    description: `Store the senior's choice for the next call topic. Call this at the END of the conversation when they select what they want to discuss next time.

WHEN TO CALL:
- After offering 2-3 topic choices based on conversation or their interests
- When senior expresses interest in a topic for "next time"
- When wrapping up a multi-call story/segment

Topic types:
- memory_follow_up: Continue a personal story they shared
- web_search: News, weather, sports, local events
- segment: Trivia, story, or learning journey
- free_form: General topic of interest`,
    parameters: {
      type: 'object',
      properties: {
        topic_type: {
          type: 'string',
          enum: ['memory_follow_up', 'web_search', 'segment', 'free_form'],
          description: 'Category of the selected topic',
        },
        topic_key: {
          type: 'string',
          description: 'Machine-readable key (e.g., "baseball_news", "lighthouse_story_ch2")',
        },
        topic_display: {
          type: 'string',
          description: 'Human-readable description for confirmation (e.g., "baseball news this week")',
        },
        segment_type: {
          type: 'string',
          enum: ['trivia', 'story', 'learning'],
          description: 'For segment type: which segment format',
        },
        segment_context: {
          type: 'object',
          description: 'Additional context (story chapter, trivia domain, etc.)',
        },
      },
      required: ['topic_type', 'topic_key', 'topic_display'],
    },
  },
  {
    type: 'function',
    name: 'mark_preview_outcome',
    description: `Record how the senior responded to the call preview at the start of the call.
Call this after you reference the preview and they respond.`,
    parameters: {
      type: 'object',
      properties: {
        outcome: {
          type: 'string',
          enum: ['engaged', 'declined', 'redirected'],
          description: 'How they responded to the preview choice',
        },
        preview_id: {
          type: 'string',
          description: 'Optional preview ID if provided in context',
        },
      },
      required: ['outcome'],
    },
  },
  {
    type: 'function',
    name: 'log_segment_engagement',
    description: `Log engagement with a content segment (trivia, story, learning).
Call this when a segment ends or is interrupted.`,
    parameters: {
      type: 'object',
      properties: {
        segment_type: {
          type: 'string',
          enum: ['trivia', 'story', 'learning', 'memory_lane'],
          description: 'Type of segment',
        },
        segment_domain: {
          type: 'string',
          description: 'Topic domain (e.g., "history", "sports", "1960s")',
        },
        segment_context: {
          type: 'object',
          description: 'Segment context (story chapter, trivia topic, etc.)',
        },
        engagement_signals: {
          type: 'object',
          description: 'Engagement signals (e.g., laughs, questions, comments)',
        },
        duration_seconds: {
          type: 'integer',
          description: 'Approximate segment duration',
        },
        completed: {
          type: 'boolean',
          description: 'Whether segment reached natural end',
        },
        senior_response: {
          type: 'string',
          enum: ['enjoyed', 'neutral', 'declined', 'interrupted'],
          description: 'Overall senior reaction',
        },
        story_arc_id: {
          type: 'string',
          description: 'For stories: the arc ID to update progress',
        },
        chapter_completed: {
          type: 'integer',
          description: 'For stories: chapter number just completed',
        },
      },
      required: ['segment_type', 'senior_response'],
    },
  },
  {
    type: 'function',
    name: 'manage_story_arc',
    description: `Create, update, or complete a story arc for multi-call narratives.
Use when starting a new story series or updating progress.`,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'complete', 'abandon'],
          description: 'Action to perform',
        },
        story_arc_id: {
          type: 'string',
          description: 'For update/complete/abandon: existing arc ID',
        },
        story_type: {
          type: 'string',
          enum: ['serial', 'learning_journey'],
          description: 'For create: type of story',
        },
        title: {
          type: 'string',
          description: 'For create: story title',
        },
        description: {
          type: 'string',
          description: 'For create: brief description',
        },
        total_chapters: {
          type: 'integer',
          description: 'For create: planned number of chapters (default 5)',
        },
        chapter_completed: {
          type: 'integer',
          description: 'For update: chapter number just completed',
        },
        story_state: {
          type: 'object',
          description: 'Current state: characters, plot points, cliffhanger',
        },
      },
      required: ['action'],
    },
  },
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
    description: 'Update the recurring weekly call schedule. For one-time calls, use set_reminder instead.',
    parameters: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['update_recurring'],
          description: 'Use update_recurring for weekly schedules',
        },
        days_of_week: {
          type: 'array',
          items: { type: 'integer', minimum: 0, maximum: 6 },
          description: 'Days of week (0=Sunday, 6=Saturday)',
        },
        time_local: {
          type: 'string',
          description: 'Time in HH:mm format',
        },
      },
      required: ['mode', 'days_of_week', 'time_local'],
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
    description: 'User wants to forget something they previously shared. Call this when user says "forget that", "never mind", "don\'t remember that", etc. If they explicitly ask for permanent deletion, confirm and set permanent=true.',
    parameters: {
      type: 'object',
      properties: {
        what_to_forget: {
          type: 'string',
          description: 'Brief description of what to forget',
        },
        permanent: {
          type: 'boolean',
          default: false,
          description: 'Set true only if the user explicitly asks for permanent deletion (confirm first)',
        },
        confirmed: {
          type: 'boolean',
          description: 'Set true only after the user confirms the specific memory to forget',
        },
        clarification: {
          type: 'string',
          description: 'Additional detail if the user says the guess was wrong',
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
          enum: [
            'fact',
            'preference',
            'follow_up',
            'context',
            'history',
            'wellbeing',
            'relationship',
            'temporal',
            'routine',
          ],
          description: `Type of memory:
- fact: Personal info (name, family, pets, location)
- preference: Likes/dislikes, interests
- follow_up: Things to ask about later
- context: Living situation, environment
- history: Past experiences, life stories
- wellbeing: Wellness observations (energy, mood)
- relationship: People and relationships mentioned
- temporal: Time-bound situations with expected end dates
- routine: Daily/weekly routines and habits`,
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
        expected_end_date: {
          type: 'string',
          description: 'For temporal type: ISO date when the situation likely ends',
        },
        routine_level: {
          type: 'string',
          enum: ['general', 'time_specific', 'day_specific'],
          description: 'For routine type: level of timing detail',
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

Do NOT confirm the update verbally - just update silently and continue unless the tool response asks for confirmation.`,
    parameters: {
      type: 'object',
      properties: {
        existing_key: {
          type: 'string',
          description: 'The key of the existing memory to update',
        },
        new_value: {
          type: ['string', 'object'],
          description: 'The updated memory content (string or structured object for relationship/temporal/routine)',
        },
        memory_type: {
          type: 'string',
          enum: [
            'fact',
            'preference',
            'follow_up',
            'context',
            'history',
            'wellbeing',
            'relationship',
            'temporal',
            'routine',
          ],
          description: 'Type to use if creating new memory (when key not found). Defaults to fact.',
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Confidence in the update (0-1)',
        },
        confirmed: {
          type: 'boolean',
          description: 'Set true only after the user confirms the specific memory to update',
        },
        clarification: {
          type: 'string',
          description: 'Additional detail if the user says the guess was wrong',
        },
      },
      required: ['existing_key', 'new_value'],
    },
  },
  {
    type: 'function',
    name: 'grant_memory_consent',
    description: 'Call when the user agrees to have their conversations remembered for personalization.',
    parameters: EMPTY_PARAMS,
  },
  {
    type: 'function',
    name: 'deny_memory_consent',
    description: 'Call when the user declines to have their conversations remembered.',
    parameters: EMPTY_PARAMS,
  },
  {
    type: 'function',
    name: 'exclude_memory_topic',
    description: `Exclude a category of memories from storage. Call when the senior clearly indicates they don't want certain topics remembered.

Examples:
- "Don't remember anything about my medications" -> health_medical
- "Keep my family out of this" -> family_relationships
- "Don't store anything about my money" -> finances
- "Forget where I live" -> location_address

IMPORTANT: This is controlled ONLY by the senior via voice. Ask for confirmation before excluding.`,
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['health_medical', 'family_relationships', 'finances', 'location_address'],
          description: 'Category to exclude from memory storage',
        },
      },
      required: ['category'],
    },
  },
  {
    type: 'function',
    name: 'include_memory_topic',
    description: `Re-enable a previously excluded memory category. Call when the senior explicitly asks to start remembering a topic again.

Example: "You can remember my health stuff now"

This will also restore any previously excluded memories of that type.`,
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['health_medical', 'family_relationships', 'finances', 'location_address'],
          description: 'Category to re-include in memory storage',
        },
      },
      required: ['category'],
    },
  },
  {
    type: 'function',
    name: 'list_topic_exclusions',
    description: 'List current memory topic exclusions for the senior (for AI reference).',
    parameters: EMPTY_PARAMS,
  },
  {
    type: 'function',
    name: 'review_memories',
    description: `Summarize what you remember about the senior. Call when they ask:
- "What do you remember about me?"
- "What do you know about me?"
- "Tell me what you've learned about me"

Return a conversational summary they can listen to.`,
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Optional: focus on a specific area (family, hobbies, routines, etc.)',
        },
      },
      required: [],
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
        confirmed: {
          type: 'boolean',
          description: 'Set true only after the user confirms the specific memory to keep private',
        },
        clarification: {
          type: 'string',
          description: 'Additional detail if the user says the guess was wrong',
        },
      },
      required: ['what_to_keep_private'],
    },
  },
  {
    type: 'function',
    name: 'mark_topic_private',
    description: 'User wants a conversation topic kept private from their family. Call when they say "keep this between us", "don\'t tell my family", "this is private", etc.',
    parameters: {
      type: 'object',
      properties: {
        topic_code: {
          type: 'string',
          enum: TOPIC_CODES,
          description: 'Topic code to mark private',
        },
      },
      required: ['topic_code'],
    },
  },
  {
    type: 'function',
    name: 'set_pause_mode',
    description: 'Enable or disable pause mode when the user is away or traveling. This suppresses alerts but still allows calls.',
    parameters: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          description: 'Whether pause mode should be enabled',
        },
        reason: {
          type: 'string',
          description: 'Optional reason (e.g., traveling, hospital)',
        },
      },
      required: ['enabled'],
    },
  },
  {
    type: 'function',
    name: 'log_call_insights',
    description: 'Record conversation insights for this call. Call this once at the natural end of the conversation.',
    parameters: {
      type: 'object',
      properties: {
        mood_overall: {
          type: 'string',
          enum: ['positive', 'neutral', 'low'],
          description: 'Overall mood for the call',
        },
        mood_intensity: {
          type: 'integer',
          minimum: 0,
          maximum: 3,
          description: 'Mood intensity (0-3)',
        },
        engagement_score: {
          type: 'number',
          minimum: 1,
          maximum: 10,
          description: 'Engagement score (1-10)',
        },
        social_need_level: {
          type: 'integer',
          minimum: 0,
          maximum: 3,
          description: 'Social need level (0-3)',
        },
        topics: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              code: { type: 'string', enum: TOPIC_CODES },
              weight: { type: 'number', minimum: 0, maximum: 1 },
            },
            required: ['code', 'weight'],
          },
        },
        private_topics: {
          type: 'array',
          items: { type: 'string', enum: TOPIC_CODES },
          description: 'Topics to hide for this call only',
        },
        concerns: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              code: { type: 'string', enum: CONCERN_CODES },
              severity: { type: 'integer', minimum: 1, maximum: 3 },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              is_novel: { type: 'boolean', description: 'Whether this concern is newly observed (optional).' },
            },
            required: ['code', 'severity', 'confidence'],
          },
        },
        needs_follow_up: {
          type: 'boolean',
        },
        follow_up_reasons: {
          type: 'array',
          items: {
            type: 'string',
            enum: [...CONCERN_CODES, 'wants_more_contact', 'missed_routine'],
          },
        },
        confidence_overall: {
          type: 'number',
          minimum: 0,
          maximum: 1,
        },
      },
      required: [
        'mood_overall',
        'mood_intensity',
        'engagement_score',
        'social_need_level',
        'topics',
        'needs_follow_up',
        'confidence_overall',
      ],
    },
  },
  {
    type: 'function',
    name: 'log_safety_concern',
    description: `Log when you detect genuine safety concerns during the conversation.

CATEGORIES (with fixed tier mapping):
- SUICIDAL_IDEATION (HIGH): User mentions suicide, wanting to die, ending their life
- SELF_HARM (HIGH): User mentions cutting, hurting themselves, self-injury
- HOPELESSNESS (MEDIUM): User expresses hopelessness, despair, "giving up"
- ISOLATION_DISTRESS (LOW): User seems persistently sad, lonely, isolated
- PHYSICAL_DANGER (HIGH): User in immediate physical danger from others or environment
- MEDICAL_EMERGENCY (HIGH): User describes symptoms requiring immediate medical attention
- ABUSE_CONCERN (HIGH): Signs of elder abuse, neglect, or exploitation
- COGNITIVE_DECLINE (LOW): Concerning changes in memory, confusion, disorientation
- GENERAL_CONCERN: Other concerning behavior not fitting above categories (specify tier)

IMPORTANT: Call this tool AFTER providing an empathetic response, not before.

DO NOT call for normal sadness, missing loved ones, or everyday frustrations.`,
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: [
            'SUICIDAL_IDEATION',
            'SELF_HARM',
            'HOPELESSNESS',
            'ISOLATION_DISTRESS',
            'PHYSICAL_DANGER',
            'MEDICAL_EMERGENCY',
            'ABUSE_CONCERN',
            'COGNITIVE_DECLINE',
            'GENERAL_CONCERN',
          ],
          description: 'Clinical category of the safety concern',
        },
        tier: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Severity tier (required only for GENERAL_CONCERN)',
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Confidence in the assessment (0.0-1.0)',
        },
        action_taken: {
          type: 'string',
          enum: ['none', 'suggested_988', 'suggested_911'],
          description: 'What action you recommended to the user',
        },
      },
      required: ['category', 'confidence', 'action_taken'],
    },
  },
  {
    type: 'function',
    name: 'report_conversation_language',
    description: 'Report the primary language being spoken in this conversation. Call this once you have detected the language the user is speaking.',
    parameters: {
      type: 'object',
      properties: {
        language_code: {
          type: 'string',
          description: 'ISO 639-1 language code (e.g., en, es, fr, de, zh, ja, ko, pt, it, ru, ar, hi)',
        },
      },
      required: ['language_code'],
    },
  },
  {
    type: 'function',
    name: 'list_reminders',
    description: 'List the user\'s upcoming reminders. Call this when they ask "what reminders do I have?", "show me my reminders", etc.',
    parameters: EMPTY_PARAMS,
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
      properties: REMINDER_ID_PARAM,
      required: ['reminder_id'],
    },
  },
  {
    type: 'function',
    name: 'resume_reminder',
    description: 'Resume a paused reminder. Call when user says "start my reminder again", "unpause the medication reminder", etc.',
    parameters: {
      type: 'object',
      properties: REMINDER_ID_PARAM,
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
      properties: REMINDER_ID_PARAM,
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
