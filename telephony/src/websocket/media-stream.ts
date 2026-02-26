// Twilio Media Stream WebSocket handler
// Bridges Twilio audio to xAI Grok Voice Agent

import { WebSocket } from 'ws';
import type { Span } from '@opentelemetry/api';
import { logger } from '../server.js';
import { getCallSession, updateCallStatus, completeCallSession, recordCallEvent, recordDebugEvent } from '../services/call-session.js';
import { getLineById, recordOptOut } from '../services/line-lookup.js';
import { getMemoriesForLine, markMemoriesAccessed } from '../services/memory.js';
import { createBuffer, clearBuffer, getBuffer } from '../services/ephemeral-buffer.js';
import { summarizeAndExtractMemoriesFromBuffer } from '../services/call-summarization.js';
import { extractFallbackInsightsFromBuffer } from '../services/insights-fallback.js';
import {
  calculateBillableMinutes,
  getUsageSummary,
  releaseTrialDailyCap,
  reserveTrialDailyCap,
} from '../services/metering.js';
import { getStartingLanguageForLine } from '../services/language.js';
import { getMemoryDEK } from '../services/line-encryption.js';
import { getAccountPrivacySettings, getLineVoiceConsent, updateLineVoiceConsent, logConsentAuditEvent } from '../services/privacy.js';
import { buildRetentionContext, type RetentionContext } from '../services/retention-context.js';
import { buildPromptPlaceholders } from '../services/prompt-context.js';
import { registerActiveCall, unregisterActiveCall } from '../services/active-calls.js';
import { GrokBridge } from './grok-bridge.js';
import type { AccountStatus, PlanId } from '@ultaura/types';
import { summarizeArgs } from '../utils/redact.js';
import { buildReminderMessageAAD, decryptReminderMessageWithDek } from '../utils/reminder-crypto.js';
import { getSupabaseClient } from '../utils/supabase.js';
import { registerGrokBridge, unregisterGrokBridge, getGrokBridge } from './grok-bridge-registry.js';
import { takeLifeNoteForCallSession } from './life-note-store.js';
import { getFallbackMessage } from '../utils/fallback-messages.js';
import {
  FALLBACK_TTS_WAIT_MS,
  GROK_RECONNECT_MAX_ATTEMPTS,
  GROK_RECONNECT_TIMEOUT_MS,
  TRIAL_DAILY_LIMIT_MINUTES,
} from '../utils/constants.js';
import { getTwilioClient, getVoiceConfigForLanguage, getVoiceForLanguage, generateStreamTwiML } from '../utils/twilio.js';
import { getWebsocketUrl } from '../utils/env.js';
import { runWithLogContext, updateLogContext, withLogContext, type LogContext } from '../observability/log-context.js';
import { runWithSpan, startSpan, SpanKind } from '../observability/tracing.js';
import { sendRoutingAlert } from '../services/routing-alerts.js';
import { recordVoiceDisconnect, voiceBargeInTotal, voiceRoutingIssuesTotal, voiceTimeToFirstAudioMs } from '../utils/metrics.js';

interface TwilioMessage {
  event: 'connected' | 'start' | 'media' | 'dtmf' | 'stop' | 'mark';
  streamSid?: string;
  start?: {
    streamSid: string;
    callSid: string;
    accountSid: string;
    tracks: string[];
    customParameters: Record<string, string>;
  };
  media?: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string; // base64 encoded μ-law audio
  };
  dtmf?: {
    track: string;
    digit: string;
  };
  mark?: {
    name: string;
  };
}

interface ConsentState {
  recordingConsentReceived: boolean;
  memoryConsentReceived: boolean;
  sharingConsentReceived: boolean;
}

const PLAN_OPTIONS = [
  { id: 'care', name: 'Care', minutes: 200, price: '$19 per month' },
  { id: 'comfort', name: 'Comfort', minutes: 600, price: '$49 per month' },
  { id: 'family', name: 'Family', minutes: 1200, price: '$99 per month' },
  { id: 'payg', name: 'Pay as you go', minutes: null, price: '$0 per month plus $0.15 per minute' },
];

