// xAI Grok Voice Agent WebSocket bridge
// Handles bidirectional audio streaming with Grok

import { WebSocket } from 'ws';
import { logger } from '../server.js';

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
  lowMinutesWarning: boolean;
  minutesRemaining: number;
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
            description: 'Set a reminder for the user. The reminder will be delivered via phone call.',
            parameters: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'The reminder message',
                },
                due_at_local: {
                  type: 'string',
                  description: 'When to remind, in ISO 8601 format in user\'s local time',
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

    this.ws.send(JSON.stringify(sessionConfig));
    logger.info({ callSessionId: this.options.callSessionId }, 'Sent Grok session config');
  }

  // Build the system prompt
  private buildSystemPrompt(): string {
    const { userName, language, isFirstCall, memories, lowMinutesWarning, minutesRemaining } = this.options;

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
- set_reminder: Set reminders delivered via phone call
- schedule_call: Adjust when you call them
- web_search: Look up current events (keep summaries neutral)

`;

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
