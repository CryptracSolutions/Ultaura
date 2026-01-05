# Safety Tool Reliability Upgrade Specification

## Objective

Upgrade Ultaura's safety detection system to ensure reliable identification and logging of distress signals during calls. The current implementation relies solely on the AI model "choosing" to call the `log_safety_concern` tool, which is unreliable for something this sensitive.

**Goals:**
1. Add explicit tool usage instructions to the system prompt
2. Implement a deterministic keyword-based backstop that doesn't depend on model behavior
3. Maintain balanced sensitivity (not overpowering or too quick to raise alarms)
4. Provide full observability metrics for tuning

---

## Scope

### In Scope
- Enhanced system prompt with explicit safety tool invocation rules
- Deterministic keyword detection on user transcripts
- Tiered keyword categorization (low/medium/high)
- False positive prevention (exclusion patterns + context checking)
- Debouncing strategy (once per tier per call)
- System hint injection to model when keywords detected
- Logging and metrics for safety detection performance

### Out of Scope
- Per-account or per-line keyword customization (system-wide only)
- UI changes to dashboard
- Changes to trusted contact notification logic (still requires model confirmation)
- Real-time audio analysis (only text transcripts)

---

## Technical Requirements

### 1. System Prompt Enhancement

**Location:** `telephony/src/websocket/grok-bridge.ts` → `buildSystemPrompt()` and session config tools

**Requirements:**
- Add explicit "MUST call log_safety_concern" rules with examples
- Include tier definitions with 1-2 examples each (~100 words total)
- Add "what NOT to do" anti-patterns section
- Keep model discretion for when to call, but make expectations clear

**New Safety Section for System Prompt:**

```
## Safety Detection Protocol

You are equipped with a `log_safety_concern` tool. Use it to log when you detect genuine safety concerns.

### Tier Definitions

- **LOW**: Expressing sadness, loneliness, or mild distress
  - Example: "I've been feeling really lonely lately" or "Nobody calls me anymore"

- **MEDIUM**: Hopelessness, persistent despair, or passive ideation
  - Example: "What's the point of anything?" or "I don't see things getting better"

- **HIGH**: Active self-harm ideation, suicidal statements, or crisis
  - Example: "I want to end it all" or "I've been thinking about hurting myself"

### When to Call log_safety_concern

Call this tool when you detect:
- Mentions of suicide, self-harm, or wanting to die → tier: high, action: suggested_988
- Expressions of hopelessness or "giving up" → tier: medium, action: none or suggested_988
- Persistent sadness or isolation that concerns you → tier: low, action: none

You do NOT need to call for:
- Normal sadness about everyday disappointments
- Missing someone who passed away (unless combined with ideation)
- Temporary frustration or bad days

### What NOT to Do

- Do NOT minimize their feelings ("It's not that bad")
- Do NOT promise to keep suicidal thoughts secret from their family
- Do NOT diagnose mental health conditions
- Do NOT provide medical advice
- Do NOT abandon the call abruptly
- Do NOT lecture or be preachy about seeking help

### After Detecting Distress

1. Respond with empathy first
2. Call log_safety_concern with appropriate tier and action
3. For HIGH tier: Gently suggest calling 988 (Suicide & Crisis Lifeline)
4. For MEDIUM/LOW tier: Encourage talking to a trusted person
5. Stay present and continue the conversation naturally
```

### 2. Deterministic Keyword Backstop

**Location:** `telephony/src/websocket/grok-bridge.ts` (add new methods to `GrokBridge` class)

**Requirements:**
- Scan incoming user transcripts for safety keywords
- Categorize matches by tier (high/medium/low)
- Log safety event to database immediately
- Inject system hint to model prompting appropriate response
- Debounce: once per tier per call (allows escalation)

**New Methods to Add:**