// Handle a new Twilio Media Stream connection
export async function handleMediaStreamConnection(
  ws: WebSocket,
  callSessionId: string,
  options: { span?: Span; logContext?: LogContext } = {}
): Promise<void> {
  const logContext: LogContext = options.logContext ?? { callSessionId };
  const wsSpan = options.span ?? startSpan('twilio.media_stream.session', {
    kind: SpanKind.SERVER,
    attributes: { callSessionId },
  });
  wsSpan?.setAttribute('callSessionId', callSessionId);

  const withContext = <T extends (...args: any[]) => any>(fn: T): T =>
    withLogContext(
      logContext,
      ((...args: Parameters<T>) => runWithSpan(wsSpan, () => fn(...args))) as T
    );

  runWithLogContext(logContext, () => runWithSpan(wsSpan, () => {
    logger.info({ callSessionId }, 'Media stream connection started');
  }));

  let twilioStreamSid: string | null = null;
  let twilioCallSid: string | null = null;
  let grokBridge: GrokBridge | null = null;
  let isConnected = false;
  let connectedAt: string | null = null;
  let pendingOptOut = false;
  let trialExpiryTimeout: NodeJS.Timeout | null = null;
  let trialCapWrapUpTimeout: NodeJS.Timeout | null = null;
  let trialCapForceCloseTimeout: NodeJS.Timeout | null = null;
  let overagePromptTimeout: NodeJS.Timeout | null = null;
  let overagePromptActive = false;
  let isReconnecting = false;
  let reconnectAttempts = 0;
  let keepBridgeAlive = false;
  let startingLanguage = 'en';
  let isLanguageAutoDetect = false;
  let consentState: ConsentState | null = null;
  let consentRequirements: { recording: boolean; memory: boolean; sharing: boolean } | null = null;
  let shouldTrackOnboarding = false;
  let streamStartedAtMs: number | null = null;
  let firstAudioSent = false;
  let forcedEndReason: 'trial_cap' | null = null;
  let trialReservationReleased = false;

  // Get session info
  const session = await getCallSession(callSessionId);
  if (!session) {
    logger.error({ callSessionId }, 'Session not found for media stream');
    ws.close(1008, 'Session not found');
    wsSpan?.end();
    return;
  }

  // Get line and account info
  const lineWithAccount = await getLineById(session.line_id);
  if (!lineWithAccount) {
    logger.error({ callSessionId }, 'Line not found for session');
    ws.close(1008, 'Line not found');
    wsSpan?.end();
    return;
  }

  const { line, account } = lineWithAccount;
  const isPayg = account.plan_id === 'payg';
  let reminderMessage: string | null = null;

  if (session.is_reminder_call && session.reminder_id) {
    const supabase = getSupabaseClient();
    const { data: reminder, error: reminderError } = await supabase
      .from('ultaura_reminders')
      .select('id, message, message_ciphertext, message_iv, message_tag')
      .eq('id', session.reminder_id)
      .eq('line_id', session.line_id)
      .eq('account_id', session.account_id)
      .single();

    if (reminderError) {
      logger.error({ error: reminderError, reminderId: session.reminder_id }, 'Failed to load reminder message');
    } else if (reminder) {
      if (reminder.message_ciphertext && reminder.message_iv && reminder.message_tag) {
        try {
          const dek = await getMemoryDEK(supabase, account.id, line.id);
          const aad = buildReminderMessageAAD(account.id, line.id, reminder.id);
          reminderMessage = decryptReminderMessageWithDek(
            dek,
            {
              ciphertext: reminder.message_ciphertext,
              iv: reminder.message_iv,
              tag: reminder.message_tag,
            },
            aad
          );
        } catch (decryptError) {
          logger.error({ error: decryptError, reminderId: reminder.id }, 'Failed to decrypt reminder message');
        }
      } else if (reminder.message) {
        reminderMessage = reminder.message;
      }
    }

    if (reminderMessage && reminderMessage.trim().length === 0) {
      reminderMessage = null;
    }
  }

  const formatPlanOptions = () =>
    PLAN_OPTIONS.map((option) =>
      option.minutes
        ? `${option.name} (${option.minutes} minutes per month, ${option.price})`
        : `${option.name} (${option.price})`
    ).join('; ');

  const getMinutesStatus = async () => {
    // Trial accounts are handled by daily reservation/timer enforcement.
    if (account.status === 'trial') {
      return { remaining: 0, warn: false, critical: false };
    }

    if (isPayg) {
      return { remaining: 0, warn: false, critical: false };
    }

    const usage = await getUsageSummary(account.id);
    const remaining = usage?.minutesRemaining ?? 0;

    return {
      remaining,
      warn: remaining > 0 && remaining <= 15,
      critical: remaining > 0 && remaining <= 5,
    };
  };

  const clearOveragePrompt = () => {
    overagePromptActive = false;
    if (overagePromptTimeout) clearTimeout(overagePromptTimeout);
    overagePromptTimeout = null;
  };

  const clearTrialCapTimers = () => {
    if (trialCapWrapUpTimeout) {
      clearTimeout(trialCapWrapUpTimeout);
      trialCapWrapUpTimeout = null;
    }
    if (trialCapForceCloseTimeout) {
      clearTimeout(trialCapForceCloseTimeout);
      trialCapForceCloseTimeout = null;
    }
  };

  const scheduleTrialCapTimers = (reservedMinutes: number) => {
    if (!grokBridge || reservedMinutes <= 0) {
      return;
    }

    clearTrialCapTimers();

    const totalMs = reservedMinutes * 60 * 1000;
    const graceMs = 30 * 1000;
    const wrapUpDelayMs = Math.max(totalMs - graceMs, 0);

    trialCapWrapUpTimeout = setTimeout(() => {
      if (!grokBridge || ws.readyState !== WebSocket.OPEN) {
        return;
      }

      grokBridge.sendTextInput(
        `SYSTEM: The trial daily minute limit (${TRIAL_DAILY_LIMIT_MINUTES} minutes/day) is about to be reached. Please warmly wrap up this call and say goodbye within 30 seconds.`
      );
    }, wrapUpDelayMs);

    trialCapForceCloseTimeout = setTimeout(() => {
      forcedEndReason = 'trial_cap';
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Trial daily cap reached');
      }
    }, totalMs);
  };

  const sendOveragePrompt = () => {
    if (!grokBridge || overagePromptActive) return;

    overagePromptActive = true;
    const planOptions = formatPlanOptions();
    grokBridge.sendTextInput(
      `SYSTEM: The user has 0 included minutes remaining. Continuing will incur overage charges at $0.15 per minute. At the start of the call, explain this and ask if they would like to continue with overage charges, upgrade, or stop the call. If they want to upgrade, offer these options: ${planOptions}. Ask which plan they prefer. Once they decide, call choose_overage_action with action "continue", "upgrade", or "stop". If upgrading, include plan_id ("care", "comfort", "family", or "payg"). Do not ask for payment details; tell them you will email a secure link to the billing email on file. If they do not respond within one minute, give a short warm goodbye and end the call.`
    );

    overagePromptTimeout = setTimeout(() => {
      if (!overagePromptActive || !grokBridge) return;

      grokBridge.sendTextInput(
        'SYSTEM: The user did not respond. Give a short warm goodbye and end the call now.'
      );

      if (ws.readyState === WebSocket.OPEN) {
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) ws.close(1000, 'No response to overage prompt');
        }, 15000);
      }
    }, 60000);
  };

  // Handle messages from Twilio
  ws.on('message', withContext(async (data: Buffer) => {
    try {
      const message: TwilioMessage = JSON.parse(data.toString());

      if (message.event !== 'media') {
        logger.debug({ callSessionId, event: message.event }, 'Twilio stream event');
      }

      switch (message.event) {
        case 'connected':
          logger.info({ callSessionId }, 'Twilio stream connected');
          break;

        case 'start':
          twilioStreamSid = message.start?.streamSid || null;
          twilioCallSid = message.start?.callSid || null;
          streamStartedAtMs = Date.now();
          firstAudioSent = false;

          if (twilioCallSid) {
            logContext.twilioCallSid = twilioCallSid;
            updateLogContext({ twilioCallSid });
            wsSpan?.setAttribute('twilioCallSid', twilioCallSid);
          }

          if (twilioStreamSid) {
            logContext.twilioStreamSid = twilioStreamSid;
            updateLogContext({ twilioStreamSid });
            wsSpan?.setAttribute('twilioStreamSid', twilioStreamSid);
          }

          logger.info({ callSessionId, twilioCallSid, twilioStreamSid }, 'Twilio stream started');
          registerActiveCall(callSessionId);

          // Initialize Grok bridge
          try {
            createBuffer(callSessionId, line.id, account.id);

            const [privacySettings, voiceConsent] = await Promise.all([
              getAccountPrivacySettings(account.id),
              getLineVoiceConsent(line.id),
            ]);

            const aiSummarizationEnabled = privacySettings?.aiSummarizationEnabled ?? true;
            const memoryConsent = voiceConsent?.memoryConsent ?? 'pending';
            const lastPromptAt = voiceConsent?.lastConsentPromptAt;
            const consentCooldownMs = 30 * 24 * 60 * 60 * 1000;
            const canPromptAfterDenial = !lastPromptAt ||
              (Date.now() - new Date(lastPromptAt).getTime() > consentCooldownMs);
            let needsMemoryConsent = aiSummarizationEnabled && (
              memoryConsent === 'pending' ||
              (memoryConsent === 'denied' && canPromptAfterDenial)
            );
            const recordingEnabled = process.env.ULTAURA_ENABLE_RECORDING === 'true' &&
              !!privacySettings?.recordingEnabled;
            const recordingConsent = voiceConsent?.recordingConsent ?? 'pending';
            const recordingPreferencePermanent = voiceConsent?.recordingPreferencePermanent ?? false;
            const recordingReenableRequested = Boolean(voiceConsent?.recordingReenableRequestedAt);
            const recordingReenableDeclineCount = voiceConsent?.recordingReenableDeclineCount ?? 0;
            const recordingReenableBlockedAt = voiceConsent?.recordingReenableBlockedAt;
            const recordingReenableBlocked = Boolean(recordingReenableBlockedAt) || recordingReenableDeclineCount >= 1;
            let needsRecordingConsent = recordingEnabled && !(
              recordingPreferencePermanent && recordingConsent === 'denied'
            );
            if (recordingReenableRequested && !recordingReenableBlocked) {
              needsRecordingConsent = recordingEnabled;
            }

            const sharingConsent = voiceConsent?.sharingConsent ?? 'pending';
            const sharingTier = voiceConsent?.sharingTier ?? 'tier_1';
            const sharingRePromptRequested = Boolean(voiceConsent?.sharingRePromptRequestedAt);
            const insightsRepromptRequested = Boolean(voiceConsent?.insightsRepromptRequestedAt);
            const userType = account.user_type;
            const sharingEnabled = account.sharing_enabled;
            let needsSharingConsent = false;

            if (userType === 'family_managed') {
              needsSharingConsent = sharingConsent === 'pending' || sharingRePromptRequested;
            } else if (userType === 'self' && sharingEnabled) {
              needsSharingConsent = sharingConsent === 'pending' || sharingRePromptRequested;
            }

            const isPreviewMode = session.is_preview_mode;
            const isQuickTest = session.is_test_call && !isPreviewMode;

            if (isPreviewMode) {
              needsMemoryConsent = aiSummarizationEnabled;
              needsRecordingConsent = recordingEnabled;
              needsSharingConsent = userType === 'family_managed' ||
                (userType === 'self' && sharingEnabled) ||
                sharingRePromptRequested;
            } else if (isQuickTest) {
              needsMemoryConsent = false;
              needsRecordingConsent = false;
              needsSharingConsent = false;
            }

            if (
              sharingRePromptRequested &&
              needsSharingConsent &&
              !session.is_test_call &&
              !isPreviewMode
            ) {
              const cleared = await updateLineVoiceConsent(
                line.id,
                account.id,
                callSessionId,
                {
                  sharingRePromptRequestedAt: null,
                  sharingLastPromptAt: new Date().toISOString(),
                },
                { skipPersist: false }
              );

              if (!cleared) {
                logger.warn({ callSessionId, lineId: line.id }, 'Failed to clear sharing re-prompt flag');
              }
            }

            const memoryEnabled = aiSummarizationEnabled && memoryConsent === 'granted' && !session.is_test_call;

            // Fetch memories for the line (use empty list when memory is disabled)
            const memories = await getMemoriesForLine(account.id, line.id, { limit: 150 });
            let memoriesForPrompt = memoryEnabled ? memories : [];

            if (memoryEnabled && account.user_type === 'family_managed') {
              const filtered = memoriesForPrompt.filter((memory) => memory.privacyScope !== 'line_only');
              const filteredCount = memoriesForPrompt.length - filtered.length;
              if (filteredCount > 0) {
                logger.info({
                  callSessionId,
                  lineId: line.id,
                  totalMemories: memoriesForPrompt.length,
                  filteredCount,
                }, 'Filtered private memories from family_managed call context');
              }
              memoriesForPrompt = filtered;
            }

            if (memoryEnabled && memoriesForPrompt.length > 0) {
              await markMemoriesAccessed(memoriesForPrompt.map((memory) => memory.id));
            }

            // Check if this is the first call
            const onboardingCompletedAt = voiceConsent?.onboardingCompletedAt;
            let isFirstCall = !onboardingCompletedAt;
            if (isPreviewMode) {
              isFirstCall = true;
            } else if (isQuickTest) {
              isFirstCall = false;
            }
            const languageResult = await getStartingLanguageForLine(line.id);
            startingLanguage = languageResult.language;
            isLanguageAutoDetect = languageResult.isAutoDetect;

            consentState = {
              recordingConsentReceived: false,
              memoryConsentReceived: false,
              sharingConsentReceived: false,
            };
            consentRequirements = {
              recording: needsRecordingConsent,
              memory: needsMemoryConsent,
              sharing: needsSharingConsent,
            };
            shouldTrackOnboarding = !onboardingCompletedAt && !session.is_test_call && !isPreviewMode;

            let retentionContext: RetentionContext = {
              pendingPreview: null,
              segmentPreferences: null,
              activeStoryArcs: [],
            };
            if (!session.is_reminder_call && !session.is_test_call) {
              try {
                retentionContext = await buildRetentionContext(line.id);
              } catch (err) {
                logger.error({ error: err, callSessionId, lineId: line.id }, 'Failed to build retention context');
              }
            }

            let promptPlaceholders: Record<string, string> = {};
            try {
              promptPlaceholders = await buildPromptPlaceholders({
                accountId: account.id,
                line,
                activeStoryArcs: retentionContext.activeStoryArcs,
              });
            } catch (error) {
              logger.warn({ error, callSessionId, lineId: line.id }, 'Failed to build prompt placeholders');
            }
            promptPlaceholders.insightsRepromptRequested = insightsRepromptRequested ? 'true' : 'false';

            let trialReservedMinutes: number | null = null;
            if (account.status === 'trial') {
              const reservation = await reserveTrialDailyCap({
                accountId: account.id,
                lineTimezone: line.timezone,
                callSessionId,
              });

              if (!reservation || !reservation.allowed || reservation.reservedMinutes <= 0) {
                forcedEndReason = 'trial_cap';
                await completeCallSession(callSessionId, {
                  endReason: 'trial_cap',
                  languageDetected: startingLanguage,
                });
                clearBuffer(callSessionId);

                if (ws.readyState === WebSocket.OPEN) {
                  ws.close(1000, 'Trial daily cap reached');
                }
                return;
              }

              trialReservedMinutes = reservation.reservedMinutes;
            }

            // Check minutes status
            const minutesStatus = await getMinutesStatus();
            const minutesRemaining = account.status === 'trial'
              ? (trialReservedMinutes ?? 0)
              : minutesStatus.remaining;
            const shouldPromptOverage =
              account.status !== 'trial' && !isPayg && minutesRemaining <= 0 && !session.is_reminder_call;

            const onAudioReceived = (audioBase64: string) => {
              if (streamStartedAtMs !== null && !firstAudioSent) {
                firstAudioSent = true;
                const latencyMs = Date.now() - streamStartedAtMs;
                const direction = session.direction === 'inbound' ? 'inbound' : 'outbound';
                const isReminderCall = session.is_reminder_call ? 'true' : 'false';
                voiceTimeToFirstAudioMs.observe({ direction, isReminderCall }, latencyMs);
                wsSpan?.setAttribute('voice.first_audio.latency_ms', latencyMs);
                wsSpan?.addEvent('voice.first_audio', {
                  latency_ms: latencyMs,
                  direction,
                  is_reminder_call: isReminderCall,
                });
              }

              // Send audio back to Twilio
              if (ws.readyState === WebSocket.OPEN && twilioStreamSid) {
                ws.send(JSON.stringify({
                  event: 'media',
                  streamSid: twilioStreamSid,
                  media: { payload: audioBase64 },
                }));
              }
            };

            const onClearBuffer = () => {
              // Clear Twilio's buffer (for barge-in)
              if (ws.readyState === WebSocket.OPEN && twilioStreamSid) {
                ws.send(JSON.stringify({
                  event: 'clear',
                  streamSid: twilioStreamSid,
                }));
              }
            };

            const onError = (error: Error) => {
              logger.error({ error, callSessionId }, 'Grok bridge error');
            };

            const onToolCall = async (toolName: string, args: Record<string, unknown>) => {
              const argsSummary = summarizeArgs(args);
              logger.debug({
                callSessionId,
                toolName,
                argsSummary,
              }, 'Tool call from Grok');
              const phoneLast4 = line.phone_e164 ? line.phone_e164.slice(-4) : null;
              await recordDebugEvent(
                callSessionId,
                'tool_call',
                { tool: toolName, argsSummary },
                {
                  line_id: line.id,
                  phone_number_last4: phoneLast4,
                },
                {
                  accountId: account.id,
                  toolName,
                }
              );

              if (toolName === 'choose_overage_action' && typeof args.action === 'string') {
                clearOveragePrompt();

                if (args.action === 'stop' && ws.readyState === WebSocket.OPEN) {
                  setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.close(1000, 'User requested to stop');
                    }
                  }, 15000);
                }
              }

              if (consentState) {
                // Consent state updates happen on tool result, not invocation.
              }
            };

            const onToolResult = (toolName: string, success: boolean) => {
              if (!success || !consentState) {
                return;
              }

              if (toolName === 'grant_memory_consent' || toolName === 'deny_memory_consent') {
                consentState.memoryConsentReceived = true;
              }
              if (
                toolName === 'grant_recording_consent' ||
                toolName === 'deny_recording_consent' ||
                toolName === 'revoke_recording_consent'
              ) {
                consentState.recordingConsentReceived = true;
              }
              if (toolName === 'set_sharing_tier') {
                consentState.sharingConsentReceived = true;
              }
            };

            const onBargeIn = () => {
              voiceBargeInTotal.inc();
              recordCallEvent(callSessionId, 'state_change', {
                event: 'barge_in',
              }, { skipDebugLog: true }).catch(err => {
                logger.error({ error: err, callSessionId }, 'Failed to record barge-in event');
              });
            };

            const onDisconnect = async (type: 'error' | 'close', detail: string) => {
              if (isReconnecting) {
                return;
              }

              if (reconnectAttempts >= GROK_RECONNECT_MAX_ATTEMPTS) {
                logger.warn({ callSessionId, type, detail }, 'Grok disconnect ignored after max retries');
                return;
              }

              isReconnecting = true;
              reconnectAttempts += 1;
              keepBridgeAlive = true;

              logger.warn({ callSessionId, type, detail }, 'Grok disconnected mid-call, attempting recovery');

              await recordCallEvent(callSessionId, 'error', {
                errorType: 'grok_disconnect_mid_call',
                code: type,
                reason: detail,
              });

              const detectedLanguage = grokBridge?.getDetectedLanguage() ?? 'en';
              const waitMessage = getFallbackMessage(detectedLanguage, 'retry_wait');
              await playFallbackTTS(twilioCallSid, waitMessage, detectedLanguage, {
                pauseSeconds: Math.ceil(GROK_RECONNECT_TIMEOUT_MS / 1000),
              });

              if (ws.readyState !== WebSocket.OPEN) {
                logger.warn({ callSessionId }, 'Twilio WS closed during fallback TTS, aborting recovery');
                isReconnecting = false;
                return;
              }

              const reconnected = grokBridge ? await grokBridge.reconnect() : false;

              if (reconnected) {
                logger.info({ callSessionId }, 'Grok reconnection successful');
                reconnectAttempts = 0;
                isReconnecting = false;

                if (ws.readyState === WebSocket.OPEN) {
                  keepBridgeAlive = false;
                  return;
                }

                await reconnectMediaStream(twilioCallSid, callSessionId);
                return;
              }

              logger.error({ callSessionId }, 'Grok reconnection failed, ending call');
              logger.error({
                event: 'call_pod_failure',
                callSessionId,
                reconnectAttempts,
                podName: process.env.HOSTNAME,
                timestamp: new Date().toISOString(),
              }, 'Call ended due to pod failure');

              const failedMessage = getFallbackMessage(detectedLanguage, 'retry_failed');
              recordVoiceDisconnect(callSessionId, 'pod_failure');
              await playFallbackTTS(twilioCallSid, failedMessage, detectedLanguage, { hangup: true });
              await sleep(FALLBACK_TTS_WAIT_MS);

              await completeCallSession(callSessionId, {
                endReason: 'error',
                languageDetected: detectedLanguage,
              });
              clearBuffer(callSessionId);

              if (ws.readyState === WebSocket.OPEN) {
                ws.close(1000, 'AI service unavailable after retry');
              }

              keepBridgeAlive = false;
              isReconnecting = false;
              grokBridge?.close();
              unregisterGrokBridge(callSessionId);
            };

            const existingBridge = getGrokBridge(callSessionId);

            if (!existingBridge && session.status === 'in_progress') {
              voiceRoutingIssuesTotal.inc({ issue: 'bridge_missing_on_reconnect' });
              void sendRoutingAlert({
                callSessionId,
                issue: 'bridge_missing_on_reconnect',
                severity: 'high',
                details: {
                  podName: process.env.HOSTNAME,
                  twilioCallSid,
                  twilioStreamSid,
                  sessionStatus: session.status,
                  isReminderCall: session.is_reminder_call,
                  isTestCall: session.is_test_call,
                  isPreviewMode: session.is_preview_mode,
                  lineId: session.line_id,
                  accountId: session.account_id,
                },
              });
            }

            if (existingBridge) {
              grokBridge = existingBridge;
              grokBridge.updateTwilioContext({ twilioCallSid, twilioStreamSid });
              grokBridge.updateCallbacks({
                onAudioReceived,
                onClearBuffer,
                onError,
                onToolCall,
                onToolResult,
                onBargeIn,
                onDisconnect,
              });
            } else {
              const lifeNote = takeLifeNoteForCallSession(callSessionId);
              grokBridge = new GrokBridge({
                callSessionId,
                twilioCallSid,
                twilioStreamSid,
                lineId: line.id,
                accountId: account.id,
                userName: line.display_name,
                timezone: line.timezone,
                preferredGrokVoice: line.preferred_grok_voice,
                startingLanguage,
                isLanguageAutoDetect,
                isFirstCall,
                memories: memoriesForPrompt,
                memoryEnabled,
                needsMemoryConsent,
                seedInterests: line.seed_interests,
                seedAvoidTopics: line.seed_avoid_topics,
                lowMinutesWarning: minutesStatus.warn,
                minutesRemaining,
                isReminderCall: session.is_reminder_call,
                reminderMessage,
                isTestCall: session.is_test_call,
                isPreviewMode: session.is_preview_mode,
                userType,
                sharingEnabled,
                recordingEnabled,
                recordingConsent,
                recordingReenableRequested,
                needsRecordingConsent,
                sharingTier,
                sharingConsent,
                sharingRePromptRequested,
                needsSharingConsent,
                onboardingCompleted: Boolean(onboardingCompletedAt),
                currentPlanId: account.plan_id as PlanId,
                accountStatus: account.status as AccountStatus,
                promptPlaceholders,
                canReceiveInboundCalls: line.inbound_allowed,
                pendingCallPreview: retentionContext.pendingPreview,
                segmentPreferences: retentionContext.segmentPreferences,
                activeStoryArcs: retentionContext.activeStoryArcs,
                lifeNote,
                interruptionTolerance: line.interruption_tolerance,
                fillerWordPatience: line.filler_word_patience,
                silenceToleranceMs: line.silence_tolerance_ms,
                crosstalkRecoveryMode: line.crosstalk_recovery_mode,
                onAudioReceived,
                onClearBuffer,
                onError,
                onToolCall,
                onToolResult,
                onBargeIn,
                onDisconnect,
              });

              registerGrokBridge(callSessionId, grokBridge);
            }

            if (!grokBridge.isConnectedToGrok()) {
              await grokBridge.connect();
            }

            isConnected = grokBridge.isConnectedToGrok();
            connectedAt = new Date().toISOString();

            if (shouldPromptOverage) {
              sendOveragePrompt();
            }

            if (account.status === 'trial' && trialReservedMinutes && isConnected) {
              scheduleTrialCapTimers(trialReservedMinutes);
            }

            // If the trial expires mid-call, let the call continue but add a gentle wrap-up note.
            if (account.status === 'trial' && account.trial_ends_at && !session.is_reminder_call) {
              const trialEndsMs = new Date(account.trial_ends_at).getTime();
              const msUntilTrialEnds = trialEndsMs - Date.now();

              if (msUntilTrialEnds > 0 && msUntilTrialEnds <= 60 * 60 * 1000) {
                trialExpiryTimeout = setTimeout(() => {
                  if (!grokBridge || ws.readyState !== WebSocket.OPEN) {
                    return;
                  }

                  grokBridge.sendTextInput(
                    `SYSTEM: The user's 14-day free trial has now ended. Please wrap up this call warmly and mention that to continue using Ultaura, their family member will need to subscribe to a plan in the dashboard. End with a kind goodbye.`
                  );
                }, msUntilTrialEnds);
              }
            }

            // Update session status
            await updateCallStatus(callSessionId, 'in_progress', {
              connectedAt,
            });

            logger.info({ callSessionId }, 'Grok bridge connected, call in progress');

          } catch (error) {
            logger.error({ error, callSessionId }, 'Failed to initialize Grok bridge');
            unregisterGrokBridge(callSessionId);

            const fallbackLanguage = grokBridge?.getDetectedLanguage() ?? startingLanguage;
            const failedMessage = getFallbackMessage(fallbackLanguage, 'retry_failed');
            recordVoiceDisconnect(callSessionId, 'grok_error');
            await playFallbackTTS(twilioCallSid, failedMessage, fallbackLanguage, { hangup: true });
            await sleep(FALLBACK_TTS_WAIT_MS);

            // Send fallback message via Twilio TTS
            // We can't easily send TTS through the WebSocket, so we need to close and let Twilio handle it
            // Update session to reflect the error
            await updateCallStatus(callSessionId, 'failed', {
              endReason: 'error',
            });

            await recordCallEvent(callSessionId, 'error', {
              errorType: 'grok_connection_failed',
              errorCode:
                typeof error === 'object' && error && 'code' in error
                  ? String((error as { code?: unknown }).code)
                  : undefined,
            }, { skipDebugLog: true });

            ws.close(1011, 'AI service unavailable');
          }
          break;

        case 'media':
          // Forward audio to Grok
          if (isReconnecting) {
            break;
          }
          if (grokBridge && isConnected && message.media?.payload) {
            grokBridge.sendAudio(message.media.payload);
          }
          break;

        case 'dtmf':
          if (message.dtmf?.digit) {
            await handleDTMF(message.dtmf.digit, {
              callSessionId,
              line,
              account,
              grokBridge,
              ws,
              twilioStreamSid,
              setPendingOptOut: (value: boolean) => { pendingOptOut = value; },
              getPendingOptOut: () => pendingOptOut,
            });
          }
          break;

        case 'stop':
          logger.info({ callSessionId, twilioStreamSid }, 'Twilio stream stopped');
          break;

        case 'mark':
          // Mark events are used for synchronization
          logger.debug({ callSessionId, mark: message.mark?.name }, 'Mark received');
          break;
      }
    } catch (error) {
      logger.error({ error, callSessionId }, 'Error processing Twilio message');
    }
  }));

  // Handle WebSocket close
  ws.on('close', withContext(async (code, reason) => {
    logger.info({ callSessionId, code, reason: reason.toString() }, 'Media stream WebSocket closed');
    // Prefer Twilio status callbacks for disconnect attribution; fall back to ws_close if nothing else arrives.
    const wsCloseDisconnectTimer = setTimeout(() => {
      recordVoiceDisconnect(callSessionId, 'ws_close');
    }, 15_000);
    if (typeof wsCloseDisconnectTimer.unref === 'function') {
      wsCloseDisconnectTimer.unref();
    }
    const endSpan = () => {
      wsSpan?.end();
    };

    if (trialExpiryTimeout) {
      clearTimeout(trialExpiryTimeout);
      trialExpiryTimeout = null;
    }

    clearTrialCapTimers();
    clearOveragePrompt();

    if (keepBridgeAlive) {
      logger.info({ callSessionId }, 'Skipping cleanup to allow recovery');
      endSpan();
      return;
    }

    unregisterActiveCall(callSessionId);
    unregisterGrokBridge(callSessionId);

    const duration = connectedAt
      ? Date.now() - new Date(connectedAt).getTime()
      : 0;
    const finalEndReason: 'hangup' | 'trial_cap' = forcedEndReason ?? 'hangup';

    const buffer = getBuffer(callSessionId);
    const durationSeconds = Math.floor(duration / 1000);
    const shouldSummarize =
      isConnected &&
      duration >= 30000 &&
      !session?.is_reminder_call &&
      !session?.is_test_call;

    if (isConnected && buffer) {
      extractFallbackInsightsFromBuffer(buffer, session, durationSeconds).catch(err => {
        logger.error({ error: err, callSessionId }, 'Fallback insights extraction failed');
      });
    }

    if (shouldSummarize && buffer) {
      summarizeAndExtractMemoriesFromBuffer(buffer).catch(err => {
        logger.error({ error: err, callSessionId }, 'Background summarization failed');
      });
    } else {
      logger.debug({ callSessionId, duration, isReminderCall: session?.is_reminder_call },
        'Skipping summarization');
    }

    if (shouldTrackOnboarding && consentRequirements && consentState) {
      const missing: string[] = [];

      if (consentRequirements.recording && !consentState.recordingConsentReceived) {
        missing.push('recording');
      }
      if (consentRequirements.memory && !consentState.memoryConsentReceived) {
        missing.push('memory');
      }
      if (consentRequirements.sharing && !consentState.sharingConsentReceived) {
        missing.push('sharing');
      }

      if (missing.length > 0) {
        await logConsentAuditEvent({
          accountId: account.id,
          lineId: line.id,
          callSessionId,
          action: 'consent_incomplete_retry',
          consentType: null,
          oldValue: null,
          newValue: { missing },
          metadata: { missing },
        });
      } else {
        await updateLineVoiceConsent(line.id, account.id, callSessionId, {
          onboardingCompletedAt: new Date().toISOString(),
        });
      }
    }

    if (account.status === 'trial' && !trialReservationReleased) {
      trialReservationReleased = true;
      const actualBillableMinutes = calculateBillableMinutes(durationSeconds);
      await releaseTrialDailyCap({
        callSessionId,
        endReason: finalEndReason,
        actualBillableMinutes,
      });
    }

    clearBuffer(callSessionId);

    // Close Grok bridge
    if (grokBridge) {
      grokBridge.close();
    }

    // Complete the call session if it was in progress
    if (session && (isConnected || finalEndReason === 'trial_cap')) {
      await completeCallSession(callSessionId, {
        endReason: finalEndReason,
        languageDetected: grokBridge?.getDetectedLanguage() ?? undefined,
      });
    }
    endSpan();
  }));

  // Handle WebSocket error
  ws.on('error', withContext(async (error) => {
    logger.error({ error, callSessionId }, 'Media stream WebSocket error');

    if (keepBridgeAlive) {
      return;
    }

    clearTrialCapTimers();
    const fallbackLanguage = grokBridge?.getDetectedLanguage() ?? startingLanguage;
    const failedMessage = getFallbackMessage(fallbackLanguage, 'retry_failed');
    await playFallbackTTS(twilioCallSid, failedMessage, fallbackLanguage, { hangup: true });
    await sleep(FALLBACK_TTS_WAIT_MS);

    if (grokBridge) {
      grokBridge.close();
    }
    unregisterGrokBridge(callSessionId);
  }));
}

