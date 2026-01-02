// xAI Grok Voice Agent WebSocket bridge
// Handles bidirectional audio streaming with Grok

import { WebSocket } from 'ws';
import { logger } from '../server.js';
import { addTurn, TurnSummary } from '../services/ephemeral-buffer.js';
import { getMemoriesForLine, formatMemoriesForPrompt } from '../services/memory.js';

const GROK_REALTIME_URL = 'wss://api.x.ai/v1/realtime';

interface GrokBridgeOptions {
  callSessionId: string;
  lineId: string;
  accountId: string;
  userName: string;
  timezone: string;
  language: 'auto' | 'en' | 'es';
  isFirstCall: boolean;
  memories: string;
  seedInterests: string[] | null;
  seedAvoidTopics: string[] | null;
  lowMinutesWarning: boolean;
  minutesRemaining: number;
  // Reminder call fields
  isReminderCall: boolean;
  reminderMessage: string | null;
  // Plan info for upgrade context
  currentPlanId: string;
  accountStatus: 'trial' | 'active' | 'past_due' | 'canceled';
  onAudioReceived: (audioBase64: string) => void;
  onClearBuffer: () => void;
  onError: (error: Error) => void;
  onToolCall: (toolName: string, args: Record<string, unknown>) => void;
}

interface GrokMessage {
  type: string;
  session?: {
    voice?: string;
    instructions?: string;
    audio?: {
      input?: { format: { type: string } };
      output?: { format: { type: string } };
    };
    turn_detection?: {
      type: string;
      threshold: number;
      prefix_padding_ms: number;
      silence_duration_ms: number;
    };
    tools?: Array<{
      type: string;
      name?: string;
      description?: string;
      parameters?: Record<string, unknown>;
    }>;
  };
  audio?: string;
  delta?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  item?: {
    type: string;
    call_id: string;
    output: string;
  };
  output?: Array<{
    type: string;
    content?: Array<{
      type: string;
      transcript?: string;
      text?: string;
    }>;
  }>;
  content?: Array<{
    type: string;
    transcript?: string;
    text?: string;
  }>;
  text?: string;
}

const MEMORY_MANAGEMENT_PROMPT = `## Memory Management

You have the ability to remember things about the user for future calls. Use these tools:

### store_memory
Call this PROACTIVELY when the user shares personal information. Do NOT confirm storage verbally.

**When to use:**
- Personal facts: "My name is...", "I have 3 grandchildren", "I live in Portland"
- Preferences: "I love gardening", "I prefer mornings", "I don't like talking about politics"
- Follow-ups: "I have a doctor appointment Tuesday", "My daughter is visiting next week"
- Context: "I live alone", "I use a walker now"
- History: "I was a teacher for 30 years", "I met my wife in Paris"
- Wellbeing: "I've been feeling tired lately", "Sleeping much better now"

**Do NOT store:**
- Temporary small talk
- Obvious context (you're on a phone call)
- Anything already in your memory

### update_memory
Call this when the user corrects or updates previous information.
- "Actually, I have FOUR grandchildren" → update existing memory
- "I moved to a new apartment" → update location

### Follow-up + Reminder Integration
For follow_up type memories with a specific time (appointments, visits, events):
- Store the memory
- Ask if they'd like a reminder set

Example: "I have a doctor appointment next Tuesday"
1. Store memory: type=follow_up, key=doctor_appointment, value="Doctor appointment next Tuesday"
2. Say: "I'll remember that. Would you like me to give you a reminder call before your appointment?"`;
}

export class GrokBridge {
  private ws: WebSocket | null = null;
  private options: GrokBridgeOptions;
  private isConnected = false;

  constructor(options: GrokBridgeOptions) {
    this.options = options;
  }