```typescript
// Add to GrokBridge class

private safetyState: {
  triggeredTiers: Set<'low' | 'medium' | 'high'>;  // Tracks BOTH backstop AND model triggers
  lastDetectionTime: number;
} = {
  triggeredTiers: new Set(),
  lastDetectionTime: 0,
};

// Returns ALL matched tiers (for multi-tier logging), not just the first
private scanForSafetyKeywords(transcript: string): SafetyMatch[] {
  // Normalize text
  const text = transcript.toLowerCase().trim();

  const matches: SafetyMatch[] = [];

  // Check ALL tiers for matches
  for (const tier of ['high', 'medium', 'low'] as const) {
    // Skip if this tier was already triggered (by backstop OR model)
    if (this.safetyState.triggeredTiers.has(tier)) {
      continue;
    }

    const keywords = SAFETY_KEYWORDS[tier];
    for (const keyword of keywords) {
      const keywordMatch = this.findKeywordMatch(text, keyword);
      if (keywordMatch) {
        // GRANULAR exclusion: only suppress if exclusion overlaps with this keyword's location
        if (!this.isExcludedAtPosition(text, keywordMatch.start, keywordMatch.end)) {
          matches.push({ tier, matchedKeyword: keyword });
          break; // Only need one match per tier
        }
      }
    }
  }

  return matches;
}

// Find keyword match with position info
private findKeywordMatch(text: string, keyword: string): { start: number; end: number } | null {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  const match = regex.exec(text);
  if (match) {
    return { start: match.index, end: match.index + match[0].length };
  }
  return null;
}

// Check if any exclusion pattern overlaps with the keyword position
private isExcludedAtPosition(text: string, keywordStart: number, keywordEnd: number): boolean {
  for (const pattern of SAFETY_EXCLUSION_PATTERNS) {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      const exclStart = match.index;
      const exclEnd = match.index + match[0].length;
      // Check for overlap
      if (keywordStart < exclEnd && keywordEnd > exclStart) {
        return true; // Exclusion overlaps with keyword
      }
    }
  }
  return false;
}

// Note: matchesKeyword is replaced by findKeywordMatch above for position tracking

// Handle multiple matches - log each tier, inject hint for highest only
private async handleSafetyBackstop(matches: SafetyMatch[]): Promise<void> {
  if (matches.length === 0) return;

  const baseUrl = process.env.TELEPHONY_BACKEND_URL || 'http://localhost:3001';

  // Log each matched tier as a separate event
  for (const match of matches) {
    const { tier } = match;

    // Mark this tier as triggered for debouncing
    this.safetyState.triggeredTiers.add(tier);

    try {
      await this.callToolEndpoint(`${baseUrl}/tools/safety_event`, {
        callSessionId: this.options.callSessionId,
        lineId: this.options.lineId,
        accountId: this.options.accountId,
        tier,
        signals: `keyword_backstop_detected`,  // Generic signal, not storing actual keyword
        actionTaken: 'none',
        source: 'keyword_backstop',  // For metrics
      });

      logger.info({
        event: 'safety_backstop_triggered',
        callSessionId: this.options.callSessionId,
        tier,
      }, 'Safety backstop triggered');
    } catch (error) {
      logger.error({ error, tier }, 'Failed to log safety backstop event');
    }
  }

  this.safetyState.lastDetectionTime = Date.now();

  // Inject hint for HIGHEST matched tier only
  const highestTier = matches.find(m => m.tier === 'high')?.tier
    || matches.find(m => m.tier === 'medium')?.tier
    || matches[0].tier;

  this.injectSafetyHint(highestTier);
}

// Called when MODEL logs a safety event - updates debounce state
public markTierTriggeredByModel(tier: 'low' | 'medium' | 'high'): void {
  this.safetyState.triggeredTiers.add(tier);
  logger.debug({ tier }, 'Tier marked as triggered by model');
}

private injectSafetyHint(tier: 'low' | 'medium' | 'high'): void {
  if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

  const hintText = tier === 'high'
    ? '[SYSTEM: Safety keywords detected (high severity). Assess user wellbeing immediately and call log_safety_concern. Consider suggesting 988 crisis line.]'
    : tier === 'medium'
    ? '[SYSTEM: Safety keywords detected (medium severity). Assess user wellbeing and call log_safety_concern if warranted.]'
    : '[SYSTEM: Potential distress keywords detected. Please respond with empathy and assess if follow-up is needed.]';

  // Create a system message to inject
  const itemMessage = {
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'system',
      content: [{ type: 'input_text', text: hintText }],
    },
  };

  this.ws.send(JSON.stringify(itemMessage));

  // Trigger a response to address the detected keywords
  this.ws.send(JSON.stringify({ type: 'response.create' }));

  logger.debug({ tier }, 'Injected safety hint to model');
}
```

