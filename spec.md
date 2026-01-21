# Ultaura Test Harness Spec: Deterministic Call Simulator + Privacy Invariants

## Objective

Ship a deterministic, fast automated test harness for Ultaura’s telephony runtime to reduce regressions and improve development velocity in a feature-rich codebase.

This spec covers:

1. A deterministic “call simulator” that feeds Twilio Media Streams events into `telephony/src/websocket/media-stream.ts` and uses a mocked Grok WebSocket (no network).
2. “Privacy invariants” tests enforcing:
   - **No transcript storage at rest** (A2 policy)
   - **No tool-args persistence** in observability surfaces (logs, `ultaura_call_events`, `ultaura_debug_logs`)
   - **Derived-artifact minimization rules** for stored free-text (memories/insights/summaries)
   - **Cognitive observations must not store free-text** (`context`, `response_given`)

Out of scope for this spec (explicitly deferred):
- DST scheduling tests
- Lease coordination / distributed scheduler tests

## Background / Current State (Codebase Reality)

### Core runtime entry points

- Twilio ↔ Grok call bridge:
  - `telephony/src/websocket/media-stream.ts` (`handleMediaStreamConnection`)
  - `telephony/src/websocket/grok-bridge.ts` (`GrokBridge`)

### Existing privacy protections (partial)

- `ultaura_call_events` is designed as “minimal, no transcripts” (schema comment in `supabase/migrations/20241220000001_ultaura_schema.sql`).
- `recordCallEvent()` sanitizes payload via allowlists:
  - `telephony/src/services/call-session.ts` (`recordCallEvent`)
  - `telephony/src/utils/event-sanitizer.ts` (`sanitizePayload`, allowlists)
- `telephony/src/utils/redact.ts` provides `summarizeArgs()` and redaction helpers; `media-stream.ts` already uses `argsSummary` for tool debug logs.

### Current risk/bug surfaces relevant to this spec

- `telephony/src/services/call-session.ts` (`recordDebugEvent`) currently encrypts and stores the **raw payload** (ciphertext) when encryption succeeds. Under the adopted policy (“encrypted still counts as stored”), this is **not allowed** unless the encrypted payload is guaranteed to never include transcript/tool-arg values.
- `telephony/src/routes/tools/log-cognitive-observation.ts` stores plaintext free-text fields (`context`, `response_given`) into `ultaura_cognitive_observations`.

## Product Policy Definitions (Authoritative for Implementation)

### Transcript (call conversational content)

“Transcript” means any verbatim or near-verbatim conversational content from a call, including:
- User STT content (e.g., `conversation.item.input_audio_transcription.completed` handled in `telephony/src/websocket/grok-bridge.ts`)
- Assistant text output (even if later rendered as audio)
- Any stored field containing multi-sentence/quote-like chunks from either side (even if labeled “summary”)

### Tool args

“Tool args” means structured JSON arguments the model sends with a tool call (e.g., `args.value`, `args.message`, `args.clarification`, etc.), plus any “context” blobs that could include conversational content (e.g., safety context windows).

### Policy: A2 “No transcript storage”

**No raw transcripts (verbatim user/assistant utterances) are stored at rest by Ultaura.**

Derived artifacts (memories/insights/summaries) may be stored **only** when allowed by privacy settings + consent, and only in minimized form (see below).

Encryption does not change “stored at rest”: **encrypted still counts as stored.**

### Derived-artifact minimization rules (hard constraints)

For any stored free-text fields considered “derived artifacts” (memories / insights / summaries / highlights):

1. **No direct quotes**
2. **No multi-sentence paragraphs**: cap at **1 sentence** and/or **≤200 chars** per free-text field
3. **No speaker labels** (`[USER]`, `User:`, `Assistant:`, etc.)
4. **No newline characters**

These constraints apply to anything stored for conversational derived artifacts, including family-facing “conversation highlights” (must be non-verbatim).

### Domain content carve-out

User-authored domain content (e.g., reminder messages) is stored intentionally and is **not** considered transcript storage. The no-transcript guarantee applies to **call conversational content**, not user-entered text that powers product features.

### Consent/tool gating standard

Defense in depth (**C3**):
- If consent not granted, the tool should not be available to the model **and**
- the server must reject any attempt (even if model tries).

Memory consent also requires a post-consent-only guarantee for end-of-call extraction:
- Only **post-consent** turns may be used for memory extraction, even if earlier turns existed.

## Scope

### In scope

1. Deterministic call simulator tests for `handleMediaStreamConnection`.
2. Privacy invariant tests (sentinel + pattern checks) for:
   - `recordCallEvent` sanitization behavior
   - `recordDebugEvent` behavior (no raw payload persistence, even encrypted)
   - logger output (no transcript/tool-arg values)
   - cognitive observations: stop storing free-text fields
