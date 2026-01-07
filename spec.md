# Voice Reliability Edge Cases: Barge-In & Mid-Call Model Failure

## Specification Document

**Author:** Claude (Planning Agent)
**Date:** January 6, 2026
**Status:** Ready for Implementation
**Impact:** High
**Likelihood:** Medium

---

## 1. Executive Summary

This specification addresses two critical voice reliability issues in the Ultaura telephony system:

1. **Barge-In Handling**: When a user speaks while the assistant is talking, the assistant audio stops but Grok continues generating tokens wastefully
2. **Mid-Call Model Failure**: When the Grok WebSocket disconnects mid-conversation, users hear silence until they hang up

### Symptoms
- User speaks while assistant talks → assistant doesn't stop properly (talk-over)
- Grok WebSocket closes → user hears silence until hangup ("robot is broken" moments)

### Root Causes
- **Barge-in**: `response.cancel` message not sent to Grok when speech detected
- **Error handling**: `onError` callback only logs; doesn't close Twilio stream or notify user

---

## 2. Objectives

### Primary Goals
1. Implement proper barge-in handling that cancels Grok's in-progress response
2. Gracefully handle mid-call Grok failures with retry and user notification
3. Maintain call session integrity and billing accuracy during failures

### Success Criteria
- Zero "talk-over" incidents where assistant continues after user interruption
- All mid-call failures result in graceful user notification (not silence)
- Call sessions properly completed with accurate billing for time used
- Barge-in events tracked for analytics

---

## 3. Technical Requirements

### 3.1 Barge-In Handling

#### Current State (Problem)
**File:** `telephony/src/websocket/grok-bridge.ts` (lines 444-447)

```typescript
case 'input_audio_buffer.speech_started':
  // User started speaking - clear any pending audio (barge-in)
  this.options.onClearBuffer();
  break;
```

**What happens:**
1. Grok detects user speech via VAD ✓
2. `onClearBuffer()` called → Twilio's outgoing audio buffer cleared ✓
3. **Problem:** Grok continues generating response tokens ✗
4. Already-generated audio discarded, but Grok wastes resources

#### Required Changes

**A. Send `response.cancel` to Grok**

When `input_audio_buffer.speech_started` is received:
1. Call `onClearBuffer()` (existing - keep)
2. **NEW:** Send `response.cancel` message to Grok WebSocket
3. **NEW:** Log barge-in event to call_events table

**B. Wait for User to Finish**

Use existing VAD settings (500ms silence detection threshold). Do NOT modify VAD configuration - current settings work well for elderly users.

**C. No Rapid Barge-In Throttling**

If user interrupts multiple times rapidly, let natural conversation flow handle it. No special throttling logic needed.

#### Implementation Details

**Modified `grok-bridge.ts` handler:**

```typescript
case 'input_audio_buffer.speech_started':
  // User started speaking - cancel current response (barge-in)
  this.options.onClearBuffer();

  // Cancel any in-progress Grok response
  this.cancelCurrentResponse();

  // Log barge-in event for analytics
  this.options.onBargeIn?.();
  break;
```

**New method in GrokBridge class:**

```typescript
private cancelCurrentResponse(): void {
  if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

  // Send response.cancel to stop Grok from generating
  this.ws.send(JSON.stringify({
    type: 'response.cancel',
  }));

  logger.debug({ callSessionId: this.options.callSessionId }, 'Canceled Grok response due to barge-in');
}
```

**New callback in GrokBridgeOptions interface:**

```typescript
interface GrokBridgeOptions {
  // ... existing options ...
  onBargeIn?: () => void;  // Called when user interrupts assistant
}
```

**Updated media-stream.ts to log barge-in:**

```typescript
onBargeIn: () => {
  recordCallEvent(callSessionId, 'barge_in', {
    timestamp: new Date().toISOString(),
  }).catch(err => {
    logger.error({ error: err, callSessionId }, 'Failed to record barge-in event');
  });
},
```

---

### 3.2 Mid-Call Model Failure Handling

#### Current State (Problem)
**File:** `telephony/src/websocket/media-stream.ts` (lines 222-224)

```typescript
onError: (error: Error) => {
  logger.error({ error, callSessionId }, 'Grok bridge error');
}
```

