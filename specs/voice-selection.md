# Ultaura Spec: Voice Selection (Onboarding + Line Settings)

## Objective

Add Grok voice selection in two places:

1) **Onboarding flow**: required step where the user chooses the preferred AI companion voice for the first line being created.
2) **Line Settings**: allow changing the line’s voice at any time after setup.

Voices available: **Ara, Eve, Leo, Rex, Sal**.

The selected voice must:
- Persist on `ultaura_lines` in the database.
- Be used by telephony when configuring Grok sessions (no hardcoded `'Ara'`).

## Scope

In scope:
- New onboarding step (required) for the single line created during onboarding.
- New “Voice Preference” section on line settings, with **immediate save** on selection.
- DB migration: `ultaura_lines.preferred_grok_voice` (text, NOT NULL, default `'Ara'`) + DB CHECK constraint.
- Update schema validation and server actions to accept/update voice.
- Telephony uses stored voice, with fail-safe fallback to `'Ara'`.
- Add a small `voices` i18n namespace + onboarding keys (English entries now; no hardcoded strings for this feature).
- Copy existing voice SVGs into Next.js public assets so they can be rendered in both contexts.

Explicitly out of scope:
- Adding voice selection to “Add Line” flow (newly-added lines default to Ara; user can change later in settings).
- Any in-call voice switching (voice changes apply to the **next** call only).
- Audio preview/playback UI.

## Current Code Touchpoints (as of this repo state)

Onboarding:
- Flow + state: `src/app/onboarding/components/OnboardingContainer.tsx`
- Completion POST handler: `src/app/onboarding/complete/route.ts`
- Existing step UI patterns: `src/app/onboarding/components/*.tsx` (e.g., `UserTypeStep.tsx`, `PlanSelectionStep.tsx`)

Line Settings:
- Page (server): `src/app/dashboard/(app)/lines/[lineId]/settings/page.tsx`
- UI + save logic (client): `src/app/dashboard/(app)/lines/[lineId]/settings/SettingsClient.tsx`
- Line update action: `src/lib/ultaura/lines.ts` (`updateLine`, `createLine`)
- Validation schemas: `packages/schemas/src/line.ts`

Telephony:
- Grok voice currently hardcoded in session config: `telephony/src/websocket/grok-bridge.ts` (`voice: 'Ara'`)
- Line is loaded (select `*`) for media stream: `telephony/src/services/line-lookup.ts` → `telephony/src/websocket/media-stream.ts`
- Telephony line type is defined manually: `telephony/src/utils/supabase.ts` (`export interface LineRow`)

Voice constants + demo UI:
- Voice list + default: `src/lib/ultaura/constants.ts` (`GROK.VOICES`, `GROK.DEFAULT_VOICE`)
- Voice descriptions/traits exist (currently non-i18n): `src/lib/ultaura/constants.ts` (`VOICE_DEMO.VOICE_INFO`)
- Demo card UI (no preview needed here, but styling reference): `src/app/(site)/demo/page.tsx`
- SVG assets exist in remotion only today: `remotion/public/voices/{ara,eve,leo,rex,sal}.svg`

## UX Requirements

### A) Onboarding Voice Selection Step

Placement (required):
- **Self** flow: after `BirthdayStep`, before `PlanSelectionStep`.
- **Family** flow: after `LovedOneSetupStep`, before `PlanSelectionStep`.

Behavior:
- Default selection is **Ara** preselected.
- User can change selection; no “skip”.
- Continue advances to the next step; Back goes to previous step.

UI requirements:
- Use the same “selection card” visual language as onboarding (rounded cards, selected ring, hover affordances).
- Show for each voice:
  - icon (SVG)
  - name
  - description
  - trait chips (3)
- Responsive 5-card grid (1–2 columns on small screens, 3+ on larger, 5 on wide where feasible).

Copy (i18n; English values provided in implementation):
- Heading + subheading for this step.
- All voice display strings must come from i18n (no hardcoded descriptions/traits).

### B) Line Settings Voice Preference

Location:
- Add a “Voice Preference” section in **Calling & Availability** tab, near Language.

Behavior:
- Selecting a new voice triggers **immediate save**:
  - Call `updateLine(line.id, { preferredGrokVoice: <Voice> })` (only this field).
  - Show toast: “Voice updated”.
  - Show inline status: “Saving…” → “Saved”.
  - If save fails: show inline “Not saved” with a Retry action; do not pretend it succeeded.
  - Update the “dirty baseline” on success so the page does **not** show unsaved-changes warnings for a voice change that already saved.
