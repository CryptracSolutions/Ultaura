# Multilingual Support Specification

## Objective

Remove structural blockers preventing Ultaura from leveraging Grok Voice Agent's full 100+ language capability. Currently, the database schema, TypeScript types, and UI hardcode support for only English and Spanish, directly conflicting with our stated product differentiator.

## Scope

**In Scope:**
- Remove `preferred_language` column and CHECK constraint from database
- Remove `spanish_formality` column from database
- Remove language selection UI from dashboard
- Update system prompts for pure auto-detection
- Implement "last detected language" lookup for voicemails and reminders
- Display detected language in call history
- Add marketing copy about 100+ languages

**Out of Scope:**
- i18n/localization of the dashboard itself (remains English-only)
- Language analytics dashboards
- Per-account language defaults

---

## Current State Analysis

### Database Schema (`supabase/migrations/20241220000001_ultaura_schema.sql`)

```sql
-- ultaura_lines table (lines 82-83)
preferred_language text not null default 'auto' check (preferred_language in ('auto', 'en', 'es')),
spanish_formality text not null default 'usted' check (spanish_formality in ('usted', 'tu')),
```

### TypeScript Types (`packages/types/src/language.ts`)

```typescript
export type PreferredLanguage = 'auto' | 'en' | 'es';
export type SpanishFormality = 'usted' | 'tu';
```

### Constants (`src/lib/ultaura/constants.ts`, lines 178-196)

```typescript
export const LANGUAGES = {
  AUTO: 'auto',
  ENGLISH: 'en',
  SPANISH: 'es',
} as const;

export const LANGUAGE_LABELS: Record<string, string> = {
  auto: 'Auto-detect',
  en: 'English',
  es: 'Spanish',
};

export const SPANISH_FORMALITY_LABELS: Record<string, string> = {
  usted: 'Formal (usted)',
  tu: 'Informal (tú)',
};
```

### UI Components

1. **AddLineModal.tsx** (lines 211-227): Language dropdown with 3 options
2. **SettingsClient.tsx** (lines 139-186): Language select + conditional Spanish formality buttons
3. **LineDetailClient.tsx** (lines 298-300): Displays current language preference

### Prompt System (`packages/prompts/src/profiles/index.ts`)

```typescript
function formatLanguageSection(
  language: PreferredLanguage,
  spanishFormality: SpanishFormality | undefined,
  isRealtime: boolean
): string {
  // Only handles 'en', 'es', 'auto' cases
}
```

### Telephony Integration

- **media-stream.ts** (lines 189-200): Passes `preferred_language` and `spanish_formality` to GrokBridge
- **grok-bridge.ts**: Includes language in system prompt via `compilePrompt()`

---

## Target State

### Behavior Model

1. **All Calls (Check-ins AND Reminders)**:
   - Look up `language_detected` from the line's most recent completed call
   - Start the conversation in that language
   - Fall back to English if no previous call history exists
   - Seamlessly switch mid-conversation if the senior changes languages

2. **Voicemail Messages**:
   - Same logic: use last detected language, default to English
   - For reminder voicemails (detailed mode): include the actual reminder message, translated

3. **New Lines (No History)**:
   - All calls start in English until first conversation establishes language

---

## Implementation Clarifications

### Q1: Regular check-in calls starting language
**Answer**: ALL calls (check-ins AND reminders) should use the last detected language. This provides a consistent, personalized experience where grandma always hears her preferred language from the first greeting.

### Q2: Last-detected language lookup query
**Answer**: Use this query logic:
```typescript
const { data } = await supabase
  .from('ultaura_call_sessions')
  .select('language_detected')
  .eq('line_id', lineId)
  .eq('status', 'completed')           // Only completed calls
  .not('language_detected', 'is', null)
  .order('ended_at', { ascending: false })  // Use ended_at (more accurate)
  .limit(1)
  .single();
```
- **Filter**: `status = 'completed'` only (excludes failed, canceled, in-progress)
- **Order by**: `ended_at DESC` (more accurate than `created_at`)
- **Include all call types**: Yes, both regular check-ins and reminder calls count. Inbound calls also count if we support them.

