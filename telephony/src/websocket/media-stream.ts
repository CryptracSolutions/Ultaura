// Twilio Media Stream WebSocket handler
// Bridges Twilio audio to xAI Grok Voice Agent

import { WebSocket } from 'ws';
import { logger } from '../server.js';
import { getCallSession, updateCallStatus, completeCallSession, recordCallEvent } from '../services/call-session.js';
import { getLineById, recordOptOut } from '../services/line-lookup.js';
import { getMemoriesForLine, formatMemoriesForPrompt } from '../services/memory.js';
import { shouldWarnLowMinutes } from '../services/metering.js';
import { GrokBridge } from './grok-bridge.js';

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

// Handle a new Twilio Media Stream connection
export async function handleMediaStreamConnection(ws: WebSocket, callSessionId: string): Promise<void> {
  logger.info({ callSessionId }, 'Media stream connection started');

  let streamSid: string | null = null;
  let grokBridge: GrokBridge | null = null;
  let isConnected = false;
  let pendingOptOut = false;
  let minuteCheckInterval: NodeJS.Timeout | null = null;

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

  // Handle messages from Twilio
  ws.on('message', async (data: Buffer) => {
    try {
      const message: TwilioMessage = JSON.parse(data.toString());

      switch (message.event) {
        case 'connected':
          logger.info({ callSessionId }, 'Twilio stream connected');
          break;

        case 'start':
          streamSid = message.start?.streamSid || null;
          logger.info({ callSessionId, streamSid }, 'Twilio stream started');

          // Initialize Grok bridge
          try {
            // Fetch memories for the line
            const memories = await getMemoriesForLine(account.id, line.id, { limit: 50 });
            const memoryText = formatMemoriesForPrompt(memories);

            // Check if this is the first call
            const isFirstCall = !line.last_successful_call_at;

            // Check minutes status
            const minutesStatus = await shouldWarnLowMinutes(account.id);

            // Create Grok bridge
            grokBridge = new GrokBridge({
              callSessionId,
              lineId: line.id,
              accountId: account.id,
              userName: line.display_name,
              timezone: line.timezone,
              language: line.preferred_language,
              isFirstCall,
              memories: memoryText,
              seedInterests: line.seed_interests,
              seedAvoidTopics: line.seed_avoid_topics,
              lowMinutesWarning: minutesStatus.warn,
              minutesRemaining: minutesStatus.remaining,
              isReminderCall: session.is_reminder_call,
              reminderMessage: session.reminder_message,
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
                logger.info({ callSessionId, toolName, args }, 'Tool call from Grok');
                await recordCallEvent(callSessionId, 'tool_call', { tool: toolName, args });
              },
            });

            await grokBridge.connect();
            isConnected = true;

            // Check minutes remaining periodically for trial accounts
            if (account.status === 'trial') {
              minuteCheckInterval = setInterval(async () => {
                const minutesStatus = await shouldWarnLowMinutes(account.id);

                if (minutesStatus.remaining <= 0) {
                  logger.info({ callSessionId }, 'Trial minutes exhausted mid-call');

                  // Send message to Grok to end the call gracefully
                  if (grokBridge) {
                    grokBridge.sendTextInput(
                      'SYSTEM: The user has run out of free trial minutes. Politely wrap up the conversation, tell them their free minutes are used up, and encourage them to ask their family member to upgrade. Say goodbye warmly.'
                    );
                  }

                  // Close connection after a short delay for the goodbye
                  setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.close(1000, 'Trial minutes exhausted');
                    }
                  }, 30000); // 30 seconds for goodbye

                  // Clear the interval
                  if (minuteCheckInterval) {
                    clearInterval(minuteCheckInterval);
                    minuteCheckInterval = null;
                  }
                } else if (minutesStatus.critical && isConnected) {
                  // Warn about low minutes
                  if (grokBridge) {
                    grokBridge.sendTextInput(
                      `SYSTEM: User has only ${minutesStatus.remaining} minutes remaining on their trial. Mention this naturally toward the end of the call.`
                    );
                  }
                }
              }, 60000); // Check every minute
            }

            // Update session status
            await updateCallStatus(callSessionId, 'in_progress');

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
              type: 'grok_connection_failed',
              error: error instanceof Error ? error.message : 'Unknown error',
              fallbackMessage: "I'm sorry, I'm having some technical difficulties right now. Please try calling back in a few minutes, or press 0 for help.",
            });

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

    if (minuteCheckInterval) {
      clearInterval(minuteCheckInterval);
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
  await recordCallEvent(callSessionId, 'dtmf', { digit });

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
