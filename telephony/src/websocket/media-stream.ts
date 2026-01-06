// Twilio Media Stream WebSocket handler
// Bridges Twilio audio to xAI Grok Voice Agent

import { WebSocket } from 'ws';
import { logger } from '../server.js';
import { getCallSession, updateCallStatus, completeCallSession, recordCallEvent, recordDebugEvent } from '../services/call-session.js';
import { getLineById, recordOptOut } from '../services/line-lookup.js';
import { getMemoriesForLine } from '../services/memory.js';
import { createBuffer, clearBuffer } from '../services/ephemeral-buffer.js';
import { summarizeAndExtractMemories } from '../services/call-summarization.js';
import { getUsageSummary } from '../services/metering.js';
import { GrokBridge } from './grok-bridge.js';
import type { AccountStatus, PlanId, PreferredLanguage, SpanishFormality } from '@ultaura/types';
import { redactSensitive } from '../utils/redact.js';

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

const PLAN_OPTIONS = [
  { id: 'care', name: 'Care', minutes: 300, price: '$39 per month' },
  { id: 'comfort', name: 'Comfort', minutes: 900, price: '$99 per month' },
  { id: 'family', name: 'Family', minutes: 2200, price: '$199 per month' },
  { id: 'payg', name: 'Pay as you go', minutes: null, price: '$0 per month plus $0.15 per minute' },
];