### Q3: language_detected population
**Answer**: YES, implement detection. The column exists but is never populated. Implementation approach:

1. **Add a Grok tool** called `report_language` that Grok calls at end of conversation
2. **Or use session metadata**: When Grok session ends, extract detected language from session state
3. **Store in updateCallStatus**: The infrastructure exists - `updateCallStatus()` already accepts `languageDetected` parameter, just no caller passes it

Recommended implementation in `grok-bridge.ts`:
```typescript
// When call ends, report detected language
private async handleSessionEnd(): Promise<void> {
  // Grok should report which language was primarily spoken
  // This could come from:
  // 1. A final tool call from Grok
  // 2. Analysis of the conversation transcript
  // 3. Grok's session.ended event metadata

  await updateCallStatus(this.callSessionId, 'completed', {
    languageDetected: this.detectedLanguage ?? 'en',
  });
}
```

**Alternatively**: Add a Grok tool that Grok calls proactively:
```typescript
{
  name: 'report_conversation_language',
  description: 'Report the primary language spoken in this conversation. Call this near the end of the call.',
  parameters: {
    language_code: { type: 'string', description: 'ISO 639-1 code (e.g., en, es, fr, de, zh, ja)' }
  }
}
```

### Q4: Voicemail for reminder calls
**Answer**: Keep current behavior - detailed voicemails SHOULD include the actual `reminder_message`. This is more helpful for seniors. The voicemail generator should be:
```typescript
function getVoicemailMessage(
  name: string,
  language: string,
  behavior: 'brief' | 'detailed',
  isReminderCall: boolean,
  reminderMessage?: string
): string {
  if (behavior === 'detailed' && isReminderCall && reminderMessage) {
    // Include the reminder in the appropriate language
    return getLocalizedReminderVoicemail(name, language, reminderMessage);
  }
  // ... regular voicemail logic
}
```

### Q5: Twilio TTS language and voice mapping
**Answer**: YES, set the `language` attribute on `<Say>`. Use Amazon Polly voices for quality. Mapping:

```typescript
const TWILIO_VOICE_MAP: Record<string, { voice: string; language: string }> = {
  en: { voice: 'Polly.Joanna', language: 'en-US' },
  es: { voice: 'Polly.Lupe', language: 'es-US' },
  fr: { voice: 'Polly.Lea', language: 'fr-FR' },
  de: { voice: 'Polly.Vicki', language: 'de-DE' },
  it: { voice: 'Polly.Bianca', language: 'it-IT' },
  pt: { voice: 'Polly.Camila', language: 'pt-BR' },
  ja: { voice: 'Polly.Mizuki', language: 'ja-JP' },
  ko: { voice: 'Polly.Seoyeon', language: 'ko-KR' },
  zh: { voice: 'Polly.Zhiyu', language: 'cmn-CN' },
  // Fallback for unsupported languages
  default: { voice: 'Polly.Joanna', language: 'en-US' },
};

function generateMessageTwiML(message: string, languageCode: string): string {
  const { voice, language } = TWILIO_VOICE_MAP[languageCode] ?? TWILIO_VOICE_MAP.default;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${language}">${escapeXml(message)}</Say>
  <Hangup />
</Response>`;
}
```

**Languages to support now**: en, es, fr, de, it, pt, ja, ko, zh (covers ~95% of use cases). Add more as needed.

### Q6: Language display/name mapping - shared helper
**Answer**: Create a **shared helper** in `packages/prompts/src/utils/language.ts`:

```typescript
// packages/prompts/src/utils/language.ts
export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  ru: 'Russian',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  hi: 'Hindi',
  tr: 'Turkish',
  pl: 'Polish',
  sv: 'Swedish',
  da: 'Danish',
  no: 'Norwegian',
  fi: 'Finnish',
  cs: 'Czech',
  th: 'Thai',
  vi: 'Vietnamese',
  id: 'Indonesian',
  ms: 'Malay',
  tl: 'Filipino',
  uk: 'Ukrainian',
  el: 'Greek',
  he: 'Hebrew',
  ro: 'Romanian',
  hu: 'Hungarian',
};