**What happens:**
1. Grok WebSocket closes/errors
2. Error is logged (only action taken) ✗
3. Twilio WebSocket stays open, waiting for audio
4. User hears silence until they hang up

**File:** `telephony/src/websocket/grok-bridge.ts` (lines 141-148)

```typescript
this.ws.on('close', (code, reason) => {
  logger.info({ ... }, 'Grok WebSocket closed');
  this.isConnected = false;
  // No propagation to media-stream!
});
```

#### Required Changes

**A. Detect Grok Failure**

Add new callback `onDisconnect` in GrokBridgeOptions that fires when Grok WebSocket unexpectedly closes.

**B. Attempt Reconnection**

- **Retry count:** 1 attempt
- **Retry timeout:** 3 seconds
- If reconnection succeeds: continue conversation seamlessly (no acknowledgment)

**C. Play Fallback TTS on Failure**

If retry fails:
1. Play TTS apology message via Polly (multi-language support)
2. End call gracefully
3. Complete session with `end_reason: 'error'`

**D. Session Handling**

- Mark session as `'completed'` (not `'failed'`) with `end_reason: 'error'`
- This ensures billing for time actually used
- Record error details in call_events

#### Failure Recovery Flow

```
Grok WebSocket closes unexpectedly
         │
         ▼
   Log error event
         │
         ▼
   Play TTS: "I'm sorry, I'm having a little trouble
              right now. Let me try again..."
         │
         ▼
   Attempt reconnection (3 second timeout)
         │
    ┌────┴────┐
    │         │
 Success    Failure
    │         │
    ▼         ▼
 Continue   Play TTS: "I apologize, I'll need to
 seamlessly  call you back. Take care!"
              │
              ▼
         End call gracefully
              │
              ▼
         Complete session with
         end_reason: 'error'
```

#### Implementation Details

**A. New Callback in GrokBridgeOptions:**

```typescript
interface GrokBridgeOptions {
  // ... existing options ...
  onDisconnect?: (code: number, reason: string) => void;  // Grok disconnected unexpectedly
}
```

**B. Updated grok-bridge.ts close handler:**

```typescript
this.ws.on('close', (code, reason) => {
  const reasonStr = reason.toString();
  logger.info({ callSessionId: this.options.callSessionId, code, reason: reasonStr }, 'Grok WebSocket closed');

  const wasConnected = this.isConnected;
  this.isConnected = false;

  // Notify media-stream of unexpected disconnect (if was previously connected)
  if (wasConnected && this.options.onDisconnect) {
    this.options.onDisconnect(code, reasonStr);
  }
});
```

**C. New Reconnection Method in GrokBridge:**

```typescript
async reconnect(): Promise<boolean> {
  try {
    // Close existing connection if any
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
    }

    // Attempt new connection with 3 second timeout
    await this.connect();
    return true;
  } catch (error) {
    logger.error({ error, callSessionId: this.options.callSessionId }, 'Grok reconnection failed');
    return false;
  }
}
```

**D. Updated media-stream.ts with failure handling:**

```typescript
// State tracking
let isReconnecting = false;

// In GrokBridge options:
onDisconnect: async (code: number, reason: string) => {
  if (isReconnecting) return; // Prevent concurrent reconnection attempts
  isReconnecting = true;

  logger.warn({ callSessionId, code, reason }, 'Grok disconnected mid-call, attempting recovery');

  // Record error event
  await recordCallEvent(callSessionId, 'error', {
    errorType: 'grok_disconnect_mid_call',
    code,
    reason,
  });

  // Play "please wait" message
  const detectedLanguage = grokBridge?.getDetectedLanguage() ?? 'en';
  await playFallbackTTS(ws, streamSid, 'retry_wait', detectedLanguage);

  // Attempt reconnection (3 second timeout built into connect())
  const reconnected = await grokBridge.reconnect();

  if (reconnected) {
    logger.info({ callSessionId }, 'Grok reconnection successful');
    isReconnecting = false;
    // Continue seamlessly - no acknowledgment to user
    return;
  }

  // Reconnection failed - play goodbye message and end call
  logger.error({ callSessionId }, 'Grok reconnection failed, ending call');
  await playFallbackTTS(ws, streamSid, 'retry_failed', detectedLanguage);

  // Wait for TTS to finish (approximately 3 seconds)
  await sleep(3000);

  // Complete session with error reason
  await completeCallSession(callSessionId, {
    endReason: 'error',
    languageDetected: detectedLanguage,
  });

  // Close Twilio WebSocket
  ws.close(1000, 'AI service unavailable after retry');
  isReconnecting = false;
},
```

