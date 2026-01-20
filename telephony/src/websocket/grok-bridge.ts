// xAI Grok Voice Agent WebSocket bridge
// Handles bidirectional audio streaming with Grok

import { WebSocket } from 'ws';
import { DateTime } from 'luxon';
import { compilePrompt, buildReminderPrompt, GROK_TOOLS } from '@ultaura/prompts';
import type {
  AccountStatus,
  Memory,
  PlanId,
  RoutineMemoryValue,
  SafetyCategory,
  SafetyMatch,
  SafetyTier,
} from '@ultaura/types';
import { SAFETY_CATEGORY_TIERS } from '@ultaura/types';
import { logger } from '../server.js';
import { addTurn, getBuffer, markConsentGranted, TurnSummary } from '../services/ephemeral-buffer.js';
import { recordCallEvent } from '../services/call-session.js';
import { getMemoriesForLine, markMemoriesAccessed } from '../services/memory.js';
import { getOrCreateSafetyState } from '../services/safety-state.js';
import type { SafetyState } from '../services/safety-state.js';
import type { CallPreview } from '../services/call-preview.js';
import type { StoryArc } from '../services/retention-context.js';
import { buildContextWindow, clearJobsForSession, enqueueClassifierJob } from '../services/safety-classifier.js';
import { detectHeuristics } from '../services/safety-heuristics.js';
import { scanForSafetyKeywords } from '../services/safety-keywords.js';
import { getBackendUrl, getInternalApiSecret } from '../utils/env.js';
import {
  GROK_INITIAL_CONNECT_TIMEOUT_MS,
  GROK_RECONNECT_TIMEOUT_MS,
  VAD_SILENCE_DURATION_MS,
  VAD_THRESHOLD,
} from '../utils/constants.js';

const GROK_REALTIME_URL = process.env.XAI_REALTIME_URL || 'wss://api.x.ai/v1/realtime';
const ROUTINE_TIME_WINDOW_MINUTES = 120;

function isMultilingualSafetyEnabled(): boolean {
  return process.env.ULTAURA_MULTILINGUAL_SAFETY_ENABLED === 'true';
}

function isSafetySweepsEnabled(): boolean {
  return process.env.ULTAURA_SAFETY_SWEEPS_ENABLED !== 'false';
}