export function getLanguageName(code: string): string {
  // Normalize: strip region (pt-BR -> pt)
  const baseCode = code.split('-')[0].toLowerCase();
  return LANGUAGE_NAMES[baseCode] ?? code.toUpperCase();
}

export function normalizeLanguageCode(code: string): string {
  // pt-BR -> pt, en-US -> en, zh-CN -> zh
  return code.split('-')[0].toLowerCase();
}
```

**Region code normalization**: YES, normalize `pt-BR` to `pt` before display and storage. Store only base ISO 639-1 codes.

### Q7: getLastDetectedLanguage Supabase client
**Answer**: Use the correct client for each context:

**In `src/lib/ultaura/actions.ts` (dashboard)**:
```typescript
import getSupabaseServerActionClient from '~/core/supabase/action-client';

export async function getLastDetectedLanguage(lineId: string): Promise<string> {
  const client = getSupabaseServerActionClient({ admin: true });
  // ... query
}
```

**In `telephony/src/` (Express backend)**:
```typescript
import { getSupabaseClient } from '../utils/supabase.js';

async function getLastDetectedLanguageForLine(lineId: string): Promise<string> {
  const supabase = getSupabaseClient();  // Already uses service role
  // ... query
}
```

**Note**: The dashboard action may not be needed if we only look up language in the telephony layer. Keep it simple - implement only in telephony unless dashboard needs it.

### Q8: Migration filename
**Answer**: Use the newer convention: `20260210000001_remove_language_columns.sql`

Pattern: `YYYYMMDD` + `000001` (6-digit sequence) + `_description.sql`

### Q9: Marketing copy placement
**Answer**: The copy already exists on the demo page. For the dashboard:
- **Skip adding to dashboard** for now - it's already on marketing pages
- If desired later, add to the **Lines list page header** as subtle text: "Ultaura speaks 100+ languages automatically"

### Q10: Call history UI - show "Unknown" or hide?
**Answer**: **Hide when null** (only show when `language_detected` is non-null). Cleaner UI, avoids confusion.

```tsx
{session.language_detected && (
  <span className="text-sm text-muted-foreground">
    {getLanguageName(session.language_detected)}
  </span>
)}
```

### Q11: Supabase generated types
**Answer**: After running the migration, regenerate types:
```bash
npm run typegen
```

This runs `supabase gen types typescript --local > src/database.types.ts`.

**Both files need updating**:
1. `src/database.types.ts` - auto-generated
2. `src/lib/database.types.ts` - manually copy or keep in sync

The `preferred_language` and `spanish_formality` columns will be automatically removed from the generated types.

---

## Technical Requirements

### 1. Database Migration

Create new migration: `YYYYMMDD000001_remove_language_columns.sql`

```sql
-- Step 1: Drop CHECK constraints
ALTER TABLE ultaura_lines
  DROP CONSTRAINT IF EXISTS ultaura_lines_preferred_language_check,
  DROP CONSTRAINT IF EXISTS ultaura_lines_spanish_formality_check;

-- Step 2: Remove columns
ALTER TABLE ultaura_lines
  DROP COLUMN IF EXISTS preferred_language,
  DROP COLUMN IF EXISTS spanish_formality;