// Handle a new Twilio Media Stream connection
export async function handleMediaStreamConnection(ws: WebSocket, callSessionId: string): Promise<void> {
  logger.info({ callSessionId }, 'Media stream connection started');

  let streamSid: string | null = null;
  let grokBridge: GrokBridge | null = null;
  let isConnected = false;
  let connectedAt: string | null = null;
  let pendingOptOut = false;
  let trialExpiryTimeout: NodeJS.Timeout | null = null;
  let overagePromptTimeout: NodeJS.Timeout | null = null;
  let overagePromptActive = false;

  // Get session info
  const session = await getCallSession(callSessionId);
  if (!session) {
    logger.error({ callSessionId }, 'Session not found for media stream');
    ws.close(1008, 'Session not found');
    return;
  }

  // Get line and account info
  const lineWithAccount = await getLineById(session.line_id);
  if (!lineWithAccount) {
    logger.error({ callSessionId }, 'Line not found for session');
    ws.close(1008, 'Line not found');
    return;
  }

  const { line, account } = lineWithAccount;
  const isPayg = account.plan_id === 'payg';

  const formatPlanOptions = () =>
    PLAN_OPTIONS.map((option) => {
      if (option.minutes) {
        return `${option.name} (${option.minutes} minutes per month, ${option.price})`;
      }
      return `${option.name} (${option.price})`;
    }).join('; ');

  const getMinutesStatus = async () => {
    // Trial accounts have unlimited usage during the trial period.
    // We still track minutes used, but we do not warn or prompt for overage.
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
    if (overagePromptTimeout) {
      clearTimeout(overagePromptTimeout);
      overagePromptTimeout = null;
    }
  };

  const sendOveragePrompt = () => {
    if (!grokBridge || overagePromptActive) {
      return;
    }

    overagePromptActive = true;

    const planOptions = formatPlanOptions();
    const prompt = `SYSTEM: The user has 0 included minutes remaining. Continuing will incur overage charges at $0.15 per minute. At the start of the call, explain this and ask if they would like to continue with overage charges, upgrade, or stop the call. If they want to upgrade, offer these options: ${planOptions}. Ask which plan they prefer. Once they decide, call choose_overage_action with action "continue", "upgrade", or "stop". If upgrading, include plan_id ("care", "comfort", "family", or "payg"). Do not ask for payment details; tell them you will email a secure link to the billing email on file. If they do not respond within one minute, give a short warm goodbye and end the call.`;

    grokBridge.sendTextInput(prompt);

    overagePromptTimeout = setTimeout(() => {
      if (!overagePromptActive || !grokBridge) {
        return;
      }

      grokBridge.sendTextInput(
        'SYSTEM: The user did not respond. Give a short warm goodbye and end the call now.'
      );

      if (ws.readyState === WebSocket.OPEN) {
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close(1000, 'No response to overage prompt');
          }
        }, 15000);
      }
    }, 60000);
  };

  // Handle messages from Twilio
  ws.on('message', async (data: Buffer) => {
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
          streamSid = message.start?.streamSid || null;
          logger.info({ callSessionId, streamSid }, 'Twilio stream started');

          // Initialize Grok bridge
          try {
            createBuffer(callSessionId, line.id, account.id);

            // Fetch memories for the line
            const memories = await getMemoriesForLine(account.id, line.id, { limit: 50 });

            // Check if this is the first call
            const isFirstCall = !line.last_successful_call_at;

            // Check minutes status
            const minutesStatus = await getMinutesStatus();
            const minutesRemaining = minutesStatus.remaining;
            const shouldPromptOverage =
              account.status !== 'trial' && !isPayg && minutesRemaining <= 0 && !session.is_reminder_call;

            // Create Grok bridge
            grokBridge = new GrokBridge({
              callSessionId,
              lineId: line.id,
              accountId: account.id,
              userName: line.display_name,
              timezone: line.timezone,
              language: line.preferred_language as PreferredLanguage,
              isFirstCall,
              memories,
              seedInterests: line.seed_interests,
              seedAvoidTopics: line.seed_avoid_topics,
              lowMinutesWarning: minutesStatus.warn,
              minutesRemaining,
              isReminderCall: session.is_reminder_call,
              reminderMessage: session.reminder_message,
              currentPlanId: account.plan_id as PlanId,
              accountStatus: account.status as AccountStatus,
              spanishFormality: line.spanish_formality as SpanishFormality,
              onAudioReceived: (audioBase64: string) => {
                // Send audio back to Twilio
                if (ws.readyState === WebSocket.OPEN && streamSid) {
                  ws.send(JSON.stringify({
                    event: 'media',
                    streamSid,
                    media: { payload: audioBase64 },
                  }));
                }
              },
              onClearBuffer: () => {
                // Clear Twilio's buffer (for barge-in)
                if (ws.readyState === WebSocket.OPEN && streamSid) {
                  ws.send(JSON.stringify({
                    event: 'clear',
                    streamSid,
                  }));
                }
              },
              onError: (error: Error) => {
                logger.error({ error, callSessionId }, 'Grok bridge error');
              },
              onToolCall: async (toolName: string, args: Record<string, unknown>) => {
                logger.debug({
                  callSessionId,
                  toolName,
                  args: redactSensitive(args),
                }, 'Tool call from Grok');
                const phoneLast4 = line.phone_e164 ? line.phone_e164.slice(-4) : null;
                await recordDebugEvent(
                  callSessionId,
                  'tool_call',
                  { tool: toolName, args },
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
              },
            });

            await grokBridge.connect();
            isConnected = true;
            connectedAt = new Date().toISOString();

            if (shouldPromptOverage) {
              sendOveragePrompt();
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
                    `SYSTEM: The user's 3-day free trial has now ended. Please wrap up this call warmly and mention that to continue using Ultaura, their family member will need to subscribe to a plan in the dashboard. End with a kind goodbye.`
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
              streamSid,
              setPendingOptOut: (value: boolean) => { pendingOptOut = value; },
              getPendingOptOut: () => pendingOptOut,
            });
          }
          break;

        case 'stop':
          logger.info({ callSessionId, streamSid }, 'Twilio stream stopped');
          break;

        case 'mark':
          // Mark events are used for synchronization
          logger.debug({ callSessionId, mark: message.mark?.name }, 'Mark received');
          break;
      }
    } catch (error) {
      logger.error({ error, callSessionId }, 'Error processing Twilio message');
    }
  });

  // Handle WebSocket close
  ws.on('close', async (code, reason) => {
    logger.info({ callSessionId, code, reason: reason.toString() }, 'Media stream WebSocket closed');

    if (trialExpiryTimeout) {
      clearTimeout(trialExpiryTimeout);
      trialExpiryTimeout = null;
    }

    clearOveragePrompt();

    const duration = connectedAt
      ? Date.now() - new Date(connectedAt).getTime()
      : 0;

    const shouldSummarize =
      isConnected &&
      duration >= 30000 &&
      !session?.is_reminder_call;

    if (shouldSummarize) {
      summarizeAndExtractMemories(callSessionId).catch(err => {
        logger.error({ error: err, callSessionId }, 'Background summarization failed');
      });
    } else {
      clearBuffer(callSessionId);
      logger.debug({ callSessionId, duration, isReminderCall: session?.is_reminder_call },
        'Skipping summarization');
    }

    // Close Grok bridge
    if (grokBridge) {
      grokBridge.close();
    }

    // Complete the call session if it was in progress
    if (session && isConnected) {
      await completeCallSession(callSessionId, {
        endReason: 'hangup',
      });
    }
  });

  // Handle WebSocket error
  ws.on('error', async (error) => {
    logger.error({ error, callSessionId }, 'Media stream WebSocket error');

    if (grokBridge) {
      grokBridge.close();
    }
  });
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
    streamSid: string | null;
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

    default:
      // Ignore other digits
      break;
  }
}