function randomBetween(minMs: number, maxMs: number): number {
  const min = Math.ceil(minMs);
  const max = Math.floor(maxMs);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sanitizePromptSnippet(input: string): string {
  return input
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[`]/g, '')
    .replace(/\b(system|assistant|user)\s*:/gi, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 160);
}

function parseTimeOfDayToMinutes(timeOfDay: string): number | null {
  const trimmed = timeOfDay.trim().toLowerCase();
  const ampmMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (ampmMatch) {
    const hour = Number.parseInt(ampmMatch[1], 10) % 12;
    const minute = ampmMatch[2] ? Number.parseInt(ampmMatch[2], 10) : 0;
    const isPm = ampmMatch[3] === 'pm';
    return ((hour + (isPm ? 12 : 0)) * 60) + minute;
  }

  const twentyFourMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourMatch) {
    const hour = Number.parseInt(twentyFourMatch[1], 10);
    const minute = Number.parseInt(twentyFourMatch[2], 10);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return (hour * 60) + minute;
    }
  }

  return null;
}

function isRoutineDue(value: RoutineMemoryValue, timezone?: string): boolean {
  const zone = timezone || 'America/Los_Angeles';
  const now = DateTime.now().setZone(zone);
  const luxonToOurDay = (luxonDay: number): number => (luxonDay % 7);
  const today = luxonToOurDay(now.weekday);

  if (value.daysOfWeek && value.daysOfWeek.length > 0 && !value.daysOfWeek.includes(today)) {
    return false;
  }

  if (value.timeOfDay) {
    const targetMinutes = parseTimeOfDayToMinutes(value.timeOfDay);
    if (targetMinutes === null) {
      return true;
    }
    const nowMinutes = (now.hour * 60) + now.minute;
    return Math.abs(nowMinutes - targetMinutes) <= ROUTINE_TIME_WINDOW_MINUTES;
  }

  return true;
}

function buildRoutinePromptSection(memories: Memory[], timezone?: string): string | null {
  const routinePrompts = memories
    .filter((memory) => memory.type === 'routine')
    .flatMap((memory) => {
      if (typeof memory.value === 'string') {
        const safeValue = sanitizePromptSnippet(memory.value);
        return safeValue ? [`How was your ${safeValue}?`] : [];
      }

      if (memory.value && typeof memory.value === 'object') {
        const value = memory.value as RoutineMemoryValue;
        if (!isRoutineDue(value, timezone)) {
          return [];
        }
        if (!value.proactivePrompt) {
          return [];
        }
        const safePrompt = sanitizePromptSnippet(value.proactivePrompt);
        return safePrompt ? [safePrompt] : [];
      }

      return [];
    });

  if (routinePrompts.length === 0) {
    return null;
  }

  const prompts = routinePrompts
    .slice(0, 3)
    .map((prompt) => `- ${prompt}`)
    .join('\n');

  return `## Routine Check-ins\nIf it feels natural, work in one of these today:\n${prompts}`;
}

interface GrokBridgeOptions {
  callSessionId: string;
  lineId: string;
  accountId: string;
  userName: string;
  timezone: string;
  startingLanguage?: string;
  isLanguageAutoDetect?: boolean;
  isFirstCall: boolean;
  memories: Memory[];
  memoryEnabled: boolean;
  needsMemoryConsent: boolean;
  seedInterests: string[] | null;
  seedAvoidTopics: string[] | null;
  lowMinutesWarning: boolean;
  minutesRemaining: number;
  // Reminder call fields
  isReminderCall: boolean;
  reminderMessage: string | null;
  isTestCall: boolean;
  isPreviewMode: boolean;
  userType: 'self' | 'family_managed';
  sharingEnabled: boolean;
  recordingEnabled: boolean;
  recordingConsent: 'pending' | 'granted' | 'denied';
  recordingReenableRequested: boolean;
  needsRecordingConsent: boolean;
  sharingTier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
  sharingConsent: 'pending' | 'granted' | 'denied';
  sharingRePromptRequested: boolean;
  needsSharingConsent: boolean;
  onboardingCompleted: boolean;
  canReceiveInboundCalls: boolean;
  pendingCallPreview?: CallPreview | null;
  segmentPreferences?: string | null;
  activeStoryArcs?: StoryArc[];
  // Plan info for upgrade context
  currentPlanId: PlanId;
  accountStatus: AccountStatus;
  promptPlaceholders?: Record<string, string>;
  interruptionTolerance?: 'high' | 'normal' | 'low' | null;
  fillerWordPatience?: 'high' | 'normal' | 'low' | null;
  silenceToleranceMs?: number | null;
  crosstalkRecoveryMode?: 'immediate' | 'patient' | 'very_patient' | null;
  onAudioReceived: (audioBase64: string) => void;
  onClearBuffer: () => void;
  onError: (error: Error) => void;
  onToolCall: (toolName: string, args: Record<string, unknown>) => void;
  onToolResult?: (toolName: string, success: boolean) => void;
  onBargeIn?: () => void;
  onDisconnect?: (type: 'error' | 'close', detail: string) => void;
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
  private isGeneratingAudio = false;
  private hasEverConnected = false;
  private suppressDisconnect = false;
  private safetyState: SafetyState;
  private detectedLanguage: string | null = null;
  private periodicSweepTimer: NodeJS.Timeout | null = null;
  private lastSweepTime = 0;

  constructor(options: GrokBridgeOptions) {
    this.options = options;
    this.safetyState = getOrCreateSafetyState(options.callSessionId);
    if (options.startingLanguage && options.isLanguageAutoDetect === false) {
      this.detectedLanguage = options.startingLanguage;
    }
    this.startPeriodicSweeps();
  }

  // Connect to Grok Realtime API
  async connect(timeoutMs: number = GROK_INITIAL_CONNECT_TIMEOUT_MS): Promise<void> {
    const apiKey = process.env.XAI_API_KEY;

    if (!apiKey) {
      throw new Error('Missing XAI_API_KEY environment variable');
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('Grok connection timeout'));
      }, timeoutMs);

      this.ws = new WebSocket(GROK_REALTIME_URL, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      this.ws.on('open', () => {
        logger.info({ callSessionId: this.options.callSessionId }, 'Connected to Grok Realtime');
        this.isConnected = true;
        this.hasEverConnected = true;
        this.sendSessionConfig();
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolve();
        }
      });

      this.ws.on('message', (data: Buffer) => {
        this.handleGrokMessage(data);
      });

      this.ws.on('error', (error) => {
        logger.error({ error, callSessionId: this.options.callSessionId }, 'Grok WebSocket error');
        this.options.onError(error);
        if (this.hasEverConnected && !this.suppressDisconnect) {
          this.triggerRecovery('error', error.message);
        }
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(error);
        }
      });

      this.ws.on('close', (code, reason) => {
        const reasonStr = reason.toString();
        logger.info({
          callSessionId: this.options.callSessionId,
          code,
          reason: reasonStr,
        }, 'Grok WebSocket closed');
        const wasConnected = this.isConnected;
        this.isConnected = false;
        if (wasConnected && !this.suppressDisconnect) {
          this.triggerRecovery('close', `${code}: ${reasonStr}`);
        }
        this.suppressDisconnect = false;
      });
    });
  }

  // Send session configuration
  private sendSessionConfig(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const systemPrompt = this.buildSystemPrompt();
    const tools = this.getActiveTools();

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
          threshold: this.getVadThreshold(),
          prefix_padding_ms: this.getPrefixPaddingMs(),
          silence_duration_ms: this.getSilenceDurationMs(),
        },
        tools,
      },
    };

    this.ws.send(JSON.stringify(sessionConfig));
    logger.info({ callSessionId: this.options.callSessionId }, 'Sent Grok session config');
  }

  // Build the system prompt
  private buildSystemPrompt(overrides?: { memories?: Memory[] }): string {
    const {
      userName,
      startingLanguage,
      isFirstCall,
      seedInterests,
      seedAvoidTopics,
      lowMinutesWarning,
      minutesRemaining,
      isReminderCall,
      reminderMessage,
      isTestCall,
      isPreviewMode,
      userType,
      sharingEnabled,
      recordingEnabled,
      recordingConsent,
      needsRecordingConsent,
      sharingTier,
      sharingConsent,
      needsSharingConsent,
      onboardingCompleted,
      canReceiveInboundCalls,
      timezone,
      currentPlanId,
      accountStatus,
    } = this.options;
    const memories = overrides?.memories ?? this.options.memories;
    const memoryEnabled = this.options.memoryEnabled;
    const placeholders = this.options.promptPlaceholders;

    // Use dedicated short prompt for reminder calls
    if (isReminderCall && reminderMessage) {
      let prompt = buildReminderPrompt({
        userName,
        reminderMessage,
        startingLanguage,
      });

      const consentSections = this.getConsentPromptSections();
      if (consentSections.length > 0) {
        prompt += `\n\n${consentSections.join('\n\n')}`;
      }

      return prompt;
    }

    let prompt = compilePrompt('voice_realtime', {
      userName,
      startingLanguage,
      isLanguageAutoDetect: this.options.isLanguageAutoDetect,
      memories,
      memoryEnabled,
      isFirstCall,
      isPreviewMode,
      timezone,
      seedInterests,
      seedAvoidTopics,
      lowMinutesWarning,
      minutesRemaining,
      currentPlanId,
      accountStatus,
      isTestCall,
      userType,
      sharingEnabled,
      recordingEnabled,
      recordingConsent,
      needsRecordingConsent,
      sharingTier,
      sharingConsent,
      needsSharingConsent,
      onboardingCompleted,
      canReceiveInboundCalls,
      placeholders,
    });

    if (memoryEnabled) {
      const routineSection = buildRoutinePromptSection(memories, timezone);
      if (routineSection) {
        prompt += `\n\n${routineSection}`;
      }
    }

    const consentSections = this.getConsentPromptSections();
    if (consentSections.length > 0) {
      prompt += `\n\n${consentSections.join('\n\n')}`;
    }

    if (this.options.pendingCallPreview) {
      const preview = this.options.pendingCallPreview;
      const isSurprise =
        preview.topicType === 'free_form' && preview.topicKey === 'surprise_me';
      const webSearchHint = preview.topicType === 'web_search'
        ? '\nUse web_search to fetch current information about this topic and share it naturally.'
        : '';
      const surpriseHint = isSurprise
        ? '\nThey asked for a surprise. Pick something delightful from their interests.'
        : '';

      prompt += `\n\n## Pending Call Preview
The senior chose "${preview.topicDisplay}" for this call.
Topic type: ${preview.topicType}${preview.segmentType ? `\nSegment type: ${preview.segmentType}` : ''}${webSearchHint}${surpriseHint}

At the START of this call:
1. Reference their choice: "Last time you said you'd like to hear about ${preview.topicDisplay}"
2. If they seem confused, remind them gently
3. Proceed with their chosen topic OR offer alternatives if they prefer`;
    }

    if (this.options.segmentPreferences) {
      prompt += `\n\n${this.options.segmentPreferences}`;
    }

    if (this.options.activeStoryArcs?.length) {
      const arcs = this.options.activeStoryArcs
        .map((arc) => `- "${arc.title}" (${arc.storyType}): Chapter ${arc.currentChapter}/${arc.totalChapters}`)
        .join('\n');
      prompt += `\n\n## Active Story Arcs\n${arcs}`;
    }

    return prompt;
  }

  private getConsentPromptSections(): string[] {
    const sections: string[] = [];

    if (this.options.needsRecordingConsent) {
      sections.push(this.getRecordingConsentSection());
    }

    if (this.options.needsMemoryConsent) {
      sections.push(this.getMemoryConsentSection());
    }

    if (this.options.needsSharingConsent) {
      sections.push(this.getSharingConsentSection());
    }

    return sections;
  }

  private getRecordingConsentSection(): string {
    const safeName = sanitizePromptSnippet(this.options.userName || 'there');
    const prompt = this.options.recordingReenableRequested
      ? 'Your family enabled recording again - would you like me to record our calls?'
      : this.options.isFirstCall
        ? 'This call is being recorded - is that okay with you?'
        : `Hi ${safeName}, it's Ultaura. Okay if I record today?`;

    return `## Recording Consent\nAsk at the START of the call:\n"${prompt}"\n\nIf the response is unclear, ask up to 2 times:\n"I didn't catch that - is it okay if I record?"\n\nIf YES: call grant_recording_consent.\nIf NO: call deny_recording_consent, then ask:\n"Would you like me to stop asking about recording on future calls?"\n- If YES: call set_recording_preference_permanent with never_ask=true.\n- If NO: call set_recording_preference_permanent with never_ask=false.\n\nIf the user revokes mid-call ("stop recording"), call revoke_recording_consent, then ask the permanent preference question again.`;
  }

  private getMemoryConsentSection(): string {
    return `## Memory Consent\nNear the END of the call, ask:\n"Can I remember things about you to personalize our calls?"\n\nIf YES: call grant_memory_consent.\nIf NO: call deny_memory_consent.\nIf unclear, ask up to 2 times, then say:\n"No problem, we can skip that for now. Just let me know if you'd like to discuss it later."`;
  }

  private getSharingConsentSection(): string {
    const tierDescription =
      this.options.sharingTier === 'tier_4'
        ? 'Complete Visibility'
        : this.options.sharingTier === 'tier_3'
          ? 'Full Summary'
          : this.options.sharingTier === 'tier_2'
            ? 'Wellness Check'
            : 'Basic Updates & Safety';
    const currentConsent = this.options.sharingConsent === 'denied' ? 'denied' : 'granted';

    if (this.options.sharingRePromptRequested) {
      return `## Family Sharing Preference Check\nOnly ask near the END of the call when prompted.\n\nAsk: "Your family asked if you'd like to adjust what I share with them. Would you like to share more, less, or keep things as they are?"\n- If they want to keep the current settings: call set_sharing_tier with tier="${this.options.sharingTier}" and consent="${currentConsent}".\n- If they want to share more or less: ask which level they prefer, then call set_sharing_tier with the chosen tier and consent="granted".\n- If they want to stop sharing entirely: call set_sharing_tier with tier="tier_1" and consent="denied".\n\nIf asked "what do you share": call get_sharing_tier and explain the current level.\nIf unclear, ask up to 2 times, then say:\n"No problem, we can skip that for now. Just let me know if you'd like to discuss it later."`;
    }

    return `## Family Sharing Consent\nOnly ask near the END of the call when needed.\n\nIf userType is family_managed:\nAsk: "Your family set this up because they care about you. I can send them a short weekly note—just that we talked and how you're doing overall. Nothing specific about what we discuss. Is that okay with you?"\n- If YES: call set_sharing_tier with tier="${this.options.sharingTier}" and consent="granted" (current default: ${tierDescription}).\n- If NO: call set_sharing_tier with tier="tier_1" and consent="denied".\n\nIf userType is self and they request sharing:\n- Call enable_family_sharing, then ask for tier preference.\n- After they choose, call set_sharing_tier with consent="granted".\n\nIf they say "share more/less" or "don't share with my family": call set_sharing_tier with the requested tier, and use consent="denied" for a full decline.\nIf asked "what do you share": call get_sharing_tier and explain the current level.\nIf unclear, ask up to 2 times, then say:\n"No problem, we can skip that for now. Just let me know if you'd like to discuss it later."`;
  }

  private getVadThreshold(): number {
    const tolerance = this.options.interruptionTolerance ?? 'normal';
    if (tolerance === 'high') return 0.35;
    if (tolerance === 'low') return 0.65;
    return VAD_THRESHOLD;
  }

  private getPrefixPaddingMs(): number {
    const patience = this.options.fillerWordPatience ?? 'normal';
    if (patience === 'high') return 500;
    if (patience === 'low') return 150;
    return 300;
  }

  private getSilenceDurationMs(): number {
    return this.options.silenceToleranceMs ?? VAD_SILENCE_DURATION_MS;
  }

  private refreshSessionInstructions(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const memoriesForPrompt = this.options.memoryEnabled ? this.options.memories : [];
    const tools = this.getActiveTools();

    this.sendMessage({
      type: 'session.update',
      session: {
        instructions: this.buildSystemPrompt({ memories: memoriesForPrompt }),
        tools,
      },
    });
  }

  private async refreshMemoryContext(reason: string): Promise<void> {
    try {
      const memories = await getMemoriesForLine(
        this.options.accountId,
        this.options.lineId,
        { limit: 150 }
      );
      if (this.options.memoryEnabled && memories.length > 0) {
        await markMemoriesAccessed(memories.map((memory) => memory.id));
      }
      const memoriesForPrompt = this.options.memoryEnabled ? memories : [];
      const tools = this.getActiveTools();

      this.sendMessage({
        type: 'session.update',
        session: {
          instructions: this.buildSystemPrompt({ memories: memoriesForPrompt }),
          tools,
        },
      });

      this.options.memories = memoriesForPrompt;
      logger.debug({ lineId: this.options.lineId }, 'Memory context refreshed');
    } catch (error) {
      logger.warn({
        error,
        callSessionId: this.options.callSessionId,
        reason,
      }, 'Failed to refresh memory context, continuing without refresh');
      void recordCallEvent(
        this.options.callSessionId,
        'error',
        { errorType: 'memory_refresh_failed', reason },
        { skipDebugLog: true }
      );
    }
  }

  private parseToolResponse(
    raw: string,
    toolName: string
  ): { success?: boolean } | null {
    try {
      return JSON.parse(raw) as { success?: boolean };
    } catch (error) {
      const errorType = error instanceof SyntaxError
        ? 'tool_response_invalid_json'
        : 'tool_response_parse_error';

      logger.warn({
        error,
        callSessionId: this.options.callSessionId,
        toolName,
      }, 'Failed to parse tool response');
      void recordCallEvent(
        this.options.callSessionId,
        'error',
        { errorType, reason: toolName },
        { skipDebugLog: true }
      );
      return null;
    }
  }

  private getActiveTools() {
    const retentionTools = new Set([
      'store_call_preview',
      'mark_preview_outcome',
      'log_segment_engagement',
      'manage_story_arc',
    ]);

    return GROK_TOOLS.filter((tool) => {
      if (tool.type !== 'function' || !tool.name) return true;

      if (tool.name === 'store_memory' || tool.name === 'update_memory') {
        return this.options.memoryEnabled;
      }
      if (tool.name === 'review_memories') {
        return this.options.memoryEnabled;
      }
      if (tool.name === 'grant_memory_consent' || tool.name === 'deny_memory_consent') {
        return this.options.needsMemoryConsent;
      }
      if (tool.name === 'grant_recording_consent' || tool.name === 'deny_recording_consent') {
        return this.options.needsRecordingConsent;
      }
      if (tool.name === 'revoke_recording_consent' || tool.name === 'set_recording_preference_permanent') {
        return this.options.recordingEnabled;
      }
      if (tool.name === 'set_sharing_tier' || tool.name === 'get_sharing_tier') {
        return this.options.userType === 'family_managed' || this.options.sharingEnabled;
      }
      if (tool.name === 'enable_family_sharing') {
        return this.options.userType === 'self' && !this.options.sharingEnabled;
      }
      if ((this.options.isReminderCall || this.options.isTestCall) && retentionTools.has(tool.name)) {
        return false;
      }
      return true;
    });
  }

  private sendMessage(message: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private triggerRecovery(type: 'error' | 'close', detail: string): void {
    this.options.onDisconnect?.(type, detail);
  }

  private handleTranscriptSafety(transcript: string): void {
    const multilingualEnabled = isMultilingualSafetyEnabled();
    const scanLanguage = multilingualEnabled ? this.detectedLanguage : 'en';
    const scanResult = scanForSafetyKeywords(
      transcript,
      scanLanguage,
      this.safetyState.triggeredTiers
    );

    if (scanResult.matches.length > 0) {
      this.handleSafetyBackstop(scanResult.matches);
      if (multilingualEnabled) {
        this.enqueueClassifierForSoftSignal('keyword');
      }
    }

    if (!multilingualEnabled) {
      return;
    }

    const heuristicResult = detectHeuristics(transcript);
    if (heuristicResult.triggered && heuristicResult.totalConfidence >= 0.6) {
      this.enqueueClassifierForSoftSignal('heuristic');
    }
  }

  private enqueueClassifierForSoftSignal(source: 'keyword' | 'heuristic'): void {
    const buffer = getBuffer(this.options.callSessionId);
    if (!buffer) return;

    const contextWindow = buildContextWindow(buffer.turns);
    enqueueClassifierJob(
      this.options.callSessionId,
      this.options.lineId,
      this.detectedLanguage ?? 'unknown',
      'soft_signal',
      contextWindow,
      undefined,
      source
    );
  }

  private startPeriodicSweeps(): void {
    this.stopPeriodicSweeps();

    if (!isMultilingualSafetyEnabled() || !isSafetySweepsEnabled()) {
      return;
    }

    if (!this.shouldRunSweepsForLanguage()) {
      return;
    }

    this.scheduleNextSweep();
  }

  private scheduleNextSweep(): void {
    const intervalMs = this.getSweepIntervalMs();
    if (!intervalMs) {
      return;
    }

    this.periodicSweepTimer = setTimeout(() => {
      this.runPeriodicSweep();
      this.scheduleNextSweep();
    }, intervalMs);
  }

  private stopPeriodicSweeps(): void {
    if (this.periodicSweepTimer) {
      clearTimeout(this.periodicSweepTimer);
      this.periodicSweepTimer = null;
    }
  }

  private shouldRunSweepsForLanguage(): boolean {
    const language = this.detectedLanguage;
    if (!language) return true;
    return language !== 'en' && language !== 'es';
  }

  private getSweepIntervalMs(): number {
    if (!this.shouldRunSweepsForLanguage()) {
      return 0;
    }

    const language = this.detectedLanguage;
    if (!language) {
      return randomBetween(60_000, 90_000);
    }

    const supportedNonEnEs = ['zh', 'tl', 'vi', 'fr', 'ar', 'ko', 'hi', 'ur'];
    if (supportedNonEnEs.includes(language)) {
      return 120_000;
    }

    return 60_000;
  }

  private runPeriodicSweep(): void {
    if (!isMultilingualSafetyEnabled() || !isSafetySweepsEnabled()) {
      return;
    }

    if (!this.shouldRunSweepsForLanguage()) {
      return;
    }

    const now = Date.now();
    if (now - this.lastSweepTime < 30_000) {
      return;
    }

    this.lastSweepTime = now;

    const buffer = getBuffer(this.options.callSessionId);
    if (!buffer || buffer.turns.length < 3) {
      return;
    }

    const contextWindow = buildContextWindow(buffer.turns);
    enqueueClassifierJob(
      this.options.callSessionId,
      this.options.lineId,
      this.detectedLanguage ?? 'unknown',
      'periodic_sweep',
      contextWindow,
      undefined,
      'sweep'
    );
  }

  private handleSafetyBackstop(matches: SafetyMatch[]): void {
    if (matches.length === 0) return;
    for (const match of matches) {
      const { tier } = match;
      this.safetyState.triggeredTiers.add(tier);
      this.safetyState.backstopTiersTriggered.add(tier);
    }

    this.safetyState.lastDetectionTime = Date.now();

    const tierPriority: SafetyTier[] = ['high', 'medium', 'low'];
    const highestTier = tierPriority.find((t) => matches.some((m) => m.tier === t)) ?? matches[0].tier;

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

    const SAFETY_HINTS: Record<SafetyTier, string> = {
      high: '[SYSTEM: Safety keywords detected (high severity). Assess user wellbeing immediately and call log_safety_concern. Consider suggesting 988 crisis line.]',
      medium: '[SYSTEM: Safety keywords detected (medium severity). Assess user wellbeing and call log_safety_concern if warranted.]',
      low: '[SYSTEM: Potential distress keywords detected. Please respond with empathy and assess if follow-up is needed.]',
    };

    const itemMessage = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'system',
        content: [{ type: 'input_text', text: SAFETY_HINTS[tier] }],
      },
    };

    this.ws.send(JSON.stringify(itemMessage));
    this.ws.send(JSON.stringify({ type: 'response.create' }));

    logger.debug({ tier }, 'Injected safety hint to model');
  }

  public sendSafetyAssessmentHint(source: 'sweep' | 'soft_signal' | 'model'): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const message = `[SYSTEM: Safety classifier flagged potential high-tier risk via ${source}. Ask a direct safety check and call log_safety_concern if warranted.]`;
    const itemMessage = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'system',
        content: [{ type: 'input_text', text: message }],
      },
    };

    this.ws.send(JSON.stringify(itemMessage));
    this.ws.send(JSON.stringify({ type: 'response.create' }));
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
            this.isGeneratingAudio = true;
            this.options.onAudioReceived(message.delta);
          }
          break;

        case 'response.audio.done':
          // Audio response complete
          this.isGeneratingAudio = false;
          break;

        case 'conversation.item.input_audio_transcription.completed': {
          const transcript = message.text || message.transcript || message.item?.output || '';
          if (transcript) {
            addTurn(this.options.callSessionId, this.extractUserTurn(transcript));
            this.handleTranscriptSafety(transcript);
          }
          break;
        }

        case 'response.done': {
          this.isGeneratingAudio = false;
          const turn = this.extractAssistantTurn(message);
          if (turn.summary) {
            addTurn(this.options.callSessionId, turn);
          }
          break;
        }

        case 'input_audio_buffer.speech_started':
          // User started speaking - clear any pending audio (barge-in)
          this.options.onClearBuffer();
          this.cancelCurrentResponse();
          if (this.isGeneratingAudio) {
            this.isGeneratingAudio = false;
            this.options.onBargeIn?.();
          }
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
      const baseUrl = getBackendUrl();
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
            daysOfWeek: args.days_of_week,
            timeLocal: args.time_local,
          });
          break;
        case 'skip_schedule':
          result = await this.callToolEndpoint(`${baseUrl}/tools/skip_schedule`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            scheduleId: args.schedule_id,
          });
          break;
        case 'snooze_schedule':
          result = await this.callToolEndpoint(`${baseUrl}/tools/snooze_schedule`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            scheduleId: args.schedule_id,
            snoozeMinutes: args.snooze_minutes,
          });
          break;
        case 'reschedule_schedule':
          result = await this.callToolEndpoint(`${baseUrl}/tools/reschedule_schedule`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            scheduleId: args.schedule_id,
            newDatetime: args.new_datetime_local,
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
            whatToForget: args.what_to_forget,
            permanent: args.permanent === true,
            confirmed: args.confirmed === true,
            clarification: args.clarification,
          });
          break;

        case 'store_memory':
          result = await this.callToolEndpoint(`${baseUrl}/tools/store_memory`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            memoryType: args.memory_type,
            key: args.key,
            value: args.value,
            confidence: args.confidence || 1.0,
            suggestReminder: args.suggest_reminder || false,
            expectedEndDate: args.expected_end_date,
            routineLevel: args.routine_level,
          });
          // Refresh context after storing
          void this.refreshMemoryContext('store_memory');
          break;

        case 'update_memory':
          result = await this.callToolEndpoint(`${baseUrl}/tools/update_memory`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            existingKey: args.existing_key,
            newValue: args.new_value,
            memoryType: args.memory_type,
            confidence: args.confidence || 1.0,
            confirmed: args.confirmed === true,
            clarification: args.clarification,
          });
          void this.refreshMemoryContext('update_memory');
          break;

        case 'grant_memory_consent': {
          const raw = await this.callToolEndpoint(`${baseUrl}/tools/grant_memory_consent`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
          });

          const parsed = this.parseToolResponse(raw, 'grant_memory_consent');
          this.options.onToolResult?.('grant_memory_consent', parsed?.success === true);
          if (parsed?.success) {
            this.options.needsMemoryConsent = false;
            this.options.memoryEnabled = true;
            markConsentGranted(this.options.callSessionId);
            void this.refreshMemoryContext('grant_memory_consent');
          }

          result = raw;
          break;
        }

        case 'deny_memory_consent': {
          const raw = await this.callToolEndpoint(`${baseUrl}/tools/deny_memory_consent`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
          });

          const parsed = this.parseToolResponse(raw, 'deny_memory_consent');
          this.options.onToolResult?.('deny_memory_consent', parsed?.success === true);
          if (parsed?.success) {
            this.options.needsMemoryConsent = false;
            this.options.memoryEnabled = false;
            void this.refreshMemoryContext('deny_memory_consent');
          }

          result = raw;
          break;
        }

        case 'grant_recording_consent': {
          const raw = await this.callToolEndpoint(`${baseUrl}/tools/grant_recording_consent`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
          });

          const parsed = this.parseToolResponse(raw, 'grant_recording_consent');
          this.options.onToolResult?.('grant_recording_consent', parsed?.success === true);
          if (parsed?.success) {
            this.options.needsRecordingConsent = false;
            this.options.recordingConsent = 'granted';
            this.refreshSessionInstructions();
          }

          result = raw;
          break;
        }

        case 'deny_recording_consent': {
          const raw = await this.callToolEndpoint(`${baseUrl}/tools/deny_recording_consent`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
          });

          const parsed = this.parseToolResponse(raw, 'deny_recording_consent');
          this.options.onToolResult?.('deny_recording_consent', parsed?.success === true);
          if (parsed?.success) {
            this.options.needsRecordingConsent = false;
            this.options.recordingConsent = 'denied';
            this.refreshSessionInstructions();
          }

          result = raw;
          break;
        }

        case 'revoke_recording_consent': {
          const raw = await this.callToolEndpoint(`${baseUrl}/tools/revoke_recording_consent`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
          });

          const parsed = this.parseToolResponse(raw, 'revoke_recording_consent');
          this.options.onToolResult?.('revoke_recording_consent', parsed?.success === true);
          if (parsed?.success) {
            this.options.needsRecordingConsent = false;
            this.options.recordingConsent = 'denied';
            this.refreshSessionInstructions();
          }

          result = raw;
          break;
        }

        case 'set_recording_preference_permanent': {
          const raw = await this.callToolEndpoint(`${baseUrl}/tools/set_recording_preference_permanent`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            never_ask: args.never_ask === true,
          });

          const parsed = this.parseToolResponse(raw, 'set_recording_preference_permanent');
          this.options.onToolResult?.('set_recording_preference_permanent', parsed?.success === true);
          if (parsed?.success) {
            this.refreshSessionInstructions();
          }

          result = raw;
          break;
        }

        case 'set_sharing_tier': {
          const raw = await this.callToolEndpoint(`${baseUrl}/tools/set_sharing_tier`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            tier: args.tier,
            consent: args.consent,
          });

          const parsed = this.parseToolResponse(raw, 'set_sharing_tier');
          this.options.onToolResult?.('set_sharing_tier', parsed?.success === true);
          if (parsed?.success) {
            const consent = args.consent === 'denied' ? 'denied' : 'granted';
            const tier = consent === 'denied' ? 'tier_1' : args.tier;
            if (tier) {
              this.options.sharingTier = tier;
            }
            this.options.sharingConsent = consent;
            this.options.sharingRePromptRequested = false;
            this.options.needsSharingConsent = false;
            this.refreshSessionInstructions();
          }

          result = raw;
          break;
        }

        case 'get_sharing_tier':
          result = await this.callToolEndpoint(`${baseUrl}/tools/get_sharing_tier`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
          });
          break;

        case 'enable_family_sharing': {
          const raw = await this.callToolEndpoint(`${baseUrl}/tools/enable_family_sharing`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
          });

          const parsed = this.parseToolResponse(raw, 'enable_family_sharing');
          this.options.onToolResult?.('enable_family_sharing', parsed?.success === true);
          if (parsed?.success) {
            this.options.sharingEnabled = true;
            this.options.needsSharingConsent = true;
            this.refreshSessionInstructions();
          }

          result = raw;
          break;
        }

        case 'mark_private':
          result = await this.callToolEndpoint(`${baseUrl}/tools/mark_private`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            whatToKeepPrivate: args.what_to_keep_private,
            confirmed: args.confirmed === true,
            clarification: args.clarification,
          });
          break;

        case 'exclude_memory_topic':
          result = await this.callToolEndpoint(`${baseUrl}/tools/exclude_topic`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            category: args.category,
          });
          void this.refreshMemoryContext('exclude_memory_topic');
          break;

        case 'include_memory_topic':
          result = await this.callToolEndpoint(`${baseUrl}/tools/include_topic`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            category: args.category,
          });
          void this.refreshMemoryContext('include_memory_topic');
          break;

        case 'list_topic_exclusions':
          result = await this.callToolEndpoint(`${baseUrl}/tools/list_topic_exclusions`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
          });
          break;

        case 'review_memories':
          result = await this.callToolEndpoint(`${baseUrl}/tools/review_memories`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            category: args.category,
          });
          break;

        case 'mark_topic_private':
          result = await this.callToolEndpoint(`${baseUrl}/tools/mark_topic_private`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            topic_code: args.topic_code,
          });
          break;

        case 'set_pause_mode':
          result = await this.callToolEndpoint(`${baseUrl}/tools/set_pause_mode`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            enabled: args.enabled,
            reason: args.reason,
          });
          break;

        case 'log_call_insights':
          result = await this.callToolEndpoint(`${baseUrl}/tools/log_call_insights`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            ...args,
          });
          break;

        case 'log_safety_concern':
          {
            const category = args.category as SafetyCategory;
            const effectiveTier = category === 'GENERAL_CONCERN'
              ? (args.tier as SafetyTier | undefined)
              : SAFETY_CATEGORY_TIERS[category];
            if (effectiveTier) {
              this.markTierTriggeredByModel(effectiveTier);
            }
            result = await this.callToolEndpoint(`${baseUrl}/tools/safety_event`, {
              callSessionId: this.options.callSessionId,
              lineId: this.options.lineId,
              category,
              tier: effectiveTier,
              confidence: args.confidence,
              actionTaken: args.action_taken,
              source: 'model',
            });
          }
          break;

        case 'report_conversation_language':
          result = await this.callToolEndpoint(`${baseUrl}/tools/report_conversation_language`, {
            callSessionId: this.options.callSessionId,
            languageCode: args.language_code,
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
            planId: args.plan_id,
            sendLink: args.send_link,
          });
          break;

        case 'store_call_preview':
          result = await this.callToolEndpoint(`${baseUrl}/tools/store_call_preview`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            topicType: args.topic_type,
            topicKey: args.topic_key,
            topicDisplay: args.topic_display,
            segmentType: args.segment_type,
            segmentContext: args.segment_context,
          });
          break;

        case 'mark_preview_outcome':
          result = await this.callToolEndpoint(`${baseUrl}/tools/mark_preview_outcome`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            outcome: args.outcome,
            previewId: args.preview_id || this.options.pendingCallPreview?.id,
          });
          break;

        case 'log_segment_engagement':
          result = await this.callToolEndpoint(`${baseUrl}/tools/log_segment_engagement`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            segmentType: args.segment_type,
            segmentDomain: args.segment_domain,
            segmentContext: args.segment_context,
            engagementSignals: args.engagement_signals,
            durationSeconds: args.duration_seconds,
            completed: args.completed,
            seniorResponse: args.senior_response,
            storyArcId: args.story_arc_id,
            chapterCompleted: args.chapter_completed,
          });
          break;

        case 'manage_story_arc':
          result = await this.callToolEndpoint(`${baseUrl}/tools/manage_story_arc`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            action: args.action,
            storyArcId: args.story_arc_id,
            storyType: args.story_type,
            title: args.title,
            description: args.description,
            totalChapters: args.total_chapters,
            chapterCompleted: args.chapter_completed,
            storyState: args.story_state,
          });
          break;
        case 'store_life_chapter':
          result = await this.callToolEndpoint(`${baseUrl}/tools/store_life_chapter`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            chapter_type: args.chapter_type,
            title: args.title,
            era_start_year: args.era_start_year,
            era_end_year: args.era_end_year,
            narrative_summary: args.narrative_summary,
            key_people: args.key_people,
            emotional_tone: args.emotional_tone,
          });
          break;
        case 'store_milestone':
          result = await this.callToolEndpoint(`${baseUrl}/tools/store_milestone`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            milestone_type: args.milestone_type,
            title: args.title,
            date_month: args.date_month,
            date_day: args.date_day,
            date_year: args.date_year,
            related_person_name: args.related_person_name,
            is_recurring: args.is_recurring,
          });
          break;
        case 'mark_milestone_celebrated':
          result = await this.callToolEndpoint(`${baseUrl}/tools/mark_milestone_celebrated`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            milestone_id: args.milestone_id,
            milestone_title: args.milestone_title,
          });
          break;
        case 'update_relationship':
          result = await this.callToolEndpoint(`${baseUrl}/tools/update_relationship`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            name: args.name,
            updates: args.updates,
          });
          break;
        case 'mark_relationship_deceased':
          result = await this.callToolEndpoint(`${baseUrl}/tools/mark_relationship_deceased`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            name: args.name,
            passed_at: args.passed_at,
            grief_sensitivity: args.grief_sensitivity,
          });
          break;
        case 'log_mood_snapshot':
          result = await this.callToolEndpoint(`${baseUrl}/tools/log_mood_snapshot`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            mood_start: args.mood_start,
            mood_mid: args.mood_mid,
            mood_end: args.mood_end,
            mood_trajectory: args.mood_trajectory,
            techniques_used: args.techniques_used,
            energy_level: args.energy_level,
          });
          break;
        case 'log_cognitive_observation':
          result = await this.callToolEndpoint(`${baseUrl}/tools/log_cognitive_observation`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            observation_type: args.observation_type,
            severity: args.severity,
            context: args.context,
            response_given: args.response_given,
          });
          break;
        case 'adjust_accessibility':
          result = await this.callToolEndpoint(`${baseUrl}/tools/adjust_accessibility`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            setting: args.setting,
            value: args.value,
            source: args.source,
          });
          break;
        case 'update_content_preference':
          result = await this.callToolEndpoint(`${baseUrl}/tools/update_content_preference`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            content_type: args.content_type,
            preference_change: args.preference_change,
            specific_update: args.specific_update,
          });
          break;
        case 'log_health_mention':
          result = await this.callToolEndpoint(`${baseUrl}/tools/log_health_mention`, {
            callSessionId: this.options.callSessionId,
            lineId: this.options.lineId,
            category: args.category,
            summary: args.summary,
            severity: args.severity,
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
    const messageContent = output?.find((o) => o.type === 'message')?.content;
    const textContent = messageContent?.find((c: any) => c.transcript || c.text);
    const transcript = textContent?.transcript ?? textContent?.text ?? '';

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
    const start = Date.now();
    const toolName = url.split('/').pop();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': getInternalApiSecret(),
      },
      body: JSON.stringify(body),
    });

    logger.debug({
      method: 'POST',
      url,
      toolName,
      statusCode: response.status,
      durationMs: Date.now() - start,
    }, 'Tool endpoint response');

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
            name: 'log_safety_concern',
            description: 'INTERNAL: Log when you detect signs of distress, depression, self-harm ideation, or crisis. Do NOT call this for normal sad feelings. Only for genuine safety concerns.',
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
                  description: 'Confidence score (0.0-1.0)',
                },
                action_taken: {
                  type: 'string',
                  enum: ['none', 'suggested_988', 'suggested_911'],
                  description: 'What action you recommended',
                },
              },
              required: ['category', 'confidence', 'action_taken'],
            },
          },
        ],
      },
    };

    this.ws.send(JSON.stringify(itemMessage));

    // Trigger a response
    this.ws.send(JSON.stringify({ type: 'response.create' }));
  }

  public updateCallbacks(
    callbacks: Partial<Pick<GrokBridgeOptions, 'onAudioReceived' | 'onClearBuffer' | 'onError' | 'onToolCall' | 'onToolResult' | 'onBargeIn' | 'onDisconnect'>>
  ): void {
    this.options = { ...this.options, ...callbacks };
  }

  public isConnectedToGrok(): boolean {
    return this.isConnected;
  }

  private cancelCurrentResponse(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({ type: 'response.cancel' }));
    this.isGeneratingAudio = false;
    logger.debug({ callSessionId: this.options.callSessionId }, 'Canceled Grok response due to barge-in');
  }

  public async reconnect(): Promise<boolean> {
    try {
      if (this.ws) {
        this.suppressDisconnect = true;
        this.ws.removeAllListeners();
        this.ws.close();
        this.ws = null;
      }

      this.isConnected = false;
      this.suppressDisconnect = false;
      await this.connect(GROK_RECONNECT_TIMEOUT_MS);
      return true;
    } catch (error) {
      logger.error({ error, callSessionId: this.options.callSessionId }, 'Grok reconnection failed');
      return false;
    }
  }

  public forceClose(): void {
    if (this.ws) {
      this.ws.close(1011, 'Simulated failure for testing');
    }
  }

  public setDetectedLanguage(code: string): void {
    const previousLanguage = this.detectedLanguage;
    this.detectedLanguage = code;

    if (previousLanguage !== code) {
      this.stopPeriodicSweeps();
      this.startPeriodicSweeps();
    }
  }

  public getDetectedLanguage(): string | null {
    return this.detectedLanguage;
  }

  // Close the connection
  close(): void {
    this.stopPeriodicSweeps();
    clearJobsForSession(this.options.callSessionId);

    if (this.ws) {
      this.suppressDisconnect = true;
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}