// Handle DTMF input
async function handleDTMF(
  digit: string,
  context: {
    callSessionId: string;
    line: any;
    account: any;
    grokBridge: GrokBridge | null;
    ws: WebSocket;
    twilioStreamSid: string | null;
    setPendingOptOut: (value: boolean) => void;
    getPendingOptOut: () => boolean;
  }
): Promise<void> {
  const { callSessionId, line, account, grokBridge, setPendingOptOut, getPendingOptOut } = context;

  logger.info({ callSessionId, digit }, 'DTMF received');

  // Record the DTMF event
  await recordCallEvent(callSessionId, 'dtmf', { digit }, { skipDebugLog: true });

  switch (digit) {
    case '1':
      // Repeat last response
      if (grokBridge) {
        grokBridge.sendTextInput('Please repeat what you just said.');
      }
      break;

    case '9':
      // Opt-out request
      if (getPendingOptOut()) {
        // Confirm opt-out
        await recordOptOut(account.id, line.id, callSessionId, 'dtmf');
        if (grokBridge) {
          grokBridge.sendTextInput('DTMF_9_CONFIRMED: User confirmed opt-out. Say goodbye and end the call.');
        }
        setPendingOptOut(false);
      } else {
        // Ask for confirmation
        if (grokBridge) {
          grokBridge.sendTextInput('DTMF_9: User pressed 9 to opt out. Ask them to confirm by saying yes or pressing 9 again.');
        }
        setPendingOptOut(true);
        // Reset pending after 30 seconds
        setTimeout(() => setPendingOptOut(false), 30000);
      }
      break;

    case '0':
      // Help/support request
      if (grokBridge) {
        grokBridge.sendTextInput('DTMF_0: User pressed 0 for help. Explain that they can call this number anytime, and if they need account help, ask their family member to contact support.');
      }
      break;
  }
}