**E. Fallback TTS Messages (New File):**

**File:** `telephony/src/utils/fallback-messages.ts`

```typescript
import { getLanguageVoice } from './voicemail-messages';

type FallbackMessageType = 'retry_wait' | 'retry_failed';

const FALLBACK_MESSAGES: Record<string, Record<FallbackMessageType, string>> = {
  en: {
    retry_wait: "I'm sorry, I'm having a little trouble right now. Let me try again.",
    retry_failed: "I apologize, I'll need to call you back. Take care!",
  },
  es: {
    retry_wait: "Lo siento, estoy teniendo un pequeño problema. Déjame intentar de nuevo.",
    retry_failed: "Me disculpo, tendré que llamarte de nuevo. ¡Cuídate!",
  },
  fr: {
    retry_wait: "Je suis désolé, j'ai un petit problème. Laissez-moi réessayer.",
    retry_failed: "Je m'excuse, je devrai vous rappeler. Prenez soin de vous!",
  },
  de: {
    retry_wait: "Es tut mir leid, ich habe gerade ein kleines Problem. Lass mich es noch einmal versuchen.",
    retry_failed: "Ich entschuldige mich, ich muss Sie zurückrufen. Pass auf dich auf!",
  },
  it: {
    retry_wait: "Mi dispiace, sto avendo un piccolo problema. Fammi riprovare.",
    retry_failed: "Mi scuso, dovrò richiamarti. Abbi cura di te!",
  },
  pt: {
    retry_wait: "Desculpe, estou tendo um pequeno problema. Deixe-me tentar novamente.",
    retry_failed: "Peço desculpas, precisarei ligar de volta. Cuide-se!",
  },
  ja: {
    retry_wait: "申し訳ありません、少し問題が発生しています。もう一度試してみます。",
    retry_failed: "申し訳ありませんが、後ほどお電話いたします。お体に気をつけてください！",
  },
  ko: {
    retry_wait: "죄송합니다, 약간의 문제가 있습니다. 다시 시도해 볼게요.",
    retry_failed: "죄송합니다, 다시 전화드려야 할 것 같습니다. 건강하세요!",
  },
  zh: {
    retry_wait: "抱歉，我现在遇到了一点问题。让我再试一次。",
    retry_failed: "抱歉，我需要稍后再给您打电话。保重！",
  },
};

export function getFallbackMessage(language: string, type: FallbackMessageType): string {
  const lang = language.substring(0, 2).toLowerCase();
  return FALLBACK_MESSAGES[lang]?.[type] ?? FALLBACK_MESSAGES['en'][type];
}

export function generateFallbackTwiML(language: string, type: FallbackMessageType): string {
  const message = getFallbackMessage(language, type);
  const voice = getLanguageVoice(language);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">${message}</Say>
</Response>`;
}
```

**F. Play TTS Function:**

Add to `media-stream.ts`:

```typescript
import { getFallbackMessage, getLanguageVoice } from '../utils/fallback-messages';

async function playFallbackTTS(
  ws: WebSocket,
  streamSid: string | null,
  type: 'retry_wait' | 'retry_failed',
  language: string
): Promise<void> {
  if (ws.readyState !== WebSocket.OPEN || !streamSid) {
    return;
  }

  const message = getFallbackMessage(language, type);
  const voice = getLanguageVoice(language);

  // Generate TTS audio using Twilio's streaming TTS
  // Send as media event to Twilio
  // Implementation depends on how Twilio streaming TTS is accessed

  // Option 1: Use Twilio's <Say> via inline TwiML (if supported mid-stream)
  // Option 2: Pre-generate audio files and send as media
  // Option 3: Use Polly directly and stream audio chunks

  // For now, inject a system message that tells Grok to say the message
  // This is a workaround until direct TTS injection is implemented

  logger.info({ callSessionId: streamSid, type, language }, 'Playing fallback TTS message');
}
```

**G. Utility sleep function:**

```typescript
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