- Include explicit helper text: **“Applies to your next call.”**

No audio preview:
- Cards only; no play buttons.

## Data Model

### Database schema change

Add column on `ultaura_lines`:
- `preferred_grok_voice TEXT NOT NULL DEFAULT 'Ara'`

Add a CHECK constraint:
- allowed values: `'Ara'`, `'Eve'`, `'Leo'`, `'Rex'`, `'Sal'`

Migration file:
- Create a new file in `supabase/migrations/` **with a filename timestamp greater than the current maximum in this repo** (to avoid out-of-order migration drift in prod).
  - Implementation step: inspect `supabase/migrations/` and choose a timestamp that sorts after the latest existing file (the repo already contains `202603...` migrations).
  - Example format only (do not copy verbatim): `supabase/migrations/20260325000001_add_preferred_grok_voice.sql`

Migration requirements:
- Use an **explicit constraint name** (do not rely on auto-named CHECK constraints, which are hard to manage consistently across environments):
  - `ultaura_lines_preferred_grok_voice_check`
- Backfill/normalize existing rows (defensive):
  - Ensure any NULLs or unexpected values become `'Ara'` **before** enforcing NOT NULL / CHECK.
- Add `COMMENT ON COLUMN ultaura_lines.preferred_grok_voice ...` describing purpose and that it applies to next call.
- Keep migration idempotent where feasible (`ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS <named_constraint>` then add).

Recommended idempotent SQL pattern (illustrative; adjust to repo SQL conventions):
```sql
ALTER TABLE ultaura_lines
  ADD COLUMN IF NOT EXISTS preferred_grok_voice TEXT;

UPDATE ultaura_lines
SET preferred_grok_voice = 'Ara'
WHERE preferred_grok_voice IS NULL
   OR preferred_grok_voice NOT IN ('Ara', 'Eve', 'Leo', 'Rex', 'Sal');

ALTER TABLE ultaura_lines
  ALTER COLUMN preferred_grok_voice SET DEFAULT 'Ara';

ALTER TABLE ultaura_lines
  ALTER COLUMN preferred_grok_voice SET NOT NULL;

ALTER TABLE ultaura_lines
  DROP CONSTRAINT IF EXISTS ultaura_lines_preferred_grok_voice_check;

ALTER TABLE ultaura_lines
  ADD CONSTRAINT ultaura_lines_preferred_grok_voice_check
  CHECK (preferred_grok_voice IN ('Ara', 'Eve', 'Leo', 'Rex', 'Sal'));
```

### Type generation

This repo generates Supabase types into `src/database.types.ts`:
- Script: `pnpm typegen` (see `package.json`).
- After adding the migration, implementation should regenerate and commit updated `src/database.types.ts`.

Telephony has its own manual `LineRow` type:
- Update `telephony/src/utils/supabase.ts` to include `preferred_grok_voice: string` (and ideally narrow it to the allowed union).

## Shared Voice Definitions (Single Source of Truth)

Goal: avoid duplicated voice lists and reduce casing/order bugs.

Canonical display order:
1. Ara
2. Eve
3. Leo
4. Rex
5. Sal

Implementation guidance:
- Prefer a single exported list for UI rendering, including:
  - `id` (lowercase): `ara|eve|leo|rex|sal` (used for assets + i18n keys)
  - `apiName` (titlecase): `Ara|Eve|Leo|Rex|Sal` (stored in DB and sent to Grok)
  - `iconPath`: `/voices/<id>.svg`
  - `traitIds`: stable keys (e.g. `gentle`, `comforting`, etc.) that translate via i18n

Where to place:
- Option 1 (recommended): create `src/lib/ultaura/voices.ts` exporting `VOICE_OPTIONS` and helpers.
- Option 2: extend `src/lib/ultaura/constants.ts` with a `VOICE_OPTIONS` structure and reorder `GROK.VOICES` to match canonical display order.

## Validation + Server Actions

### A) `packages/schemas/src/line.ts`

Add to `CreateLineInputSchema`:
- `preferredGrokVoice`: enum of allowed values, optional with default `'Ara'`

Add to `UpdateLineInputSchema`:
- `preferredGrokVoice`: enum of allowed values, optional

Notes:
- Keep naming consistent with existing convention:
  - Input schemas use `camelCase`.
  - DB columns are `snake_case`.

### B) `src/lib/ultaura/lines.ts`

