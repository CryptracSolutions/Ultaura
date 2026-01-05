// xAI Grok Voice Agent WebSocket bridge
// Handles bidirectional audio streaming with Grok

import { WebSocket } from 'ws';
import { compilePrompt, buildReminderPrompt, GROK_TOOLS } from '@ultaura/prompts';
import { SAFETY_EXCLUSION_PATTERNS, SAFETY_KEYWORDS } from '@ultaura/prompts/safety';
import type {
  AccountStatus,
  Memory,
  PlanId,
  PreferredLanguage,
  SafetyMatch,
  SafetyTier,
  SpanishFormality,
} from '@ultaura/types';
import { logger } from '../server.js';
import { addTurn, TurnSummary } from '../services/ephemeral-buffer.js';
import { getMemoriesForLine } from '../services/memory.js';
import { getOrCreateSafetyState } from '../services/safety-state.js';
import type { SafetyState } from '../services/safety-state.js';

const GROK_REALTIME_URL = 'wss://api.x.ai/v1/realtime';

interface GrokBridgeOptions {
  callSessionId: string;
  lineId: string;
  accountId: string;
  userName: string;
  timezone: string;
  language: PreferredLanguage;
  spanishFormality?: SpanishFormality;
  isFirstCall: boolean;
  memories: Memory[];
  seedInterests: string[] | null;
  seedAvoidTopics: string[] | null;
  lowMinutesWarning: boolean;
  minutesRemaining: number;
  // Reminder call fields
  isReminderCall: boolean;
  reminderMessage: string | null;
  // Plan info for upgrade context
  currentPlanId: PlanId;
  accountStatus: AccountStatus;
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
  transcript?: string;
}

export class GrokBridge {
  private ws: WebSocket | null = null;
  private options: GrokBridgeOptions;
  private isConnected = false;
  private safetyState: SafetyState;