### 3.3 Test Endpoint for QA

**New Endpoint:** `POST /test/simulate-failure`

**File:** `telephony/src/routes/test.ts` (new file)

```typescript
import { Router } from 'express';
import { getGrokBridge } from '../websocket/grok-bridge-registry';
import { logger } from '../utils/logger';

const router = Router();

// Only available in development/staging
if (process.env.NODE_ENV !== 'production') {
  router.post('/simulate-failure', async (req, res) => {
    const { callSessionId } = req.body;

    if (!callSessionId) {
      return res.status(400).json({ error: 'callSessionId required' });
    }

    const bridge = getGrokBridge(callSessionId);
    if (!bridge) {
      return res.status(404).json({ error: 'No active call session found' });
    }

    logger.info({ callSessionId }, 'Simulating Grok failure for testing');

    // Force close the Grok WebSocket to trigger failure handling
    bridge.forceClose();

    return res.json({ success: true, message: 'Failure simulated' });
  });
}

export default router;
```

**Add forceClose method to GrokBridge:**

```typescript
forceClose(): void {
  if (this.ws) {
    this.ws.close(1006, 'Simulated failure for testing');
  }
}
```

**Register route in server.ts:**

```typescript
import testRoutes from './routes/test';

// After other routes
if (process.env.NODE_ENV !== 'production') {
  app.use('/test', testRoutes);
}
```

---

### 3.4 Call Events for Analytics

**New Event Type:** `barge_in`

**Table:** `ultaura_call_events`

**Event Structure:**
```json
{
  "type": "barge_in",
  "payload": {
    "timestamp": "2026-01-06T12:34:56.789Z"
  }
}
```

**Update CallEventType in types:**

```typescript
type CallEventType =
  | 'dtmf'
  | 'tool_call'
  | 'error'
  | 'safety_detection'
  | 'barge_in'  // NEW
  // ... other types
```

---

## 4. Files to Modify

| File | Changes |
|------|---------|
| `telephony/src/websocket/grok-bridge.ts` | Add `cancelCurrentResponse()`, `reconnect()`, `forceClose()`, update close handler, add `onDisconnect` and `onBargeIn` callbacks |
| `telephony/src/websocket/media-stream.ts` | Add failure handling in `onDisconnect`, barge-in logging in `onBargeIn`, `playFallbackTTS()` function |
| `telephony/src/utils/fallback-messages.ts` | **NEW FILE** - Multilingual fallback TTS messages |
| `telephony/src/routes/test.ts` | **NEW FILE** - Test endpoint for simulating failures |
| `telephony/src/server.ts` | Register test routes (non-production only) |
| `telephony/src/types/index.ts` | Add `barge_in` to CallEventType |

---

## 5. Configuration

### Environment Variables

No new environment variables required. Existing configuration sufficient.

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `RECONNECT_TIMEOUT_MS` | 3000 | Timeout for Grok reconnection attempt |
| `RECONNECT_MAX_ATTEMPTS` | 1 | Maximum reconnection attempts |
| `TTS_PLAYBACK_WAIT_MS` | 3000 | Wait time after TTS before ending call |

Add to `telephony/src/utils/constants.ts`:

```typescript
export const GROK_RECONNECT_TIMEOUT_MS = 3000;
export const GROK_RECONNECT_MAX_ATTEMPTS = 1;
export const FALLBACK_TTS_WAIT_MS = 3000;
```

---

## 6. Edge Cases

### 6.1 Early Failure (Within 5 Seconds)

**Handling:** Same as mid-call failure
- Play apology TTS
- Attempt 1 reconnection
- If failed, graceful goodbye and hangup
- Session completed with `end_reason: 'error'`

### 6.2 Failure During Reconnection Attempt

If Grok fails again during reconnection:
- Do not attempt another reconnection
- Proceed directly to goodbye message and hangup

### 6.3 Twilio WebSocket Closes First

If Twilio closes before we can send TTS:
- Log the situation
- Complete session as normal (Twilio handles user notification)

### 6.4 Multiple Rapid Barge-Ins