```

**Note**: No data migration needed since we're removing the columns entirely.

### 2. TypeScript Types

**Remove from `packages/types/src/language.ts`:**
```typescript
// DELETE ENTIRE FILE or remove these exports:
export type PreferredLanguage = 'auto' | 'en' | 'es';
export type SpanishFormality = 'usted' | 'tu';
```

**Update `packages/types/src/index.ts`:**
- Remove exports of `PreferredLanguage` and `SpanishFormality`

**Update `src/lib/ultaura/types.ts`:**

Remove from `Line` interface:
```typescript
// DELETE these lines:
preferredLanguage: PreferredLanguage;
spanishFormality: SpanishFormality;
```

Remove from `CreateLineInput` interface:
```typescript
// DELETE these lines:
preferredLanguage?: PreferredLanguage;
spanishFormality?: SpanishFormality;
```

Remove from `UpdateLineInput` interface:
```typescript
// DELETE these lines:
preferredLanguage?: PreferredLanguage;
spanishFormality?: SpanishFormality;
```

Remove from `LineRow` interface:
```typescript
// DELETE these lines:
preferred_language: PreferredLanguage;
spanish_formality: SpanishFormality;
```

### 3. Constants Updates

**Update `src/lib/ultaura/constants.ts`:**

Remove entirely:
```typescript
// DELETE these constants:
export const LANGUAGES = { ... };
export const LANGUAGE_LABELS = { ... };
export const SPANISH_FORMALITY_LABELS = { ... };
```

### 4. Server Actions Updates

**Update `src/lib/ultaura/actions.ts`:**

**createLine function** (around line 276):
```typescript
// REMOVE these lines from the insert object:
preferred_language: input.preferredLanguage || 'auto',
spanish_formality: input.spanishFormality || 'usted',
```

**updateLine function** (around line 348):
```typescript
// REMOVE these lines:
if (input.preferredLanguage !== undefined) updates.preferred_language = input.preferredLanguage;
if (input.spanishFormality !== undefined) updates.spanish_formality = input.spanishFormality;
```

**Add new helper function** to get last detected language (if needed in dashboard):
```typescript
/**
 * Get the last detected language for a line from its most recent completed call.
 * Falls back to 'en' if no previous calls exist.
 */
export async function getLastDetectedLanguage(lineId: string): Promise<string> {
  const client = getSupabaseServerActionClient({ admin: true });

  const { data } = await client
    .from('ultaura_call_sessions')
    .select('language_detected')
    .eq('line_id', lineId)
    .eq('status', 'completed')
    .not('language_detected', 'is', null)
    .order('ended_at', { ascending: false })
    .limit(1)
    .single();

  return data?.language_detected ?? 'en';
}
```

### 5. UI Component Updates

**Update `src/app/dashboard/(app)/lines/components/AddLineModal.tsx`:**

Remove the entire language selection block (lines 211-227):
```tsx
// DELETE this entire block:
{/* Language */}
<div className="space-y-2">
  <label className="block text-sm font-medium text-foreground">
    <Globe className="inline w-4 h-4 mr-1" />
    Language Preference
  </label>
  <Select value={language} onValueChange={...}>
    ...
  </Select>
</div>
```

Remove state and imports:
```typescript
// DELETE:
const [language, setLanguage] = useState<'auto' | 'en' | 'es'>('auto');

// REMOVE from createLine call:
preferredLanguage: language,
```

**Update `src/app/dashboard/(app)/lines/[lineId]/settings/SettingsClient.tsx`:**

Remove language selection section (lines 139-186):
```tsx
// DELETE the entire {/* Language */} block
// DELETE the entire {/* Spanish Formality */} block
```

Remove state:
```typescript
// DELETE:
const [language, setLanguage] = useState(line.preferred_language);
const [spanishFormality, setSpanishFormality] = useState(line.spanish_formality);
```

Remove from save payload:
```typescript
// REMOVE from updateLine call:
preferredLanguage: language,
spanishFormality,
```

**Update `src/app/dashboard/(app)/lines/[lineId]/LineDetailClient.tsx`:**

Remove language display (lines 298-300):
```tsx
// DELETE:
<div>
  <dt className="text-sm text-muted-foreground">Language</dt>
  <dd className="text-foreground capitalize">{line.preferred_language}</dd>
</div>
```

### 6. Prompt System Updates

**Update `packages/prompts/src/profiles/index.ts`:**

Replace `formatLanguageSection` function:
```typescript
/**
 * Format language section for Grok prompts.
 * With pure auto-detect, we provide minimal guidance and let Grok's
 * native 100+ language support handle detection and switching.
 */