3. Tool availability gating assertions by inspecting `session.update` / session config messages sent to Grok.
4. Server-side rejection tests for consented actions (at least memory storage pre-consent).

### Out of scope

- DST scheduling tests
- Lease coordination / scheduler tests
- Full integration tests requiring a real Supabase DB (optional future)

## Technical Requirements & Constraints

### Determinism & speed

- Tests must be deterministic: no wall-clock dependence; use `vi.useFakeTimers()` and `vi.setSystemTime()` where needed.
- No network calls: stub `fetch`, mock `ws` and Twilio client.
- Tests should run fast (< a few seconds for the suite) and in CI.

### Where tests live / how they run

Telephony tests are executed via the telephony package:
- `telephony/package.json` → `pnpm test` runs `vitest run -c vitest.config.ts`

The root `vitest.config.ts` only includes `src/lib/ultaura/__tests__/**`, so telephony tests must remain in `telephony/src/**/__tests__`.

### Compatibility

- Node 18+ (per repo engines)
- TypeScript ESM (`"type": "module"` in telephony)
- Use existing Vitest patterns in repo (e.g., `vi.hoisted`, module mocks).

## High-Level Implementation Approach

### Strategy Overview

Build a simulator test harness that:

1. Creates a **fake Twilio WebSocket** and passes it into `handleMediaStreamConnection`.
2. Mocks the Grok WebSocket transport so `GrokBridge.connect()` uses a **fake Grok socket**:
   - Capture outgoing messages (`session.update`, `conversation.item.create`, `response.create`, etc.).
   - Allow tests to inject Grok inbound messages (transcript events, tool-call events, audio deltas, disconnects).
3. Stubs/mocks all external dependencies used by `media-stream.ts`:
   - Supabase/services for session/line/privacy
   - Twilio API usage
   - `fetch` tool endpoint calls
   - timers

Then add privacy invariant tests that validate:
- nothing “sensitive” reaches persistence/log sinks
- derived text meets minimization rules

### Recommended module-level seams (minimal code change)

Prefer to achieve this with **test-time module mocking** first.

#### Mocking `ws`

`grok-bridge.ts` imports `WebSocket` from `ws` and constructs it directly. In tests:
- Use `vi.mock('ws', ...)` to provide a fake `WebSocket` implementation.
- The fake must:
  - implement `.on(event, handler)`, `.send(data)`, `.close()`
  - set `.readyState` and expose `WebSocket.OPEN` constant
  - allow test code to emit events (`open`, `message`, `close`, `error`)

Note: `media-stream.ts` also imports `WebSocket` for constants like `WebSocket.OPEN`; mocking `ws` must preserve those constants and not break Twilio-side logic (Twilio WS itself is passed in, not constructed).

If mocking `ws` proves too brittle, a small refactor is allowed in implementation:
- Introduce a `createWebSocket()` factory injected into `GrokBridge` (defaulting to `new WebSocket(...)`) to enable clean unit tests.

### Test Harness Components (to implement)

#### 1) Fake Twilio WebSocket

Create `FakeTwilioWebSocket` implementing the subset used by `handleMediaStreamConnection`:
- `.on('message'|'close'|'error', handler)`
- `.send(data: string)` (capture outgoing Twilio messages)
- `.close(code?: number, reason?: string)`
- `.readyState`

Add helper methods for tests:
- `emitMessage(obj: unknown)` → emits Buffer JSON as Twilio would
- `emitClose(code, reason)`
- `getSentMessages()` (records everything sent to Twilio)

#### 2) Fake Grok WebSocket

Create `FakeGrokWebSocket` used by mocked `ws` module for GrokBridge connections:
- `.send(data: string)` stores messages sent to Grok (for assertions)
- `emitOpen()`, `emitMessage(obj)`, `emitClose()`, `emitError(err)`
- Track `readyState`

Expose helper accessors:
- `sentJson()` parsed array of objects
- `findLastSessionUpdate()` for tool gating assertions

#### 3) Minimal “tool endpoint” fetch router (no HTTP)

To validate “server-side rejection” in addition to tool gating, tests must exercise real tool endpoint logic at least for memory consent gating.

Approach:
- Stub global `fetch` with a handler that routes requests by URL path to in-process Express routers (or directly to service functions), without opening a network port.
- For Phase 1, required endpoints:
  - `/tools/grant_memory_consent`
  - `/tools/deny_memory_consent`
  - `/tools/store_memory` (must be rejected pre-consent)
  - `/tools/memory_guard` if applicable (or the enforcement used by store/update)

If wiring Express is too heavy initially, an acceptable alternative is:
- Separate unit tests for tool routes (real router handler invocation) + simulator tests that only validate gating.