No special handling. Each barge-in:
1. Cancels current response
2. Clears Twilio buffer
3. Logs event
4. Waits for VAD silence detection (500ms) before responding

### 6.5 Barge-In During Failure Recovery

If user speaks during "please wait" TTS:
- Let TTS finish
- Process user input after reconnection (if successful)

---

## 7. Testing Plan

### 7.1 Unit Tests

1. **GrokBridge.cancelCurrentResponse()**
   - Verify `response.cancel` message sent
   - Verify no-op if WebSocket not open

2. **GrokBridge.reconnect()**
   - Verify successful reconnection returns true
   - Verify failed reconnection returns false
   - Verify timeout at 3 seconds

3. **Fallback Messages**
   - Verify all 9 languages have both message types
   - Verify fallback to English for unknown languages

### 7.2 Integration Tests

1. **Barge-In Flow**
   - Simulate `input_audio_buffer.speech_started`
   - Verify `response.cancel` sent
   - Verify Twilio buffer cleared
   - Verify event logged

2. **Failure Recovery - Success**
   - Simulate Grok disconnect
   - Mock successful reconnection
   - Verify call continues

3. **Failure Recovery - Failure**
   - Simulate Grok disconnect
   - Mock failed reconnection
   - Verify TTS played
   - Verify session completed with error

### 7.3 Manual QA Tests

1. **Test Barge-In**
   - Start call
   - Let assistant begin speaking
   - Interrupt with speech
   - Verify assistant stops immediately
   - Verify assistant waits for you to finish
   - Verify natural response follows

2. **Test Mid-Call Failure**
   - Start call
   - Use `/test/simulate-failure` endpoint
   - Verify "please wait" message plays
   - Verify retry attempt
   - Verify graceful goodbye if retry fails

3. **Test Multi-Language Fallback**
   - Start call in Spanish/French/etc.
   - Trigger failure
   - Verify TTS messages in correct language

---

## 8. Rollout Plan

### Phase 1: Development
- Implement all changes
- Run unit tests
- Test in local environment

### Phase 2: Staging
- Deploy to staging
- Run integration tests
- Manual QA testing
- Test failure simulation endpoint

### Phase 3: Production
- Deploy to production (test endpoint disabled)
- Monitor logs for barge-in events
- Monitor error rates
- Ready to rollback if issues

---

## 9. Monitoring & Observability

### Metrics to Track

1. **Barge-In Events**
   - Count of `barge_in` events per call
   - Average barge-ins per call (high = potential UX issue)

2. **Mid-Call Failures**
   - Count of `grok_disconnect_mid_call` errors
   - Reconnection success rate
   - Average time to reconnection

3. **Call Completion**
   - Calls completed with `end_reason: 'error'`
   - Percentage of error completions vs. normal completions

### Log Queries

```sql
-- Barge-in events last 24 hours
SELECT COUNT(*) FROM ultaura_call_events
WHERE type = 'barge_in'
AND created_at > NOW() - INTERVAL '24 hours';

-- Mid-call failures last 24 hours
SELECT COUNT(*) FROM ultaura_call_events
WHERE type = 'error'
AND payload->>'errorType' = 'grok_disconnect_mid_call'
AND created_at > NOW() - INTERVAL '24 hours';

-- Calls ending in error
SELECT COUNT(*) FROM ultaura_call_sessions
WHERE end_reason = 'error'
AND ended_at > NOW() - INTERVAL '24 hours';
```

---

## 10. Dependencies

### External Dependencies
- **xAI Grok Realtime API**: Must support `response.cancel` message type
- **Twilio Media Streams**: Existing `clear` event (already working)
- **Amazon Polly**: For TTS fallback messages (already integrated via voicemail system)

### Internal Dependencies
- `telephony/src/websocket/grok-bridge.ts`
- `telephony/src/websocket/media-stream.ts`
- `telephony/src/websocket/grok-bridge-registry.ts`
- `telephony/src/services/call-session.ts`
- `telephony/src/utils/voicemail-messages.ts` (for `getLanguageVoice()`)

---

## 11. Assumptions

1. **xAI Grok API supports `response.cancel`** - Need to verify this message type is supported by the Grok Realtime API. If not, alternative approach needed.