**Integration Point:**
Modify `handleGrokMessage()` to scan transcripts:

```typescript
case 'conversation.item.input_audio_transcription.completed': {
  const transcript = message.text || message.transcript || message.item?.output || '';
  if (transcript) {
    addTurn(this.options.callSessionId, this.extractUserTurn(transcript));

    // NEW: Scan for safety keywords (returns array of matches)
    const safetyMatches = this.scanForSafetyKeywords(transcript);
    if (safetyMatches.length > 0) {
      this.handleSafetyBackstop(safetyMatches).catch(err => {
        logger.error({ error: err }, 'Safety backstop handling failed');
      });
    }
  }
  break;
}
```

**Integration Point for Model Tool Calls:**
When model calls `log_safety_concern`, update debounce state:

```typescript
case 'log_safety_concern':
  // Mark this tier as triggered by model (for debouncing)
  this.markTierTriggeredByModel(args.tier);

  result = await this.callToolEndpoint(`${baseUrl}/tools/safety_event`, {
    callSessionId: this.options.callSessionId,
    lineId: this.options.lineId,
    accountId: this.options.accountId,
    tier: args.tier,
    signals: args.signals,
    actionTaken: args.action_taken,
    source: 'model',  // Mark as model-initiated
  });
  break;
```

### 3. Keyword Lists

**Location:** `telephony/src/websocket/grok-bridge.ts` (add at top of file) or new `telephony/src/utils/safety-keywords.ts`

**Tiered Keywords:**

```typescript
export const SAFETY_KEYWORDS = {
  high: [
    // English
    'suicide',
    'kill myself',
    'end my life',
    'end it all',
    'want to die',
    'want to kill me',      // Context-required: only with "want to" prefix
    'going to kill me',     // Context-required: only with "going to" prefix
    'better off dead',
    'hurt myself',
    'harm myself',
    'self-harm',
    'self harm',
    'cut myself',
    'don\'t want to live',
    'no reason to live',
    'take my own life',
    // Spanish
    'suicidio',
    'matarme',
    'quiero morir',
    'acabar con todo',
  ],
  medium: [
    // English
    'hopeless',
    'give up',
    'giving up',
    'not worth living',
    'what\'s the point',
    'no point in living',
    'can\'t go on',
    'can\'t take it anymore',
    'wish i wasn\'t here',
    'disappear',
    'nobody would miss me',
    'burden to everyone',
    // Spanish
    'sin esperanza',
    'no vale la pena',
    'rendirme',
  ],
  low: [
    // English
    'so lonely',
    'all alone',
    'nobody cares',
    'don\'t care anymore',
    'tired of everything',
    'exhausted with life',
    'nothing matters',
    // Spanish
    'muy solo',
    'muy sola',
    'nadie me quiere',
  ],
} as const;

// Exclusion patterns - use word-boundary regex matching (not simple substring)
export const SAFETY_EXCLUSION_PATTERNS = [
  // Common false positives (match as phrases)
  'killing time',
  'kill for a',      // "I could kill for a coffee"
  'killing it',      // "You're killing it!"
  'drop dead gorgeous',
  'to die for',      // "That cake looks to die for"
  'dying to',        // "I'm dying to see you"
  'dead tired',
  'dead serious',
  'bored to death',
  'scared to death',
  'hurt feelings',   // Not self-harm
  'hurt my back',    // Physical, not self-harm
  'hurt my knee',
  'hurt my leg',
  'hurt my arm',
  // Context exclusions (talking about others/media)
  'movie about',
  'book about',
  'article about',
  'news about',
  'show about',
  'heard about someone',
  'my friend',       // Talking about someone else
  'my neighbor',
  'their friend',
  'his friend',
  'her friend',
] as const;

// NOTE: "kill me" is NOT in exclusions because we use context-required matching:
// Only "want to kill me" and "going to kill me" are in the high-tier keywords.
// Standalone "kill me" (hyperbolic usage) won't match any keyword.

export interface SafetyMatch {
  tier: 'low' | 'medium' | 'high';
  matchedKeyword: string;
}
```