`createLine(...)`:
- Read `preferredGrokVoice` from parsed input.
- Insert `preferred_grok_voice: preferredGrokVoice` when creating `ultaura_lines`.
- Ensure default is `'Ara'` if not provided.

`updateLine(lineId, input)`:
- Map `preferredGrokVoice` → `preferred_grok_voice` in the `updates` object.

## Onboarding Implementation

### A) New step component

Add:
- `src/app/onboarding/components/VoiceSelectionStep.tsx`

Props:
- `onSubmit: (data: { preferredGrokVoice: 'Ara'|'Eve'|'Leo'|'Rex'|'Sal' }) => void`
- `onGoBack?: () => void`
- `value?: <Voice>` (optional if parent owns state; alternatively manage local state and submit)

UI:
- Match onboarding step structure used by other steps (form container, header, grid, buttons).
- Render 5 cards using canonical voice order and SVG icons from `/voices/*.svg`.
- Use selection-card styling pattern:
  - selected: `border-primary ring-2 ring-primary shadow-xl shadow-primary/20`
  - unselected: `border-border bg-card hover:ring-2 hover:ring-primary hover:shadow-sm`

i18n:
- Step heading/subheading from `public/locales/en/onboarding.json` (flat keys; see i18n section below)
- Voice metadata (name/description/traits) from `public/locales/en/voices.json`

### B) Wire into onboarding flow

File: `src/app/onboarding/components/OnboardingContainer.tsx`

Changes:
- Add `preferredGrokVoice: 'Ara'` to `defaultValues.data`.
- Insert `onboarding:voiceSelection` into step arrays:
  - Self steps: after `onboarding:birthday`, before `onboarding:plan`
  - Family steps: after `onboarding:lovedOneSetup`, before `onboarding:plan`
- Add `onVoiceSelectionSubmitted` callback:
  - `form.setValue('data.preferredGrokVoice', voice)`
  - `nextStep()`
- Render the new step via an `<If condition={stepId === 'onboarding:voiceSelection'}>`.

### C) Persist via onboarding completion

File: `src/app/onboarding/complete/route.ts`

Changes:
- Extend `getOnboardingBodySchema()` to accept `preferredGrokVoice` (enum of allowed values; default `'Ara'`).
- Include `preferredGrokVoice` in the `createLine({...})` call:
  - `preferredGrokVoice: body.preferredGrokVoice`

### D) Ensure typed onboarding POST body includes voice (TypeScript safety)

File: `src/app/onboarding/components/CompleteOnboardingStep.tsx`

Changes:
- Extend `CompleteOnboardingStepData` to include:
  - `preferredGrokVoice: 'Ara' | 'Eve' | 'Leo' | 'Rex' | 'Sal'`
- Ensure the mutation body posted to `/onboarding/complete` includes `preferredGrokVoice` (it posts `data` as-is).

File: `src/app/onboarding/components/OnboardingContainer.tsx`

Changes:
- Ensure the form’s `defaultValues.data` includes `preferredGrokVoice: 'Ara'` and it is passed through to `CompleteOnboardingStep`.

## Line Settings Implementation

### A) Section placement + navigation

File: `src/app/dashboard/(app)/lines/[lineId]/settings/SettingsClient.tsx`

Changes:
- Add a new section identifier in `LineSettingsSectionValue`, e.g. `'voice-preference'`.
- Add to `LINE_SETTINGS_SECTIONS.calling` near `language`.
- Implement section rendering in the `activeContent` switch.

Important: The settings page currently uses hardcoded strings for most sections; only **new voice feature strings** must be i18n’d.

### B) Voice selector component

Add (recommended):
- `src/app/dashboard/(app)/lines/[lineId]/settings/components/VoiceSelector.tsx`

Responsibilities:
- Render the 5 voice cards with icon/name/description/traits.
- Expose `value`, `onChange`, and `disabled`.
- Support a small helper row for inline status (Saving/Saved/Error + Retry).

### C) Immediate save behavior

State model (recommendation):
- `selectedVoice` state: current UI selection.
- `savedVoiceBaseline` state (or ref): the last successfully saved voice (initially from `line.preferred_grok_voice`).
- `saveStatus` state: `'idle' | 'saving' | 'saved' | 'error'`
- `lastAttemptedVoice` (optional) for retry.

On selection change:
1) Update UI selection immediately.
2) Set inline status to “Saving…”.
3) Call `updateLine(line.id, { preferredGrokVoice: newVoice })`.
4) On success:
   - toast “Voice updated”
   - set `savedVoiceBaseline = newVoice` (prevents unsaved-changes warnings)
   - set inline status “Saved” (auto-clear back to idle after a short delay)