function formatLanguageSection(
  startingLanguage: string = 'en',
  isRealtime: boolean
): string {
  if (startingLanguage === 'en') {
    return isRealtime
      ? '## Language\nStart in English. Respond in whatever language the user speaks. Switch naturally mid-conversation if they change languages.'
      : '## Language\nStart in English. If the user speaks another language, switch to match them naturally.';
  }

  // For non-English starting language (e.g., from last detected language)
  const languageName = getLanguageName(startingLanguage);
  return isRealtime
    ? `## Language\nStart in ${languageName}. Respond in whatever language the user speaks. Switch naturally mid-conversation if they change languages.`
    : `## Language\nStart in ${languageName}. If the user speaks another language, switch to match them naturally.`;
}

/**
 * Convert ISO language code to human-readable name.
 * Covers common languages; falls back to the code itself for rare languages.
 */
function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    nl: 'Dutch',
    ru: 'Russian',
    zh: 'Chinese',
    ja: 'Japanese',
    ko: 'Korean',
    ar: 'Arabic',
    hi: 'Hindi',
    tr: 'Turkish',
    pl: 'Polish',
    sv: 'Swedish',
    da: 'Danish',
    no: 'Norwegian',
    fi: 'Finnish',
    cs: 'Czech',
    // Add more as needed
  };
  return names[code] ?? code;
}
```

Update `CompanionPromptParams` interface:
```typescript
export interface CompanionPromptParams {
  userName: string;
  startingLanguage?: string;  // CHANGED: was 'language: PreferredLanguage'
  // REMOVED: spanishFormality?: SpanishFormality;
  memories: Memory[];
  isFirstCall: boolean;
  timezone?: string;
  // ... rest unchanged
}
```

Update `compilePrompt` to use new signature:
```typescript
// In the sections.push call:
sections.push(formatLanguageSection(params.startingLanguage ?? 'en', isRealtime));
```

**Update `packages/prompts/src/builders/reminder.ts`:**

```typescript
export interface ReminderPromptParams {
  userName: string;
  reminderMessage: string;
  startingLanguage?: string;  // CHANGED: was 'language: PreferredLanguage'
}

export function buildReminderPrompt(params: ReminderPromptParams): string {
  const { userName, reminderMessage, startingLanguage = 'en' } = params;
  const languageName = getLanguageName(startingLanguage);

  return `You are Ultaura calling with a quick reminder for ${userName}.

## Your Task
Deliver this reminder: "${reminderMessage}"

## Style
- Keep it brief and friendly (aim for under 30 seconds)
- Greet them warmly by name
- Deliver the reminder clearly
- Ask if they have any quick questions about the reminder
- Say goodbye warmly

## Language
Start in ${languageName}. If they speak another language, switch naturally.`;
}
```

### 7. Telephony Updates

**Update `telephony/src/websocket/grok-bridge.ts`:**

Update `GrokBridgeOptions` interface:
```typescript
interface GrokBridgeOptions {
  callSessionId: string;
  lineId: string;
  accountId: string;
  userName: string;
  timezone: string;
  startingLanguage?: string;  // CHANGED: was 'language: PreferredLanguage'
  // REMOVED: spanishFormality?: SpanishFormality;
  isFirstCall: boolean;
  memories: Memory[];
  // ... rest unchanged
}
```

Update `buildSystemPrompt` method to pass `startingLanguage` instead of `language` and `spanishFormality`.

**Update `telephony/src/websocket/media-stream.ts`:**

Where GrokBridge is instantiated, fetch starting language:
```typescript
// Get last detected language for this line
const startingLanguage = await getLastDetectedLanguageForLine(line.id);

grokBridge = new GrokBridge({
  callSessionId,
  lineId: line.id,
  accountId: account.id,
  userName: line.display_name,
  timezone: line.timezone,
  startingLanguage,  // CHANGED: was 'language: line.preferred_language'
  // REMOVED: spanishFormality
  isFirstCall,
  memories,
  // ... rest unchanged
});
```

Add helper function in telephony (`telephony/src/services/language.ts`):
```typescript
import { getSupabaseClient } from '../utils/supabase.js';