### 4. Metrics and Logging

**Location:** Add to safety-event tool handler and logging infrastructure

**Requirements:**
- Log when keyword backstop triggers (with tier, but not actual keyword for privacy)
- Log when model subsequently calls `log_safety_concern` for same call
- Track "backstop-only" events (model didn't confirm) for false positive analysis
- Add structured logging for later analysis

**Logging Format:**

```typescript
// When backstop triggers
logger.info({
  event: 'safety_backstop_triggered',
  callSessionId: string,
  lineId: string,
  tier: 'low' | 'medium' | 'high',
  timestamp: number,
}, 'Safety backstop triggered');

// When model also calls the tool
logger.info({
  event: 'safety_model_confirmed',
  callSessionId: string,
  tier: 'low' | 'medium' | 'high',
  backstopWasTriggered: boolean,  // Did backstop also trigger?
  timestamp: number,
}, 'Model called log_safety_concern');

// End of call summary (in completeCallSession or summarization)
logger.info({
  event: 'safety_call_summary',
  callSessionId: string,
  backstopTiersTriggered: string[],
  modelTiersLogged: string[],
  potentialFalsePositives: number,  // backstop triggers without model confirmation
}, 'Safety detection summary for call');
```

### 5. Safety Event Handler Updates

**Location:** `telephony/src/routes/tools/safety-event.ts`

**Changes:**
- Add `source` field handling in request (for metrics)
- Track whether event came from backstop or model
- Modify signals to use generic description

**Updated Handler:**

```typescript
safetyEventRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      callSessionId,
      lineId,
      accountId,
      tier,
      signals,
      actionTaken,
      source = 'model'  // NEW: 'model' | 'keyword_backstop'
    } = req.body;

    // Log for metrics
    logger.info({
      event: source === 'keyword_backstop' ? 'safety_backstop_triggered' : 'safety_model_confirmed',
      callSessionId,
      lineId,
      tier,
      source,
    }, `Safety event logged via ${source}`);

    await recordSafetyEvent({
      accountId,
      lineId,
      callSessionId,
      tier,
      signals: {
        description: signals,
        source,  // Include source in signals JSONB
      },
      actionTaken,
    });

    // For high-tier events FROM MODEL, notify trusted contacts
    // (Backstop-only high events do NOT notify - requires model confirmation)
    if (tier === 'high' && source === 'model') {
      logger.warn({ callSessionId, lineId, tier, actionTaken }, 'HIGH SAFETY TIER EVENT');
      notifyTrustedContacts(lineId, tier, actionTaken).catch((error) => {
        logger.error({ error, lineId }, 'Background trusted contact notification failed');
      });
    }

    res.json({ success: true, message: 'Safety concern logged' });
  } catch (error) {
    logger.error({ error }, 'Error logging safety event');
    res.status(500).json({ error: 'Failed to log safety event' });
  }
});
```

### 6. Tool Definition Update

**Location:** `telephony/src/websocket/grok-bridge.ts` → `sendSessionConfig()` tools array

Update the `log_safety_concern` tool description to be more instructive:

```typescript
{
  type: 'function',
  name: 'log_safety_concern',
  description: `Log when you detect genuine safety concerns during the conversation.

WHEN TO CALL:
- tier: 'high' → User mentions suicide, self-harm, or wanting to die. Action: suggested_988 or suggested_911
- tier: 'medium' → User expresses hopelessness, despair, or "giving up". Action: none or suggested_988
- tier: 'low' → User seems persistently sad, lonely, or isolated. Action: none

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
}
```

---

## Implementation Approach

### Phase 1: Keyword Infrastructure
1. Create `SAFETY_KEYWORDS` and `SAFETY_EXCLUSION_PATTERNS` constants
2. Implement `scanForSafetyKeywords()`, `matchesKeyword()`, `matchesExclusionPattern()` in GrokBridge
3. Add `safetyState` tracking for debouncing

### Phase 2: Integration
4. Hook keyword scanning into `handleGrokMessage()` transcript handler
5. Implement `handleSafetyBackstop()` with logging
6. Implement `injectSafetyHint()` for model prompting

### Phase 3: Prompt Enhancement
7. Update `buildSystemPrompt()` with new Safety Detection Protocol section
8. Update tool description for `log_safety_concern`

### Phase 4: Metrics & Observability
9. Update safety-event handler to accept and log `source` field
10. Add structured logging throughout
11. Add end-of-call safety summary logging

### Phase 5: Testing (Deferred)
12. Skip unit tests for now - focus on implementation first
13. Manual testing with simulated distress scenarios
14. Unit tests can be added later if needed

---

## File Changes Summary

| File | Change Type | Description |
|------|------------|-------------|
| `telephony/src/websocket/grok-bridge.ts` | Major | Add keyword detection methods, safety state, hint injection, update prompt and tool definition |
| `telephony/src/routes/tools/safety-event.ts` | Minor | Add source field handling, update notification logic |
| `telephony/src/utils/safety-keywords.ts` | New | Tiered keyword lists and exclusion patterns (optional - can be in grok-bridge.ts) |
| `src/lib/ultaura/constants.ts` | Minor | Update `SAFETY.DISTRESS_KEYWORDS` to match tiered structure (for frontend use if needed) |

---

## Edge Cases

### 1. Multiple Keywords in One Turn
If a user says "I'm hopeless and want to kill myself":
- Both `hopeless` (medium) and `kill myself` (high) match
- Log separate events for EACH matched tier (medium AND high)
- Inject hint for highest severity only (high)
- Each tier is only logged once per call (debounced)

### 2. Keyword in Context of Discussing Others
"My neighbor was talking about suicide" - Should NOT trigger because:
- "neighbor" is in exclusion patterns
- However, if pattern is "my neighbor talked about killing herself", the "herself" signals it's about someone else
- **Decision:** Accept some false positives here; model confirmation prevents notification

### 3. Repeated Distress Throughout Call
User mentions "hopeless" multiple times:
- Only log once per call (debounced by tier)
- If they later say "kill myself", that's a NEW tier (high), so it triggers

### 4. Model Already Logged Before Backstop
Model calls `log_safety_concern` before transcript arrives:
- When model calls `log_safety_concern`, we call `markTierTriggeredByModel(tier)` to update debounce state
- When backstop scans transcript later, it skips tiers already triggered by model
- **Result:** No duplicates - shared debounce state between model and backstop

### 5. Transcript Delay
Transcription arrives after model already responded:
- Hint injection may feel slightly late
- Still valuable for logging/metrics even if response already happened

### 6. Non-English Conversations
User speaks Spanish (language=es):
- Keywords include both English AND Spanish equivalents
- Backstop runs on ALL calls regardless of language setting
- Model handles other languages through its multilingual understanding

---

## Testing Considerations

### Unit Tests (safety-keywords.test.ts)

```typescript
describe('Safety Keyword Detection', () => {
  describe('scanForSafetyKeywords', () => {
    it('detects high-tier keywords', () => {
      expect(scan('I want to kill myself')).toEqual({ tier: 'high', matchedKeyword: 'kill myself' });
    });

    it('detects medium-tier keywords', () => {
      expect(scan('I feel so hopeless')).toEqual({ tier: 'medium', matchedKeyword: 'hopeless' });
    });

    it('detects low-tier keywords', () => {
      expect(scan('I am so lonely')).toEqual({ tier: 'low', matchedKeyword: 'so lonely' });
    });

    it('returns null for safe phrases', () => {
      expect(scan('I had a great day')).toBeNull();
    });

    it('excludes false positive patterns', () => {
      expect(scan('I could kill for a coffee')).toBeNull();
      expect(scan('I am killing time')).toBeNull();
      expect(scan('That dress is drop dead gorgeous')).toBeNull();
    });

    it('handles word boundaries correctly', () => {
      expect(scan('The hopelessness was overwhelming')).toBeNull(); // "hopelessness" != "hopeless"
      expect(scan('I feel hopeless')).not.toBeNull();
    });

    it('is case insensitive', () => {
      expect(scan('I WANT TO DIE')).toEqual({ tier: 'high', matchedKeyword: 'want to die' });
    });
  });

  describe('debouncing', () => {
    it('only triggers once per tier per call', () => {
      const bridge = createBridge();

      bridge.scanForSafetyKeywords('I feel hopeless'); // triggers medium
      expect(bridge.scanForSafetyKeywords('I feel hopeless')).toBeNull(); // debounced
      expect(bridge.scanForSafetyKeywords('I want to die')).not.toBeNull(); // new tier (high)
    });
  });
});
```

### Integration Tests

1. **Simulated Call Flow:**
   - Create mock transcript stream
   - Verify safety events logged correctly
   - Verify hint injected to WebSocket

2. **End-to-End with Mock Grok:**
   - Verify model receives hint
   - Verify model calls log_safety_concern
   - Verify notification NOT sent (backstop only)
   - Verify notification SENT (model confirmed high)

### Manual Testing Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Say "I feel lonely" | Low tier logged, gentle hint sent, no notification |
| Say "I feel hopeless" | Medium tier logged, hint sent, no notification |
| Say "I want to end it all" | High tier logged, urgent hint sent, no notification YET |
| Model responds with suggested 988 | Model logs high tier, trusted contacts notified |
| Say "killing time waiting for dinner" | Nothing (excluded pattern) |
| Say "I'm so tired of everything" | Low tier logged, gentle hint |

---

## Dependencies

- **xAI Grok Realtime API:** Must support `conversation.item.create` with system role for hint injection
- **Existing safety_events table:** No schema changes needed
- **Existing trusted contact notification:** Works as-is (only notifies on model-confirmed high)

---

## Rollout Considerations

### No Feature Flag
Ship the feature enabled by default - safety should always be on. If issues arise, a killswitch can be added later.

### Monitoring
Set up alerts for:
- Unusual spike in safety events (could indicate issue)
- High ratio of backstop-only events (may indicate model not calling tool)
- Zero safety events over extended period (may indicate detection failure)

---

## Success Metrics

1. **Coverage:** 100% of high-severity keyword utterances result in logged safety event
2. **False Positive Rate:** <20% of backstop triggers without model confirmation
3. **Response Quality:** Model responds appropriately to injected hints
4. **Notification Accuracy:** No false notifications (requires model confirmation)

---

## Assumptions

1. Grok Realtime API accepts system-role conversation items for hint injection
2. Transcript quality is sufficient for keyword matching (transcription errors may cause missed detections)
3. English + Spanish keywords provide adequate coverage for MVP (other languages rely on model)
4. Generic signal storage ("keyword_backstop_detected") is sufficient for privacy compliance
5. Existing RLS policies on safety_events table are sufficient

---

## Implementation Clarifications

Answers to specific implementation questions:

### Summary & State Plumbing

1. **End-of-call summary data source:** Pass safety state from GrokBridge to `completeCallSession()` via in-memory state. This requires plumbing the `safetyState.triggeredTiers` data through to the completion function.

2. **Duplicate completion guard:** Add idempotency check to avoid duplicate `safety_call_summary` logs since `completeCallSession()` can run from both media-stream close and Twilio status callback.

3. **Summary log fields:** Include `lineId` and `accountId` in the `safety_call_summary` structured log for better traceability.

### Detection Behavior

4. **Exclusion scope:** Use GRANULAR exclusion - only suppress detection if the exclusion pattern overlaps with the keyword match location. A benign phrase in one part of the transcript should NOT suppress detection of real distress keywords in another part.

5. **Log location:** Log `safety_backstop_triggered` in BOTH `handleSafetyBackstop()` AND the `/tools/safety_event` handler (redundancy is fine for safety-critical logging).

6. **Failed model call debouncing:** Mark tier as triggered even if POST to `/tools/safety_event` fails. This prevents retry spam if the endpoint is temporarily down.

### Prompt & Copy

7. **Prompt wording:** Implementation agent should author the condensed ~100-word "Safety Detection Protocol" based on the longer example in this spec.

8. **Reminder prompt:** Fully REMOVE the Safety section from `buildReminderPrompt()`. No safety guidance at all - rely solely on keyword backstop for reminder calls.

### Data Format

9. **Keyword lists:** Use the provided English/Spanish keywords and exclusion patterns verbatim from this spec. No additional variants needed.

10. **Signals format:** Request body uses `signals` as a string. Store as `{ description: signals, source }` in JSONB. For backstop events, the description string should be exactly `'keyword_backstop_detected'`.

### Prompt/Tool Updates

1. **Safety prompt placement:** REPLACE the existing `## Safety` block in `buildSystemPrompt()` with the new "Safety Detection Protocol" section. Do not append.