5) On failure:
   - toast error (message from server action if available)
   - set inline status to “Not saved” and show Retry
   - keep baseline unchanged (so the form is considered dirty and unsaved-changes warnings are truthful)

Unsaved-changes logic:
- Update `hasLineChanges` computation so voice compares `selectedVoice !== savedVoiceBaseline`.
- This ensures successful immediate saves do not trigger navigation confirmation.

Helper text:
- Always show “Applies to your next call.”

## Telephony Implementation

Goal: eliminate hardcoded Grok voice and use `ultaura_lines.preferred_grok_voice`.

### A) Plumb voice from line → Grok bridge

File: `telephony/src/websocket/media-stream.ts`
- When constructing `new GrokBridge({ ... })`, include:
  - `preferredGrokVoice: line.preferred_grok_voice`

### B) Use voice in Grok session config

File: `telephony/src/websocket/grok-bridge.ts`

Changes:
- Extend `GrokBridgeOptions` with:
  - `preferredGrokVoice?: string | null` (or a narrowed union)
- In `sendSessionConfig()`, set:
  - `voice: resolvedVoice`

Resolution rules (defense in depth):
- If `preferredGrokVoice` is one of the allowed voices → use it.
- Otherwise → use `'Ara'` (fail safe).

Behavior note (must match UX):
- The voice is selected at session configuration time; voice changes in dashboard apply to the **next** call.
- No attempt to update voice mid-call.

### C) Telephony type updates

File: `telephony/src/utils/supabase.ts`
- Add `preferred_grok_voice` to the `LineRow` interface.

## Static Assets

Copy voice SVGs into Next.js public assets for runtime use:
- From: `remotion/public/voices/{ara,eve,leo,rex,sal}.svg`
- To: `public/voices/{ara,eve,leo,rex,sal}.svg`

Notes:
- The UI should reference these via `/voices/<id>.svg`.

## i18n

### A) New namespace: `voices`

Add:
- `public/locales/en/voices.json`

Keying:
- Use lowercase IDs for keys: `ara|eve|leo|rex|sal`.
- Store display/API name as values:
  - `voices.ara.name = "Ara"`

Suggested structure:
- `voices.<id>.name`
- `voices.<id>.description`
- `traits.<traitId>`
- `ui.voicePreference.*` (section title/description, statuses, toast messages)

### B) Onboarding keys

Update:
- `public/locales/en/onboarding.json`

Add keys:
- `voiceSelection` (step label; used by Stepper via `onboarding:voiceSelection`)
- `voiceSelectionHeading` (heading)
- `voiceSelectionDescription` (subheading/description)

Important:
- Do **not** use nested keys like `voiceSelection.heading` because i18next’s default `keySeparator: '.'` treats this as an object path, which conflicts with also needing `voiceSelection` as a flat string label.

### C) Ensure i18n can load new namespace

Update default namespaces list:
- `src/i18n/i18n.settings.ts`: add `'voices'` to `defaultI18nNamespaces`

## Ordering of Voices

Canonical display order is:
- Ara, Eve, Leo, Rex, Sal

Implementation requirement:
- Ensure both onboarding and settings render in this order.
- If relying on `GROK.VOICES`, reorder it to match canonical display order and treat it as the display order source.

## Types Checklist (End-to-End Type Safety)

During implementation, explicitly verify/update these type touchpoints:

App (Next.js):
- `src/database.types.ts`: regenerate via `pnpm typegen` so `ultaura_lines` includes `preferred_grok_voice`.
- `src/lib/ultaura/types.ts`: confirm `LineRow` (derived from `Database`) now exposes `preferred_grok_voice` and any compile errors are resolved.
- `src/lib/ultaura/constants.ts`: if `GROK.VOICES` is reordered, confirm `export type GrokVoice = typeof GROK.VOICES[number]` still represents the intended union.

Schemas + server actions:
- `packages/schemas/src/line.ts`: add `preferredGrokVoice` to create/update schemas.
- `src/lib/ultaura/lines.ts`: map `preferredGrokVoice` ⇄ `preferred_grok_voice`.