/**
 * Get last detected language for a line from most recent completed call.
 * Falls back to 'en' if no history.
 */
export async function getLastDetectedLanguageForLine(lineId: string): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('ultaura_call_sessions')
      .select('language_detected')
      .eq('line_id', lineId)
      .eq('status', 'completed')
      .not('language_detected', 'is', null)
      .order('ended_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Failed to get last detected language:', error);
      return 'en';
    }

    return data?.language_detected ?? 'en';
  } catch (err) {
    console.error('Exception getting last detected language:', err);
    return 'en';
  }
}
```

### 8. Language Detection Implementation (NEW)

The `language_detected` column exists but is never populated. Implement detection:

**Option A (Recommended): Add Grok Tool**

Add a tool that Grok calls when detecting the conversation language:

```typescript
// In telephony/src/websocket/grok-tools.ts (or equivalent)
{
  type: 'function',
  function: {
    name: 'report_conversation_language',
    description: 'Report the primary language being spoken in this conversation. Call this once you have detected the language the user is speaking.',
    parameters: {
      type: 'object',
      properties: {
        language_code: {
          type: 'string',
          description: 'ISO 639-1 language code (e.g., en, es, fr, de, zh, ja, ko, pt, it, ru, ar, hi)'
        }
      },
      required: ['language_code']
    }
  }
}
```

**Tool Handler** (`telephony/src/routes/tools/report-language.ts`):
```typescript
import { normalizeLanguageCode } from '@ultaura/prompts/utils/language';

export async function handleReportLanguage(
  params: { language_code: string },
  context: ToolContext
): Promise<ToolResult> {
  const normalizedCode = normalizeLanguageCode(params.language_code);

  // Store in GrokBridge instance for later use
  context.grokBridge.setDetectedLanguage(normalizedCode);

  return {
    success: true,
    message: `Language detected: ${normalizedCode}`
  };
}
```

**Update GrokBridge** to store and report detected language:
```typescript
// In grok-bridge.ts
private detectedLanguage: string | null = null;

public setDetectedLanguage(code: string): void {
  this.detectedLanguage = code;
}

// When call ends (in handleDisconnect or similar):
private async reportCallEnd(): Promise<void> {
  await updateCallStatus(this.options.callSessionId, 'completed', {
    languageDetected: this.detectedLanguage,
    // ... other options
  });
}
```

**Update System Prompt** to instruct Grok to report language:

Add to the language section of prompts:
```
When you detect what language the user is speaking, call the report_conversation_language tool with the appropriate ISO 639-1 code.
```

### 9. Voicemail Updates

**Update `telephony/src/routes/twilio-outbound.ts`** (or wherever voicemail TwiML is generated):

Before generating voicemail message, look up last detected language:
```typescript
const startingLanguage = await getLastDetectedLanguageForLine(lineId);
const voicemailMessage = getVoicemailMessage(displayName, startingLanguage, behavior);
```

Create voicemail message generator:
```typescript
function getVoicemailMessage(
  name: string,
  language: string,
  behavior: 'brief' | 'detailed'
): string {
  // Language-specific voicemail messages
  const messages: Record<string, { brief: string; detailed: string }> = {
    en: {
      brief: `Hi ${name}, this is Ultaura. I'll call back soon. Take care!`,
      detailed: `Hi ${name}, this is Ultaura calling for your check-in. I'll try again later. Take care!`,
    },
    es: {
      brief: `Hola ${name}, soy Ultaura. Te llamaré pronto. ¡Cuídate!`,
      detailed: `Hola ${name}, soy Ultaura llamando para tu llamada de bienestar. Volveré a intentarlo más tarde. ¡Cuídate!`,
    },
    fr: {
      brief: `Bonjour ${name}, c'est Ultaura. Je rappellerai bientôt. Prenez soin de vous!`,
      detailed: `Bonjour ${name}, c'est Ultaura pour votre appel de bien-être. Je réessaierai plus tard. Prenez soin de vous!`,
    },
    // Add more languages as needed...
  };

  const langMessages = messages[language] ?? messages['en'];
  return behavior === 'brief' ? langMessages.brief : langMessages.detailed;
}
```

### 9. Call History UI Update

**Update call history display** to show detected language:

In the call history component (likely in `src/app/dashboard/(app)/calls/` or call session display):

```tsx
{session.language_detected && (
  <div className="text-sm text-muted-foreground">
    <Globe className="inline w-3 h-3 mr-1" />
    {getLanguageDisplayName(session.language_detected)}
  </div>
)}
```

Add helper:
```typescript
function getLanguageDisplayName(code: string): string {
  const names: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    zh: 'Chinese',
    ja: 'Japanese',
    ko: 'Korean',
    ar: 'Arabic',
    hi: 'Hindi',
    // ... more as needed
  };
  return names[code] ?? code.toUpperCase();
}
```

### 10. Marketing Copy Addition

Add a brief mention of multilingual support in an appropriate location:

**Option A**: In the lines list or dashboard header:
```tsx
<p className="text-sm text-muted-foreground">
  Ultaura speaks 100+ languages automatically