2. **Reminder prompt:** Do NOT include safety instructions in `buildReminderPrompt()`. Keep it minimal - reminder calls are ~30 seconds. The keyword backstop will still run.

3. **Prompt length:** Adjust the provided text to fit the ~100 words guideline. The example in this spec is longer for clarity; condense for actual implementation.

4. **Tool definitions:** Only update the main `sendSessionConfig()` tools array. Do NOT update the `sendTextInput()` tool definitions - those are legacy duplicates.

### Keyword Detection Behavior

1. **Multi-tier matches:** When a single transcript matches multiple tiers (e.g., "I'm hopeless and want to kill myself"), log ALL matched tiers as separate events. Inject hint for the HIGHEST matched tier only.

2. **Context-required patterns:** For ambiguous phrases like "kill me", use context-required matching:
   - Only match "kill me" if preceded by "want to" or "going to" → "want to kill me", "going to kill me"
   - Standalone "kill me" (e.g., "this traffic will kill me") should NOT trigger

3. **Debouncing scope:** Track BOTH backstop AND model tool calls for debouncing. If the model already logged a tier, the backstop should skip that tier too. This prevents duplicates while still allowing escalation to new tiers.

### Exclusion/Context Handling

1. **Pattern matching:** Use word-boundary regex (`\b`) for exclusion patterns, not simple substring checks. This prevents over-excluding (e.g., "hopelessness" should not be caught by "hopeless" exclusion).