  // Connect to Grok Realtime API
  async connect(): Promise<void> {
    const apiKey = process.env.XAI_API_KEY;

    if (!apiKey) {
      throw new Error('Missing XAI_API_KEY environment variable');
    }

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(GROK_REALTIME_URL, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      this.ws.on('open', () => {
        logger.info({ callSessionId: this.options.callSessionId }, 'Connected to Grok Realtime');
        this.isConnected = true;
        this.sendSessionConfig();
        resolve();
      });

      this.ws.on('message', (data: Buffer) => {
        this.handleGrokMessage(data);
      });

      this.ws.on('error', (error) => {
        logger.error({ error, callSessionId: this.options.callSessionId }, 'Grok WebSocket error');
        this.options.onError(error);
        reject(error);
      });

      this.ws.on('close', (code, reason) => {
        logger.info({
          callSessionId: this.options.callSessionId,
          code,
          reason: reason.toString(),
        }, 'Grok WebSocket closed');
        this.isConnected = false;
      });

      // Timeout for connection
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('Grok connection timeout'));
        }
      }, 10000);
    });
  }

  // Send session configuration
  private sendSessionConfig(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const systemPrompt = this.buildSystemPrompt();

    const sessionConfig: GrokMessage = {
      type: 'session.update',
      session: {
        voice: 'Ara', // Warm, friendly voice
        instructions: systemPrompt,
        audio: {
          input: { format: { type: 'audio/pcmu' } }, // μ-law for Twilio
          output: { format: { type: 'audio/pcmu' } },
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
        tools: [
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
- wellbeing: Wellness observations (energy, mood)`
                },
                key: {
                  type: 'string',
                  description: 'Semantic key for the memory (e.g., "preferred_name", "favorite_hobby", "upcoming_surgery")'
                },
                value: {
                  type: 'string',
                  description: 'The memory content to store'
                },
                confidence: {
                  type: 'number',
                  minimum: 0,
                  maximum: 1,
                  description: 'Confidence level (0-1). Use lower values for inferred information.'
                },
                suggest_reminder: {
                  type: 'boolean',
                  description: 'For follow_up type: should we suggest creating a reminder for this?'
                }
              },
              required: ['memory_type', 'key', 'value']
            }
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
                  description: 'The key of the existing memory to update'
                },
                new_value: {
                  type: 'string',
                  description: 'The updated memory content'
                },
                memory_type: {
                  type: 'string',
                  enum: ['fact', 'preference', 'follow_up', 'context', 'history', 'wellbeing'],
                  description: 'Type to use if creating new memory (when key not found). Defaults to fact.'
                },
                confidence: {
                  type: 'number',
                  minimum: 0,
                  maximum: 1,
                  description: 'Confidence in the update (0-1)'
                }
              },
              required: ['existing_key', 'new_value']
            }
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
            description: 'INTERNAL: Log when you detect signs of distress, depression, self-harm ideation, or crisis. Do NOT call this for normal sad feelings. Only for genuine safety concerns.',
            parameters: {
              type: 'object',
              properties: {
                tier: {
                  type: 'string',
                  enum: ['low', 'medium', 'high'],
                  description: 'low=sad/lonely, medium=distress/hopelessness, high=self-harm/crisis',
                },
                signals: {
                  type: 'string',
                  description: 'Brief description of concerning statements',
                },
                action_taken: {
                  type: 'string',
                  enum: ['none', 'suggested_988', 'suggested_911'],
                  description: 'What action you recommended',
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
        ],
      },
    };

    this.ws.send(JSON.stringify(sessionConfig));
    logger.info({ callSessionId: this.options.callSessionId }, 'Sent Grok session config');
  }

  // Build the system prompt
  private buildSystemPrompt(overrides?: { memories?: string }): string {
    const {
      userName,
      language,
      isFirstCall,
      seedInterests,
      seedAvoidTopics,
      lowMinutesWarning,
      minutesRemaining,
      isReminderCall,
      reminderMessage,
    } = this.options;
    const memories = overrides?.memories ?? this.options.memories;

    // Use dedicated short prompt for reminder calls
    if (isReminderCall && reminderMessage) {
      return this.buildReminderPrompt(userName, reminderMessage, language);
    }

    let prompt = `You are Ultaura, a warm and friendly AI voice companion. You are speaking with ${userName} on the phone.

## Core Identity
- You are an AI companion, not a human. Be honest about this if asked.
- You are NOT a therapist, doctor, or medical professional.
- You provide friendly conversation, emotional support, and companionship.

## Conversation Style
- Be warm, patient, and genuinely interested
- Use a natural phone conversation tone
- Keep responses concise (1-3 sentences usually)
- Match their energy and pace

## Memory
${memories}

## Privacy
- Family set up this service but cannot see transcripts
- Reassure them conversations are private
- If they say "forget that" - acknowledge and stop referencing it
- If they say "don't tell my family" - mark it private and reassure them

## Safety
If distress or self-harm mentioned:
1. Stay calm and empathetic
2. Listen without judgment
3. Encourage reaching out to trusted person or 988 (crisis line)
4. For immediate danger, encourage 911
5. Never leave them feeling abandoned

## Tools Available
- set_reminder: Set one-time or recurring reminders delivered via phone call
  - For recurring reminders, parse phrases like "every day", "every Monday and Friday", "every 3 days", "on the 15th of each month"
  - Always ask for confirmation before setting recurring reminders
- schedule_call: Adjust when you call them
- choose_overage_action: Record a user decision to continue, upgrade, or stop after an overage or trial prompt
- request_upgrade: Help user upgrade their plan - explain options and send checkout link
- web_search: Look up current events (keep summaries neutral)

${MEMORY_MANAGEMENT_PROMPT}

`;

    // Add plan info for upgrade context
    const { currentPlanId, accountStatus } = this.options;
    const planStatusLabel =
      accountStatus === 'trial'
        ? 'Trial'
        : accountStatus === 'active'
          ? 'Active Subscription'
          : accountStatus;

    prompt += `
## Plans & Pricing
If the user asks about upgrading or wants more minutes, explain these plans:
- Care: $39/month, 300 minutes, 1 phone line
- Comfort: $99/month, 900 minutes, 2 phone lines
- Family: $199/month, 2200 minutes, 4 phone lines
- Pay as you go: $0/month + $0.15 per minute, 4 phone lines

Current plan: ${currentPlanId === 'free_trial' ? 'Trial' : currentPlanId}
Account status: ${planStatusLabel}

Use the request_upgrade tool when user wants to upgrade. First explain options, then once they choose, confirm their choice, then send the link.

`;

    // Add seed interests from family/caregiver
    if (seedInterests && seedInterests.length > 0) {
      prompt += `
## Interests (provided by family)
${userName}'s family mentioned they enjoy: ${seedInterests.join(', ')}.
Use these as natural conversation starters or when the conversation lulls.
Don't force these topics - weave them in organically.

`;
    }

    // Add topics to avoid from family/caregiver
    if (seedAvoidTopics && seedAvoidTopics.length > 0) {
      prompt += `
## Topics to Avoid (provided by family)
Please avoid discussing: ${seedAvoidTopics.join(', ')}.
If ${userName} brings up these topics themselves, you may engage gently, but do not initiate.

`;
    }

    if (isFirstCall) {
      prompt += `
## First Call - Onboarding
This is your first call with ${userName}. Take time to:
1. Introduce yourself warmly: "Hello! I'm Ultaura, an AI voice companion."
2. Ask what they'd like to be called
3. Learn about their interests
4. Ask about topics to avoid
5. Explain privacy: "Your family doesn't see our conversations."
6. Discuss call schedule if they'd like regular check-ins
`;
    }

    if (lowMinutesWarning) {
      prompt += `
## Low Minutes Warning
${userName} has approximately ${minutesRemaining} minutes remaining. Near the end of the call, gently mention this.
`;
    }

    // Language instruction
    if (language === 'es') {
      prompt += `\n## Language\nSpeak in Spanish. Use formal "usted" unless they indicate otherwise.`;
    } else if (language === 'auto') {
      prompt += `\n## Language\nStart in English. If they speak another language, switch smoothly.`;
    }

    return prompt;
  }

  // Build a focused prompt for reminder calls
  private buildReminderPrompt(userName: string, reminderMessage: string, language: 'auto' | 'en' | 'es'): string {
    let prompt = `You are Ultaura calling with a quick reminder for ${userName}.

## Your Task
Deliver this reminder: "${reminderMessage}"

## Style
- Keep it brief and friendly (aim for under 30 seconds)
- Greet them warmly by name
- Deliver the reminder clearly
- Ask if they have any quick questions about the reminder
- Say goodbye warmly
- Do NOT try to start a full conversation - this is just a quick reminder call

## Example Flow
"Hello ${userName}, this is Ultaura calling with a quick reminder. ${reminderMessage}. Is there anything you'd like me to help with regarding this? ...Alright, take care and have a wonderful day!"

## Safety
If they mention distress or need help beyond the reminder, stay calm and empathetic. Suggest calling 988 if it seems serious.
`;

    // Language instruction
    if (language === 'es') {
      prompt += `\n## Language\nSpeak in Spanish. Use formal "usted" unless they indicate otherwise.`;
    } else if (language === 'auto') {
      prompt += `\n## Language\nStart in English. If they speak another language, switch smoothly.`;
    }

    return prompt;
  }

  private async refreshMemoryContext(): Promise<void> {
    try {
      const memories = await getMemoriesForLine(
        this.options.accountId,
        this.options.lineId,
        { limit: 50 }
      );
      const memoryText = formatMemoriesForPrompt(memories);

      this.sendMessage({
        type: 'session.update',
        session: {
          instructions: this.buildSystemPrompt({ memories: memoryText }),
        },
      });

      logger.debug({ lineId: this.options.lineId }, 'Memory context refreshed');
    } catch (error) {
      logger.warn({ error }, 'Failed to refresh memory context, continuing without refresh');
    }
  }

  private sendMessage(message: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  // Handle messages from Grok
  private handleGrokMessage(data: Buffer): void {
    try {
      const message: GrokMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'session.created':
        case 'session.updated':
          logger.debug({ callSessionId: this.options.callSessionId, type: message.type }, 'Grok session event');
          break;

        case 'response.audio.delta':
          // Audio chunk from Grok
          if (message.delta) {
            this.options.onAudioReceived(message.delta);
          }
          break;

        case 'response.audio.done':
          // Audio response complete
          break;

        case 'conversation.item.input_audio_transcription.completed': {
          const transcript = message.text || message.transcript || message.item?.output || '';
          if (transcript) {
            addTurn(this.options.callSessionId, this.extractUserTurn(transcript));
          }
          break;
        }

        case 'response.done': {
          const turn = this.extractAssistantTurn(message);
          if (turn.summary) {
            addTurn(this.options.callSessionId, turn);
          }
          break;
        }

        case 'input_audio_buffer.speech_started':
          // User started speaking - clear any pending audio (barge-in)
          this.options.onClearBuffer();
          break;

        case 'response.function_call_arguments.done':
          // Tool call request from Grok
          if (message.call_id && message.name && message.arguments) {
            this.handleToolCall(message.call_id, message.name, message.arguments);
          }
          break;

        case 'error':
          logger.error({ message, callSessionId: this.options.callSessionId }, 'Grok error');
          this.options.onError(new Error(`Grok error: ${JSON.stringify(message)}`));
          break;

        default:
          // Log other message types for debugging
          logger.debug({ type: message.type, callSessionId: this.options.callSessionId }, 'Grok message');
      }
    } catch (error) {
      logger.error({ error, callSessionId: this.options.callSessionId }, 'Error parsing Grok message');
    }
  }

  // Handle tool calls from Grok
  private async handleToolCall(callId: string, name: string, argsJson: string): Promise<void> {
    logger.info({ callId, name, callSessionId: this.options.callSessionId }, 'Grok tool call');

    try {
      const args = JSON.parse(argsJson);
      this.options.onToolCall(name, args);

      // Make the tool call to our backend
      const baseUrl = process.env.TELEPHONY_BACKEND_URL || 'http://localhost:3001';
      let result: string;

      switch (name) {
        case 'set_reminder':
          result = await this.callToolEndpoint(`${baseUrl}/tools/set_reminder`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            dueAtLocal: args.due_at_local,
            timezone: this.options.timezone,
            message: args.message,
            // Recurrence fields
            isRecurring: args.is_recurring || false,
            frequency: args.frequency,
            interval: args.interval,
            daysOfWeek: args.days_of_week,
            dayOfMonth: args.day_of_month,
            endsAtLocal: args.ends_at_local,
          });
          break;

        case 'schedule_call':
          result = await this.callToolEndpoint(`${baseUrl}/tools/schedule_call`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            mode: args.mode,
            when: args.when,
            daysOfWeek: args.days_of_week,
            timeLocal: args.time_local,
          });
          break;

        case 'choose_overage_action':
          result = await this.callToolEndpoint(`${baseUrl}/tools/overage_action`, {
            callSessionId: this.options.callSessionId,
            action: args.action,
            planId: args.plan_id,
          });
          break;

        case 'request_opt_out': {
          const confirmed = args.confirmed;
          if (confirmed) {
            result = await this.callToolEndpoint(`${baseUrl}/tools/opt_out`, {
              callSessionId: this.options.callSessionId,
              lineId: this.options.lineId,
              source: 'voice',
            });
          } else {
            result = JSON.stringify({
              success: true,
              message: 'Ask the user to confirm they want to stop receiving calls.'
            });
          }
          break;
        }

        case 'forget_memory':
          result = await this.callToolEndpoint(`${baseUrl}/tools/forget_memory`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            accountId: this.options.accountId,
            whatToForget: args.what_to_forget,
          });
          break;

        case 'store_memory':
          result = await this.callToolEndpoint(`${baseUrl}/tools/store_memory`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            accountId: this.options.accountId,
            memoryType: args.memory_type,
            key: args.key,
            value: args.value,
            confidence: args.confidence || 1.0,
            suggestReminder: args.suggest_reminder || false,
          });
          // Refresh context after storing
          this.refreshMemoryContext().catch(err => {
            logger.warn({ error: err }, 'Memory refresh failed');
          });
          break;

        case 'update_memory':
          result = await this.callToolEndpoint(`${baseUrl}/tools/update_memory`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            accountId: this.options.accountId,
            existingKey: args.existing_key,
            newValue: args.new_value,
            memoryType: args.memory_type,
            confidence: args.confidence || 1.0,
          });
          this.refreshMemoryContext().catch(err => {
            logger.warn({ error: err }, 'Memory refresh failed');
          });
          break;

        case 'mark_private':
          result = await this.callToolEndpoint(`${baseUrl}/tools/mark_private`, {
            lineId: this.options.lineId,
            accountId: this.options.accountId,
            whatToKeepPrivate: args.what_to_keep_private,
          });
          break;

        case 'log_safety_concern':
          result = await this.callToolEndpoint(`${baseUrl}/tools/safety_event`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            accountId: this.options.accountId,
            tier: args.tier,
            signals: args.signals,
            actionTaken: args.action_taken,
          });
          break;

        // Reminder management tools
        case 'list_reminders':
          result = await this.callToolEndpoint(`${baseUrl}/tools/list_reminders`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
          });
          break;

        case 'edit_reminder':
          result = await this.callToolEndpoint(`${baseUrl}/tools/edit_reminder`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            reminderId: args.reminder_id,
            newMessage: args.new_message,
            newTimeLocal: args.new_time_local,
            timezone: this.options.timezone,
          });
          break;

        case 'pause_reminder':
          result = await this.callToolEndpoint(`${baseUrl}/tools/pause_reminder`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            reminderId: args.reminder_id,
          });
          break;

        case 'resume_reminder':
          result = await this.callToolEndpoint(`${baseUrl}/tools/resume_reminder`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            reminderId: args.reminder_id,
          });
          break;

        case 'snooze_reminder':
          result = await this.callToolEndpoint(`${baseUrl}/tools/snooze_reminder`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            reminderId: args.reminder_id,
            snoozeMinutes: args.snooze_minutes,
          });
          break;

        case 'cancel_reminder':
          result = await this.callToolEndpoint(`${baseUrl}/tools/cancel_reminder`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            reminderId: args.reminder_id,
          });
          break;

        case 'request_upgrade':
          result = await this.callToolEndpoint(`${baseUrl}/tools/request_upgrade`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            accountId: this.options.accountId,
            planId: args.plan_id,
            sendLink: args.send_link,
          });
          break;

        default:
          result = JSON.stringify({ error: `Unknown tool: ${name}` });
      }

      // Send the result back to Grok
      this.sendToolResult(callId, result);

    } catch (error) {
      logger.error({ error, name, callSessionId: this.options.callSessionId }, 'Tool call error');
      this.sendToolResult(callId, JSON.stringify({ error: 'Tool execution failed' }));
    }
  }

  private extractUserTurn(transcription: string): TurnSummary {
    return {
      timestamp: Date.now(),
      speaker: 'user',
      summary: transcription.slice(0, 500),
      intent: this.inferIntent(transcription),
      entities: this.extractEntities(transcription),
    };
  }

  private extractAssistantTurn(message: GrokMessage): TurnSummary {
    const transcript =
      message.output
        ?.find(o => o.type === 'message')
        ?.content?.find(c => c.transcript || c.text)?.transcript ||
      message.output
        ?.find(o => o.type === 'message')
        ?.content?.find(c => c.transcript || c.text)?.text ||
      '';

    return {
      timestamp: Date.now(),
      speaker: 'assistant',
      summary: transcript.slice(0, 500),
      intent: 'response',
      entities: this.extractEntities(transcript),
    };
  }

  private inferIntent(text: string): string {
    if (text.includes('?')) return 'question';
    if (/\b(can you|please|could you|would you)\b/i.test(text)) return 'request';
    return 'statement';
  }

  private extractEntities(text: string): string[] {
    const entities: string[] = [];
    const names = text.match(/\b[A-Z][a-z]+\b/g);
    if (names) entities.push(...names.slice(0, 5));
    const dates = text.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week)\b/gi);
    if (dates) entities.push(...dates);
    return [...new Set(entities)];
  }

  // Call a tool endpoint
  private async callToolEndpoint(url: string, body: Record<string, unknown>): Promise<string> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.TELEPHONY_WEBHOOK_SECRET || '',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return JSON.stringify(data);
  }

  // Send tool result back to Grok
  private sendToolResult(callId: string, output: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const message: GrokMessage = {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output,
      },
    };

    this.ws.send(JSON.stringify(message));

    // Trigger a response from Grok
    this.ws.send(JSON.stringify({ type: 'response.create' }));
  }

  // Send audio to Grok
  sendAudio(audioBase64: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isConnected) return;

    const message = {
      type: 'input_audio_buffer.append',
      audio: audioBase64,
    };

    this.ws.send(JSON.stringify(message));
  }

  // Send text input to Grok (for DTMF handling)
  sendTextInput(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isConnected) return;

    // Create a conversation item with user text
    const itemMessage = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text,
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
            description: 'INTERNAL: Log when you detect signs of distress, depression, self-harm ideation, or crisis. Do NOT call this for normal sad feelings. Only for genuine safety concerns.',
            parameters: {
              type: 'object',
              properties: {
                tier: {
                  type: 'string',
                  enum: ['low', 'medium', 'high'],
                  description: 'low=sad/lonely, medium=distress/hopelessness, high=self-harm/crisis',
                },
                signals: {
                  type: 'string',
                  description: 'Brief description of concerning statements',
                },
                action_taken: {
                  type: 'string',
                  enum: ['none', 'suggested_988', 'suggested_911'],
                  description: 'What action you recommended',
                },
              },
              required: ['tier', 'signals', 'action_taken'],
            },
          },
        ],
      },
    };

    this.ws.send(JSON.stringify(itemMessage));

    // Trigger a response
    this.ws.send(JSON.stringify({ type: 'response.create' }));
  }

  // Close the connection
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}