</p>
```

**Option B**: In the AddLineModal success state or line creation confirmation.

**Option C**: On the main marketing/landing page (outside dashboard).

---

## Files to Modify Summary

| File | Action |
|------|--------|
| `supabase/migrations/20260210000001_remove_language_columns.sql` | CREATE (new migration) |
| `packages/types/src/language.ts` | DELETE or gut |
| `packages/types/src/index.ts` | Remove language exports |
| `packages/prompts/src/utils/language.ts` | CREATE (shared language helpers) |
| `src/lib/ultaura/types.ts` | Remove language fields from interfaces |
| `src/lib/ultaura/constants.ts` | Remove LANGUAGES, LANGUAGE_LABELS, SPANISH_FORMALITY_LABELS |
| `src/lib/ultaura/actions.ts` | Remove language from create/update |
| `src/app/dashboard/(app)/lines/components/AddLineModal.tsx` | Remove language UI |
| `src/app/dashboard/(app)/lines/[lineId]/settings/SettingsClient.tsx` | Remove language settings UI |
| `src/app/dashboard/(app)/lines/[lineId]/LineDetailClient.tsx` | Remove language display |
| `packages/prompts/src/profiles/index.ts` | Update formatLanguageSection, CompanionPromptParams |
| `packages/prompts/src/builders/reminder.ts` | Update for startingLanguage |
| `telephony/src/services/language.ts` | CREATE (getLastDetectedLanguageForLine helper) |
| `telephony/src/routes/tools/report-language.ts` | CREATE (language detection tool handler) |
| `telephony/src/websocket/grok-bridge.ts` | Update options, add language detection reporting |
| `telephony/src/websocket/media-stream.ts` | Fetch startingLanguage, update GrokBridge instantiation |
| `telephony/src/routes/twilio-outbound.ts` | Add language-aware voicemail messages with TTS mapping |
| `telephony/src/utils/twilio.ts` | Update generateMessageTwiML for language/voice |
| `telephony/src/services/call-session.ts` | Ensure languageDetected is passed to updateCallStatus |
| Call history UI component | Add language_detected display (hide when null) |
| `src/database.types.ts` | Regenerate via `npm run typegen` |
| `src/lib/database.types.ts` | Copy regenerated types |

---

## Edge Cases and Error Handling

### Edge Case 1: Grok Returns Null/Empty Language Detection
- **Scenario**: Grok doesn't detect a language for a call
- **Handling**: Keep `language_detected` as NULL in database; next call will use English as fallback

### Edge Case 2: Very Short Calls
- **Scenario**: Call ends before meaningful language detection
- **Handling**: `language_detected` may be NULL or inaccurate; fallback to English is acceptable

### Edge Case 3: Multiple Languages in One Call
- **Scenario**: Senior switches between English and Spanish during call
- **Handling**: Grok handles this natively; `language_detected` stores the primary/final language detected

### Edge Case 4: Unsupported Language
- **Scenario**: Senior speaks a language Grok doesn't fully support
- **Handling**: Grok will do its best; voicemail falls back to English if language code not in our messages dictionary

### Edge Case 5: Database Query Failure
- **Scenario**: `getLastDetectedLanguage` query fails
- **Handling**: Catch error, log it, return 'en' as safe default (see implementation in Q7 and telephony helper above)

---

## Testing Considerations

### Unit Tests

1. **getLastDetectedLanguage function**
   - Returns correct language when call history exists
   - Returns 'en' when no call history
   - Returns 'en' on database error
   - Handles NULL language_detected values

2. **formatLanguageSection function**
   - Generates correct prompt for 'en'
   - Generates correct prompt for other languages
   - Handles unknown language codes gracefully

3. **getVoicemailMessage function**
   - Returns correct message for known languages
   - Falls back to English for unknown languages
   - Handles brief vs detailed modes

### Integration Tests

1. **Line Creation**
   - Verify line can be created without language fields
   - Confirm no database constraint violations

2. **Line Update**
   - Verify line can be updated without language fields

3. **Telephony Flow**
   - Mock call to verify startingLanguage is correctly fetched and passed
   - Verify GrokBridge receives correct prompt

### Manual/E2E Tests

1. **New Line Flow**
   - Create new line, initiate test call
   - Verify greeting is in English
   - Speak in another language, verify Grok switches

2. **Returning Caller Flow**
   - Complete a call speaking Spanish
   - Check call history shows "Spanish" as detected language
   - Initiate reminder call, verify it starts in Spanish

3. **Voicemail Flow**
   - Configure line with voicemail behavior
   - Complete a call in French
   - Trigger call that goes to voicemail
   - Verify voicemail message is in French (or English if French not in dictionary)

4. **UI Verification**
   - Confirm language selection is removed from AddLineModal
   - Confirm language settings are removed from line settings page
   - Confirm detected language appears in call history

---

## Dependencies

### External Dependencies
- Grok Voice Agent API (already integrated)
- Twilio Voice API (already integrated)

### Internal Dependencies
- Database migration must run before code deployment
- TypeScript compilation will fail until type changes are made
- UI components depend on type definitions

### Deployment Order
1. Create and test migration locally
2. Deploy migration to staging
3. Deploy code changes to staging
4. Test full flow on staging
5. Deploy migration to production
6. Deploy code changes to production

---

## Assumptions

1. ~~Grok Voice Agent reliably populates `language_detected` field for completed calls~~ **CORRECTED**: We need to implement detection - the column exists but is never populated. Implementation via Grok tool or session analysis required.
2. The `language_detected` column should store ISO 639-1 language codes (e.g., 'en', 'es', 'fr') - normalize any region codes (pt-BR → pt)
3. There are no external integrations or reports that depend on `preferred_language` or `spanish_formality` columns
4. The voicemail TTS system (Twilio) can pronounce multiple languages correctly using the `<Say>` TwiML verb with appropriate `language` and `voice` attributes (Amazon Polly voices)
5. Marketing copy about "100+ languages" is accurate per Grok Voice Agent capabilities

---

## Rollback Plan

If issues are discovered post-deployment:

1. **Database**: Migration only drops columns, which is non-reversible. If rollback needed:
   - Create new migration to re-add columns with same schema
   - Backfill with 'auto' as default

2. **Code**: Standard git revert of deployed commits

3. **Hybrid Rollback**: If only partial issues:
   - Re-add columns as nullable (no CHECK constraint)
   - UI remains without language selection
   - Backend ignores the columns

---

## Success Metrics

1. **No language-related database constraints** blocking new language support
2. **UI simplified** - no language selection required from users
3. **Call history displays** detected language for each call
4. **Voicemails and reminders** use last detected language
5. **System prompts** provide minimal, universal language guidance
6. **No regressions** in existing call quality or functionality