## Privacy Invariants (Testable Contracts)

### Sentinel-based leak detection (must-have)

Introduce a sentinel constant used in tests:
- `SENSITIVE_SENTINEL_12345` (exact string)

Inject sentinel in multiple places:
- Grok transcript event content (user transcript)
- Tool args (e.g., `args.value`, `args.message`, `args.clarification`)
- Derived artifact candidate strings (when simulating extraction)

Assert the sentinel never appears in:
1. Any captured DB insert/update payloads (mock Supabase client, capture args)
2. Any logger calls (mock `logger` and scan payload/message)
3. Any debug-log inputs prior to encryption and any persisted debug payload summaries

### Pattern checks enforcing minimization rules (must-have)

For any stored derived free-text fields (memories/insights/summaries), assert:
- No `\n` or `\r`
- No speaker labels:
  - regex examples: `/\\b(User|Assistant)\\s*:/i`, `/\\[(USER|ASSISTANT)\\]/i`
- Length ≤ 200 chars for each free-text field
- “Single sentence” constraint:
  - Implementation rule should be deterministic and conservative (truncate at first sentence terminator), while tests should enforce no multiple terminators (`.`/`!`/`?`) beyond the first.
- “No direct quotes”:
  - For now enforce **no double-quote characters** (`"`) in stored derived strings.

Avoid brittle heuristics (no full transcript-likeness classifier).

## Concrete Test Plan

### New test files (telephony)

1. `telephony/src/websocket/__tests__/media-stream-simulator.test.ts`
   - End-to-end unit simulation of `handleMediaStreamConnection`
   - Uses FakeTwilioWebSocket and FakeGrokWebSocket (via `ws` mock)
   - Asserts:
     - Grok session configuration contains expected tool list pre/post consent (tool gating)
     - Server-side rejection is validated via separate tests or fetch router
     - Sentinel does not leak into logs or persistence sinks
     - Post-consent-only guarantee is honored for end-of-call extraction
     - No leaks during Grok disconnect/reconnect path

2. `telephony/src/services/__tests__/privacy-invariants-call-events.test.ts`
   - Unit tests for `recordCallEvent` sanitization behavior:
     - Provide payload containing nested `args` with sentinel and verify it is stripped and not persisted.
     - Verify tool allowlists do not include free-text fields.

3. `telephony/src/services/__tests__/privacy-invariants-debug-logs.test.ts`
   - Unit tests for `recordDebugEvent`:
     - Ensure raw payload values are never persisted (including ciphertext) under strict policy.
     - Ensure only `payload_summary`/`safePayload.summary` is stored (type/size only), and it passes pattern checks (no sentinel).
     - Ensure `encryptDebugPayload` is called only with safe summary, not raw payload.

4. `telephony/src/routes/tools/__tests__/memory-consent-gating.test.ts`
   - Direct router handler tests ensuring server rejects memory-changing tools when consent is not granted.
   - Must validate:
     - No DB writes of tool args/transcripts
     - Proper call event is recorded with allowlisted fields only

5. `telephony/src/routes/tools/__tests__/cognitive-observation-no-free-text.test.ts`
   - Tests for `log-cognitive-observation` route:
     - Even if request includes `context` and `response_given`, the stored row must set them to null / omit.
     - Sentinel must not be persisted.

### Required simulator scenarios (P0)

#### Scenario S1: Basic call lifecycle

Input:
- Twilio events: `connected` → `start` → a few `media` frames → `stop` → `close`

Assertions:
- `updateCallStatus(..., 'in_progress', ...)` invoked (mocked)
- No persistence/log leaks containing sentinel (use a transcript event injection in S2/S3 for sentinel coverage)

#### Scenario S2: Memory consent gating + tool availability gating

Input:
- Start call
- Pre-consent: simulate Grok attempting `store_memory` with tool args containing sentinel
- Then simulate `grant_memory_consent` tool call success
- Post-consent: simulate transcript event(s) and then call ends

Assertions:
- **Tool list** in Grok `session.update`:
  - Before consent: memory storage tools are not present; consent tools are present if needed.
  - After granting: memory tools become present.
- **Server-side enforcement**:
  - Pre-consent `store_memory` is rejected by backend (via route test or fetch router)
- **Post-consent-only**:
  - End-of-call extraction (if triggered) uses only turns after consent index.
  - Any derived artifacts stored comply with minimization rules.

#### Scenario S3: Disconnect/reconnect error path

Input:
- Start call
- Trigger Grok socket close/error mid-call to exercise `media-stream.ts` recovery path

Assertions:
- No sentinel leaks during error handling logs/debug events
- No debug log ciphertext contains raw payloads

## Implementation Details (What Must Change in Code)

This section is for the future implementation agent; no code is to be changed during planning beyond creation of this spec file.