Domain types (type hygiene / coherence):
- `src/lib/ultaura/types.ts`: explicitly add `preferredGrokVoice` to any relevant Ultaura “domain” types used across UI/server, even if most screens use `LineRow` directly.
  - Minimum expectations:
    - `Line` / `LineProfile`-style interfaces (if present) include `preferredGrokVoice?: GrokVoice` (or `GrokVoice | null`) and/or a clear mapping from `LineRow.preferred_grok_voice`.
    - `CreateLineInput` / `UpdateLineInput` domain interfaces include `preferredGrokVoice?: GrokVoice`.
  - Goal: avoid having the schemas/server actions accept a field that the shared domain types don’t represent.

Onboarding:
- `src/app/onboarding/components/CompleteOnboardingStep.tsx`: extend `CompleteOnboardingStepData` with `preferredGrokVoice`.
- `src/app/onboarding/components/OnboardingContainer.tsx`: include `preferredGrokVoice` in `defaultValues` and submitted `data`.

Telephony:
- `telephony/src/utils/supabase.ts`: extend `LineRow` with `preferred_grok_voice`.
- `telephony/src/websocket/media-stream.ts` / `telephony/src/websocket/grok-bridge.ts`: pass and validate the preferred voice.

## Security / Logging Hygiene (PII)

While implementing voice selection, `src/app/onboarding/complete/route.ts` will be edited to pass `preferredGrokVoice` through to `createLine(...)`.

Requirement:
- Remove or guard any debug `console.log` statements that print the onboarding request body and/or validation errors, since onboarding includes PII (phone numbers, names).
- Acceptable patterns:
  - Preferred: remove these debug logs entirely.
  - Alternative: guard logs so they only run in local/dev when an explicit debug flag is enabled (e.g., `process.env.NODE_ENV !== 'production'` and `process.env.ULTAURA_DEBUG === 'true'`), and redact phone numbers before logging.

## Voice Demo Data (Non-goal Clarification)

`VOICE_DEMO.VOICE_INFO` and `src/app/(site)/demo/page.tsx` currently contain non-i18n voice descriptions/traits and can remain unchanged for this feature.

Optional follow-up (separate task, not required for acceptance):
- Migrate demo voice display strings to the new `voices` namespace and reuse the same voice metadata source as onboarding/settings.

## Error Handling & Edge Cases

Onboarding:
- If voice data is missing or invalid in POST, server should reject the request (400) with a safe error message (consistent with current onboarding handler behavior).
- Since voice defaults to Ara, “missing” should be rare; still validate.

Line Settings immediate save:
- Debounce/avoid double-submits:
  - If user clicks multiple voices quickly, either:
    - cancel/ignore in-flight and only apply latest, or
    - queue last selection and apply after current request resolves.
  - Minimum requirement: do not allow stale success to overwrite a newer selection’s status.
- Disabled state:
  - When the page is disabled (trial expired), voice selection must be disabled too.

Telephony:
- If DB contains an unexpected value, default to Ara and log a warning (include `lineId`, `callSessionId`).

## Testing & Validation

Database:
- Migration applies cleanly.
- Constraint rejects invalid values.
- Existing rows end up with `'Ara'` after migration.

Schemas:
- Unit tests (where present) updated/added to confirm:
  - Create accepts default voice.
  - Update rejects invalid voice.

Server actions:
- `createLine` stores `preferred_grok_voice`.
- `updateLine` updates `preferred_grok_voice` only when requested.

Onboarding:
- E2E/manual flow:
  - Self: Birthday → Voice → Plan → Complete → verify page.
  - Family: LovedOneSetup → Voice → Plan → Complete → verify page.

Line settings:
- Manual:
  - Selecting a voice shows Saving → Saved and toast.
  - Reload shows persisted voice.
  - Failure mode shows Not saved + Retry; unsaved-changes warning appears if navigating away with an unsaved selection.

Telephony:
- Add/adjust a unit test in `telephony/src/websocket/__tests__` (or existing suite) to verify:
  - `sendSessionConfig` uses passed `preferredGrokVoice`.
  - invalid value falls back to `'Ara'`.

## Acceptance Criteria (must all be met)

1) New onboarding step allows voice selection with visual cards (icons + name + description + traits).
2) Selected voice persists to DB on line creation (`ultaura_lines.preferred_grok_voice`).
3) Line settings shows current voice and allows changing it.
4) Voice changes persist immediately on selection (with toast + inline status) and do not trigger unsaved-changes warnings after successful save.
5) Telephony uses the stored voice (not hardcoded) and fails safe to Ara for invalid values.
6) UI matches existing patterns in onboarding and settings contexts.
7) All five voices available in canonical order: Ara, Eve, Leo, Rex, Sal.