  constructor(options: GrokBridgeOptions) {
    this.options = options;
    this.safetyState = getOrCreateSafetyState(options.callSessionId);
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
        tools: GROK_TOOLS,
      },
    };

    this.ws.send(JSON.stringify(sessionConfig));
    logger.info({ callSessionId: this.options.callSessionId }, 'Sent Grok session config');
  }

  // Build the system prompt
  private buildSystemPrompt(overrides?: { memories?: Memory[] }): string {
    const {
      userName,
      language,
      spanishFormality,
      isFirstCall,
      seedInterests,
      seedAvoidTopics,
      lowMinutesWarning,
      minutesRemaining,
      isReminderCall,
      reminderMessage,
      timezone,
      currentPlanId,
      accountStatus,
    } = this.options;
    const memories = overrides?.memories ?? this.options.memories;

    // Use dedicated short prompt for reminder calls
    if (isReminderCall && reminderMessage) {
      return buildReminderPrompt({
        userName,
        reminderMessage,
        language,
      });
    }

    return compilePrompt('voice_realtime', {
      userName,
      language,
      spanishFormality,
      memories,
      isFirstCall,
      timezone,
      seedInterests,
      seedAvoidTopics,
      lowMinutesWarning,
      minutesRemaining,
      currentPlanId,
      accountStatus,
    });
  }

  private async refreshMemoryContext(): Promise<void> {
    try {
      const memories = await getMemoriesForLine(
        this.options.accountId,
        this.options.lineId,
        { limit: 50 }
      );

      this.sendMessage({
        type: 'session.update',
        session: {
          instructions: this.buildSystemPrompt({ memories }),
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

  private scanForSafetyKeywords(transcript: string): SafetyMatch[] {
    const text = transcript.toLowerCase().trim();
    const matches: SafetyMatch[] = [];

    for (const tier of ['high', 'medium', 'low'] as const) {
      if (this.safetyState.triggeredTiers.has(tier)) {
        continue;
      }

      const keywords = SAFETY_KEYWORDS[tier];
      let matchedTier = false;

      for (const keyword of keywords) {
        let keywordMatch = this.findKeywordMatch(text, keyword);

        while (keywordMatch) {
          if (!this.isExcludedAtPosition(text, keywordMatch.start, keywordMatch.end)) {
            matches.push({ tier, matchedKeyword: keyword });
            matchedTier = true;
            break;
          }

          keywordMatch = this.findKeywordMatch(text, keyword, keywordMatch.end);
        }

        if (matchedTier) {
          break;
        }
      }
    }

    return matches;
  }

  private findKeywordMatch(
    text: string,
    keyword: string,
    fromIndex = 0
  ): { start: number; end: number } | null {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    regex.lastIndex = fromIndex;
    const match = regex.exec(text);
    if (!match) {
      return null;
    }

    return { start: match.index, end: match.index + match[0].length };
  }

  private isExcludedAtPosition(text: string, keywordStart: number, keywordEnd: number): boolean {
    for (const pattern of SAFETY_EXCLUSION_PATTERNS) {
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        const exclStart = match.index;
        const exclEnd = match.index + match[0].length;
        if (keywordStart < exclEnd && keywordEnd > exclStart) {
          return true;
        }
      }
    }

    return false;
  }

  private async handleSafetyBackstop(matches: SafetyMatch[]): Promise<void> {
    if (matches.length === 0) return;

    const baseUrl = process.env.TELEPHONY_BACKEND_URL || 'http://localhost:3001';

    for (const match of matches) {
      const { tier } = match;

      this.safetyState.triggeredTiers.add(tier);
      this.safetyState.backstopTiersTriggered.add(tier);

      try {
        await this.callToolEndpoint(`${baseUrl}/tools/safety_event`, {
          callSessionId: this.options.callSessionId,
          lineId: this.options.lineId,
          accountId: this.options.accountId,
          tier,
          signals: 'keyword_backstop_detected',
          actionTaken: 'none',
          source: 'keyword_backstop',
        });

        logger.info({
          event: 'safety_backstop_triggered',
          callSessionId: this.options.callSessionId,
          lineId: this.options.lineId,
          tier,
          timestamp: Date.now(),
        }, 'Safety backstop triggered');
      } catch (error) {
        logger.error({ error, tier, callSessionId: this.options.callSessionId }, 'Failed to log safety backstop event');
      }
    }

    this.safetyState.lastDetectionTime = Date.now();

    const highestTier =
      matches.find((match) => match.tier === 'high')?.tier ||
      matches.find((match) => match.tier === 'medium')?.tier ||
      matches[0].tier;

    this.injectSafetyHint(highestTier);
  }

  public markTierTriggeredByModel(tier: SafetyTier): void {
    this.safetyState.triggeredTiers.add(tier);
    this.safetyState.modelTiersLogged.add(tier);
    this.safetyState.lastDetectionTime = Date.now();
    logger.debug({ tier }, 'Tier marked as triggered by model');
  }

  private injectSafetyHint(tier: SafetyTier): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const hintText = tier === 'high'
      ? '[SYSTEM: Safety keywords detected (high severity). Assess user wellbeing immediately and call log_safety_concern. Consider suggesting 988 crisis line.]'
      : tier === 'medium'
        ? '[SYSTEM: Safety keywords detected (medium severity). Assess user wellbeing and call log_safety_concern if warranted.]'
        : '[SYSTEM: Potential distress keywords detected. Please respond with empathy and assess if follow-up is needed.]';

    const itemMessage = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'system',
        content: [{ type: 'input_text', text: hintText }],
      },
    };

    this.ws.send(JSON.stringify(itemMessage));
    this.ws.send(JSON.stringify({ type: 'response.create' }));

    logger.debug({ tier }, 'Injected safety hint to model');
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

            const safetyMatches = this.scanForSafetyKeywords(transcript);
            if (safetyMatches.length > 0) {
              this.handleSafetyBackstop(safetyMatches).catch((err) => {
                logger.error({ error: err }, 'Safety backstop handling failed');
              });
            }
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
          this.markTierTriggeredByModel(args.tier);
          result = await this.callToolEndpoint(`${baseUrl}/tools/safety_event`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            accountId: this.options.accountId,
            tier: args.tier,
            signals: args.signals,
            actionTaken: args.action_taken,
            source: 'model',
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
    const output = (message as any).output as Array<any> | undefined;
    const transcript =
      output
        ?.find(o => o.type === 'message')
        ?.content?.find((c: any) => c.transcript || c.text)?.transcript ||
      output
        ?.find(o => o.type === 'message')
        ?.content?.find((c: any) => c.transcript || c.text)?.text ||
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