const XML_ESCAPE_MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => XML_ESCAPE_MAP[char]);
}

function buildSayTwiML(options: {
  message: string;
  languageCode: string;
  pauseSeconds?: number;
  hangup?: boolean;
}): string {
  const voice = getVoiceForLanguage(options.languageCode);
  const { language } = getVoiceConfigForLanguage(options.languageCode);
  const pause = options.pauseSeconds ? `  <Pause length="${options.pauseSeconds}" />\n` : '';
  const hangup = options.hangup ? '  <Hangup />\n' : '';

  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Say voice="${voice}" language="${language}">${escapeXml(options.message)}</Say>\n${pause}${hangup}</Response>`;
}

async function playFallbackTTS(
  twilioCallSid: string | null,
  message: string,
  languageCode: string,
  options: { pauseSeconds?: number; hangup?: boolean } = {}
): Promise<void> {
  if (!twilioCallSid) return;

  try {
    const twiml = buildSayTwiML({ message, languageCode, ...options });
    await getTwilioClient().calls(twilioCallSid).update({ twiml });
  } catch (error) {
    logger.error({ error, twilioCallSid }, 'Failed to play fallback TTS');
  }
}

async function reconnectMediaStream(twilioCallSid: string | null, callSessionId: string): Promise<void> {
  if (!twilioCallSid) return;

  try {
    const twiml = generateStreamTwiML(callSessionId, getWebsocketUrl());
    await getTwilioClient().calls(twilioCallSid).update({ twiml });
  } catch (error) {
    logger.error({ error, twilioCallSid, callSessionId }, 'Failed to reconnect media stream');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