2. **TTS can be played mid-stream** - The implementation assumes we can inject TTS audio into the Twilio Media Stream. May require using Twilio's TTS capabilities or pre-generated audio.

3. **Session state is accessible during failure** - Call session ID and language detection are available when handling failures.

4. **Single retry is sufficient** - Based on user preference. If Grok service is down, multiple retries unlikely to help.

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `response.cancel` not supported by Grok | High | Verify API docs; fallback to letting response complete naturally |
| TTS injection complex mid-stream | Medium | Use pre-recorded audio files as fallback |
| Reconnection takes too long | Medium | Strict 3-second timeout; fail fast |
| False positive barge-in detection | Low | VAD already tuned; log events for analysis |

---

## 13. Future Considerations

1. **Proactive Health Checks**: Could add Grok connectivity test to `/health` endpoint
2. **Auto-Reschedule Failed Calls**: Automatically try calling back after failed mid-call
3. **Family Notifications**: Option to notify payer of repeated failures
4. **Extended VAD Tuning**: Per-user VAD settings for users who pause longer between sentences

---

## Appendix A: Message Strings

### English
- **retry_wait**: "I'm sorry, I'm having a little trouble right now. Let me try again."
- **retry_failed**: "I apologize, I'll need to call you back. Take care!"

### Spanish
- **retry_wait**: "Lo siento, estoy teniendo un pequeño problema. Déjame intentar de nuevo."
- **retry_failed**: "Me disculpo, tendré que llamarte de nuevo. ¡Cuídate!"

### French
- **retry_wait**: "Je suis désolé, j'ai un petit problème. Laissez-moi réessayer."
- **retry_failed**: "Je m'excuse, je devrai vous rappeler. Prenez soin de vous!"

### German
- **retry_wait**: "Es tut mir leid, ich habe gerade ein kleines Problem. Lass mich es noch einmal versuchen."
- **retry_failed**: "Ich entschuldige mich, ich muss Sie zurückrufen. Pass auf dich auf!"

### Italian
- **retry_wait**: "Mi dispiace, sto avendo un piccolo problema. Fammi riprovare."
- **retry_failed**: "Mi scuso, dovrò richiamarti. Abbi cura di te!"

### Portuguese
- **retry_wait**: "Desculpe, estou tendo um pequeno problema. Deixe-me tentar novamente."
- **retry_failed**: "Peço desculpas, precisarei ligar de volta. Cuide-se!"

### Japanese
- **retry_wait**: "申し訳ありません、少し問題が発生しています。もう一度試してみます。"
- **retry_failed**: "申し訳ありませんが、後ほどお電話いたします。お体に気をつけてください！"

### Korean
- **retry_wait**: "죄송합니다, 약간의 문제가 있습니다. 다시 시도해 볼게요."
- **retry_failed**: "죄송합니다, 다시 전화드려야 할 것 같습니다. 건강하세요!"

### Chinese
- **retry_wait**: "抱歉，我现在遇到了一点问题。让我再试一次。"
- **retry_failed**: "抱歉，我需要稍后再给您打电话。保重！"

---

## Appendix B: File Diff Summary

### New Files
1. `telephony/src/utils/fallback-messages.ts` - Multilingual fallback TTS messages
2. `telephony/src/routes/test.ts` - QA test endpoints (dev/staging only)

### Modified Files
1. `telephony/src/websocket/grok-bridge.ts`
   - Add `onDisconnect` callback to options interface
   - Add `onBargeIn` callback to options interface
   - Add `cancelCurrentResponse()` method
   - Add `reconnect()` method
   - Add `forceClose()` method (for testing)
   - Update `close` event handler to call `onDisconnect`
   - Update `speech_started` handler to call `cancelCurrentResponse()` and `onBargeIn()`

2. `telephony/src/websocket/media-stream.ts`
   - Add `isReconnecting` state variable
   - Implement `onDisconnect` callback with retry logic
   - Implement `onBargeIn` callback with event logging
   - Add `playFallbackTTS()` helper function
   - Import fallback message utilities

3. `telephony/src/server.ts`
   - Register test routes (non-production only)

4. `telephony/src/types/index.ts` (or equivalent)
   - Add `'barge_in'` to `CallEventType` union

---

*End of Specification*