2. **"Talking about others" exclusions:** Keep these exclusions (my friend, neighbor) even though they risk missing some genuine cases. The model confirmation layer will catch cases where the person transitions from discussing others to expressing their own distress.

### Language Support

1. **Spanish keywords:** Include BOTH English keywords for all calls AND add basic Spanish equivalents for MVP:
   ```typescript
   // Add to high tier
   'suicidio', 'matarme', 'quiero morir', 'acabar con todo',
   // Add to medium tier
   'sin esperanza', 'no vale la pena', 'rendirme',
   // Add to low tier
   'muy solo', 'muy sola', 'nadie me quiere'
   ```
   Run keyword detection on ALL calls regardless of language setting.

### Metrics/Logging

1. **End-of-call summary location:** Emit in `completeCallSession()`, NOT in `summarizeAndExtractMemories()`. This ensures it fires even when summarization is skipped.

2. **Source field storage:** Store `source` in the signals JSONB field for all events (as shown in spec). Default `source` to `'model'` when not provided (backwards compatibility).

3. **Keyword privacy:** NEVER store actual matched keywords in logs or database. Only store generic descriptions like `'keyword_backstop_detected'` with tier.

4. **Trusted contact notifications:** Only notify for `source: 'model'` events. Backstop-only detections do NOT trigger notifications. When `source` is missing, default to `'model'` for backwards compatibility.

### Frontend/Constants

1. **constants.ts changes:** Do NOT modify `SAFETY.DISTRESS_KEYWORDS` in `src/lib/ultaura/constants.ts`. Add the new tiered structure only in the telephony codebase (`telephony/src/utils/safety-keywords.ts` or inline in grok-bridge.ts). This avoids breaking any frontend consumers.

### Testing

1. **Unit tests:** Skip for now. Focus on implementation first; tests can be added later if needed.

### Feature Flags

1. **No feature flag needed.** Ship the feature enabled by default - safety should always be on. If issues arise, we can add a killswitch later.

---

## Future Enhancements (Out of Scope)

- Per-account keyword customization
- ML-based sentiment analysis instead of/in addition to keywords
- Voice tone analysis (audio-level distress detection)
- Dashboard UI for viewing safety event history
- Configurable sensitivity levels per line
- Additional language keyword lists beyond English/Spanish