### 1) Debug logs must not persist raw payload (even encrypted)

Current behavior in `telephony/src/services/call-session.ts`:
- `recordDebugEvent` encrypts and stores the raw payload as ciphertext when possible.

Required change:
- Debug logs must store **only** safe summaries (argsSummary / type/size metadata) and non-sensitive operational metadata.
- `encryptDebugPayload(...)` must only ever encrypt a **safe payload summary**, not raw payload values.

Acceptance criteria:
- Sentinel never appears in:
  - `ultaura_debug_logs.payload_summary`
  - any encrypted payload inputs
  - any stored ciphertext plaintext-equivalent (by construction; since we never encrypt raw payload)

### 2) Stop storing cognitive observation free-text

Current behavior:
- `telephony/src/routes/tools/log-cognitive-observation.ts` stores `context` and `response_given` into `ultaura_cognitive_observations`.

Required change:
- Never persist `context` or `response_given` (always null / omitted), regardless of input.
- Prefer structured enums and counters only:
  - `observation_type`, `severity`, `is_novel`, `similar_observation_count`, timestamps, and computed flags.

### 3) Derived artifact minimization enforcement

Where to enforce:
- At storage boundaries for derived artifacts, not only at generation time.

Implementation approach:
- Create a shared helper (telephony) that:
  - Normalizes strings: remove newlines, strip speaker labels, enforce max length, truncate to one sentence, strip `"` characters.
  - Recurses through known derived-artifact shapes and applies to all free-text fields.
- Apply the helper in:
  - Memory storage/update paths when source is conversation-derived (`telephony/src/services/memory.ts`)
  - Insights persistence paths (`telephony/src/routes/tools/log-call-insights.ts`, `telephony/src/services/insights*.ts`)
  - Any other derived-artifact persistence used in call flow

Note:
- User-authored domain content (e.g., reminder messages) should not be forced through derived-artifact minimization.

### 4) Media stream simulator: ensure tool gating is testable

Because tool availability gating is implemented in `GrokBridge.getActiveTools()` and is reflected in outgoing Grok `session.update` messages, tests must capture what `GrokBridge` sends via its internal WebSocket.

Implementation approach:
- Mock `ws` in tests, or add a `WebSocketFactory` seam into `GrokBridge` if needed for clean injection.

## Dependencies & Integrations

### Internal modules used by simulator tests

- `telephony/src/websocket/media-stream.ts`
- `telephony/src/websocket/grok-bridge.ts`
- `telephony/src/services/call-session.ts` (`recordCallEvent`, `recordDebugEvent`)
- `telephony/src/utils/event-sanitizer.ts`
- `telephony/src/utils/redact.ts` (`summarizeArgs`)
- `telephony/src/services/call-summarization.ts` (post-consent-only slicing)

### External libs

- `vitest`
- `ws` (mocked in tests)
- `express` (optional in-process router invocation)

## Edge Cases & Error Handling Requirements

1. **Mid-call consent**:
   - Consent granted after some turns exist must cause post-consent slicing for extraction.
2. **Model misbehavior**:
   - If Grok attempts a tool call that should be unavailable, backend must still reject.
3. **Error paths**:
   - Grok disconnect/reconnect should not emit logs or debug payloads containing sensitive values.
4. **Test calls / preview mode**:
   - Simulator should define how to configure `session.is_test_call` and `session.is_preview_mode` and expected consent behavior. Phase 1 tests may keep these off unless explicitly needed.

## Acceptance Criteria (Definition of Done)

### Simulator

- A deterministic `media-stream` simulator test exists and runs in CI without network.
- It validates tool gating by inspecting Grok `session.update` / tool list messages.
- It validates server-side rejection for memory storage pre-consent (direct tool route tests acceptable).
- It validates post-consent-only extraction behavior at least via unit assertions.

### Privacy invariants

- Sentinel leak tests are implemented and passing:
  - No sentinel appears in DB payloads, logs, debug logs inputs, or stored summaries.
- Pattern checks enforce:
  - No newline characters
  - No speaker labels
  - Max length ≤ 200 characters
  - Single-sentence constraint (deterministic truncation)
  - No `"` in derived artifact strings
- Cognitive observation route no longer stores free text (`context`, `response_given`).
- Debug logs never store raw payload values at rest (encrypted counts as stored).

## How to Run (for implementation phase)

- Telephony tests:
  - `cd telephony && pnpm test`
  - or `pnpm --filter @ultaura/telephony test`

## Assumptions

- The simulator can be implemented via test-time mocks without needing a real Twilio/Grok connection.
- Modest refactors are acceptable if mocking `ws` is too brittle, but behavior must remain unchanged.
- DST scheduling and lease coordination are deferred and will be handled in a separate spec.

