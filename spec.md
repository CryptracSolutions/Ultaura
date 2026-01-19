# Specification: Improved Multilingual First-Call UX for Ultaura

## 1. Objective and Scope

### Problem Statement
Ultaura's current language handling has a critical weakness: the first-call experience always defaults to English because language is only detected reactively during calls via an LLM tool call (`report_conversation_language`). This causes high churn for non-English speaking seniors who may be confused or disconnected before they understand they can speak their native language.

### Goals
1. Allow family members to pre-set a language preference during line creation or in settings
2. Implement bilingual greeting for first calls when language is unknown (auto-detect mode)
3. Automatically lock in detected language after first successful detection
4. Support language changes during calls with persistence to future calls
5. Use appropriate language for voicemail messages

### Supported Languages
- Auto-detect (default - represented as NULL)
- English (en)
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)
- Portuguese (pt)
- Japanese (ja)
- Korean (ko)
- Chinese (zh)

### Out of Scope
- Regional variants (es-MX vs es-ES) - will store BCP-47 but normalize to ISO 639-1 for behavior
- Adding new voicemail message translations beyond existing languages
- SMS language preferences

---

## 2. Technical Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LINE CREATION                                   │
│                                                                             │
│  Dashboard: AddLineModal.tsx                                                │
│       │                                                                     │
│       ▼                                                                     │
│  Server Action: createLine() in lines.ts                                    │
│       │                                                                     │
│       ▼                                                                     │
│  Database: ultaura_lines.preferred_language_bcp47 / preferred_language_iso  │
│                    (NULL = auto-detect mode)                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              CALL INITIATION                                 │
│                                                                             │
│  media-stream.ts: handleMediaStreamConnection()                             │
│       │                                                                     │
│       ▼                                                                     │
│  language.ts: getStartingLanguageForLine()                                  │
│       │                                                                     │
│       ├── IF preferred_language_iso IS NOT NULL:                            │
│       │       Return { language: iso, isAutoDetect: false }                 │
│       │                                                                     │
│       └── ELSE (auto-detect mode):                                          │
│               Return { language: 'en', isAutoDetect: true }                 │
│       │                                                                     │
│       ▼                                                                     │
│  grok-bridge.ts: Pass startingLanguage and isAutoDetect to compilePrompt()  │
│       │                                                                     │
│       ▼                                                                     │
│  profiles/index.ts: formatLanguageSection()                                 │
│       │                                                                     │
│       ├── IF isAutoDetect AND isFirstCall:                                  │
│       │       Use bilingual greeting instructions                           │
│       │                                                                     │
│       └── ELSE:                                                             │
│               Start in specified language                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           LANGUAGE DETECTION                                 │
│                                                                             │
│  Grok AI: Detects language from senior's first response                     │
│       │                                                                     │
│       ▼                                                                     │
│  Tool Call: report_conversation_language({ language_code: 'es' })           │
│       │                                                                     │
│       ▼                                                                     │
│  report-conversation-language.ts: Handle tool call                          │
│       │                                                                     │
│       ├── Update call_session.language_detected                             │
│       │                                                                     │
│       └── IF line.preferred_language_iso IS NULL (auto-detect mode):        │
│               Persist language to ultaura_lines table                       │
│               (locks language for future calls)                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Role |
|-----------|------|
| `ultaura_lines` table | Stores `preferred_language_bcp47` and `preferred_language_iso` |
| `language.ts` service | Determines starting language for calls |
| `media-stream.ts` | Passes language context to Grok bridge |
| `grok-bridge.ts` | Configures prompt with language instructions |
| `formatLanguageSection()` | Generates language instructions in prompt |
| `report-conversation-language.ts` | Handles language detection and persistence |
| `voicemail-messages.ts` | Selects voicemail language |
| Dashboard UI | Language selection in line creation/settings |

---

## 3. Database Changes

### Migration: Add Language Columns to ultaura_lines

**File**: `supabase/migrations/20260320000001_add_language_preference.sql`

```sql
-- Add language preference columns to ultaura_lines
-- preferred_language_bcp47: Full BCP-47 tag (e.g., 'es-MX', 'zh-Hans')
-- preferred_language_iso: Normalized ISO 639-1 code (e.g., 'es', 'zh')
-- When BOTH are NULL = auto-detect mode (bilingual greeting on first call)

ALTER TABLE ultaura_lines
  ADD COLUMN IF NOT EXISTS preferred_language_bcp47 TEXT,
  ADD COLUMN IF NOT EXISTS preferred_language_iso TEXT;

-- Add constraint to ensure ISO code is valid if provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ultaura_lines_preferred_language_iso_check'
  ) THEN
    ALTER TABLE ultaura_lines
      ADD CONSTRAINT ultaura_lines_preferred_language_iso_check
      CHECK (
        preferred_language_iso IS NULL
        OR preferred_language_iso IN ('en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh')
      );
  END IF;
END $$;

-- Add index for querying by language (useful for analytics)
CREATE INDEX IF NOT EXISTS idx_ultaura_lines_preferred_language_iso
  ON ultaura_lines(preferred_language_iso)
  WHERE preferred_language_iso IS NOT NULL;

-- Comment on columns
COMMENT ON COLUMN ultaura_lines.preferred_language_bcp47 IS 'Full BCP-47 language tag (e.g., es-MX). NULL means auto-detect mode.';
COMMENT ON COLUMN ultaura_lines.preferred_language_iso IS 'ISO 639-1 language code (e.g., es). NULL means auto-detect mode. Derived from BCP-47 tag.';
```

### Rollback Migration

**File**: `supabase/migrations/20260320000001_add_language_preference_rollback.sql` (keep separate for documentation)

```sql
-- Rollback: Remove language preference columns
ALTER TABLE ultaura_lines
  DROP CONSTRAINT IF EXISTS ultaura_lines_preferred_language_iso_check;

DROP INDEX IF EXISTS idx_ultaura_lines_preferred_language_iso;

ALTER TABLE ultaura_lines
  DROP COLUMN IF EXISTS preferred_language_bcp47,
  DROP COLUMN IF EXISTS preferred_language_iso;
```

---

## 4. API Changes

### 4.1 Zod Schema Updates

**File**: `packages/schemas/src/line.ts`

Add to `CreateLineInputSchema`:
```typescript
preferredLanguageIso: z.enum(['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh']).nullable().optional(),
```

Add to `UpdateLineInputSchema`:
```typescript
preferredLanguageIso: z.enum(['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh']).nullable().optional(),
```

### 4.2 TypeScript Type Updates

**File**: `src/lib/ultaura/types.ts`

Add to `Line` interface:
```typescript
preferredLanguageBcp47: string | null;
preferredLanguageIso: string | null;
```

Add to `CreateLineInput` interface:
```typescript
preferredLanguageIso?: string | null;
```

Add to `UpdateLineInput` interface:
```typescript
preferredLanguageIso?: string | null;
```

Add new type:
```typescript
export type SupportedLanguageIso = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh';
```

### 4.3 Server Action Updates

**File**: `src/lib/ultaura/lines.ts`

Update `createLine()` to handle new field:
```typescript
// In createLineWithTrial function, after parsing input:
const {
  // ... existing fields
  preferredLanguageIso,
} = parsed.data;

// In the insert object:
preferred_language_iso: preferredLanguageIso ?? null,
preferred_language_bcp47: preferredLanguageIso ?? null, // For now, BCP-47 = ISO
```

Update `updateLine()` to handle new field:
```typescript
// In the updates mapping:
if (parsed.data.preferredLanguageIso !== undefined) {
  updates.preferred_language_iso = parsed.data.preferredLanguageIso;
  updates.preferred_language_bcp47 = parsed.data.preferredLanguageIso;
}
```

### 4.4 Constants Update

**File**: `src/lib/ultaura/constants.ts`

Add language options:
```typescript
// ============================================
// LANGUAGE OPTIONS
// ============================================

export const LANGUAGE_OPTIONS = [
  { value: null, label: 'Auto-detect', description: 'Detects language from first conversation' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish (Español)' },
  { value: 'fr', label: 'French (Français)' },
  { value: 'de', label: 'German (Deutsch)' },
  { value: 'it', label: 'Italian (Italiano)' },
  { value: 'pt', label: 'Portuguese (Português)' },
  { value: 'ja', label: 'Japanese (日本語)' },
  { value: 'ko', label: 'Korean (한국어)' },
  { value: 'zh', label: 'Chinese (中文)' },
] as const;

export type LanguageOption = typeof LANGUAGE_OPTIONS[number];
```

---

## 5. Telephony Changes

### 5.1 Language Service Update

**File**: `telephony/src/services/language.ts`

Replace existing function with:
```typescript
import { normalizeLanguageCode } from '@ultaura/prompts';
import { logger } from '../server.js';
import { getSupabaseClient } from '../utils/supabase.js';

export interface StartingLanguageResult {
  language: string;
  isAutoDetect: boolean;
}

export async function getStartingLanguageForLine(lineId: string): Promise<StartingLanguageResult> {
  try {
    const supabase = getSupabaseClient();

    // First check line's preferred language
    const { data: line, error: lineError } = await supabase
      .from('ultaura_lines')
      .select('preferred_language_iso')
      .eq('id', lineId)
      .single();

    if (lineError) {
      logger.error({ error: lineError, lineId }, 'Failed to get line language preference');
      return { language: 'en', isAutoDetect: true };
    }

    // If preferred language is set, use it (language is "locked")
    if (line?.preferred_language_iso) {
      return {
        language: normalizeLanguageCode(line.preferred_language_iso),
        isAutoDetect: false
      };
    }

    // Auto-detect mode: Return English as default but flag as auto-detect
    return { language: 'en', isAutoDetect: true };
  } catch (error) {
    logger.error({ error, lineId }, 'Exception getting starting language for line');
    return { language: 'en', isAutoDetect: true };
  }
}

export async function persistLanguageToLine(
  lineId: string,
  languageCode: string
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const normalizedCode = normalizeLanguageCode(languageCode);

    const { error } = await supabase
      .from('ultaura_lines')
      .update({
        preferred_language_iso: normalizedCode,
        preferred_language_bcp47: languageCode, // Store original BCP-47 tag
      })
      .eq('id', lineId);

    if (error) {
      logger.error({ error, lineId, languageCode }, 'Failed to persist language to line');
      return false;
    }

    logger.info({ lineId, languageCode: normalizedCode }, 'Language persisted to line');
    return true;
  } catch (error) {
    logger.error({ error, lineId, languageCode }, 'Exception persisting language to line');
    return false;
  }
}

// Keep for backward compatibility, but prefer getStartingLanguageForLine
export async function getLastDetectedLanguageForLine(lineId: string): Promise<string> {
  const result = await getStartingLanguageForLine(lineId);
  return result.language;
}
```

### 5.2 Report Conversation Language Tool Update

**File**: `telephony/src/routes/tools/report-conversation-language.ts`

Update to persist language for auto-detect lines:
```typescript
import { Router, Request, Response } from 'express';
import { normalizeLanguageCode } from '@ultaura/prompts';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { getGrokBridge } from '../../websocket/grok-bridge-registry.js';
import { persistLanguageToLine } from '../../services/language.js';
import { getSupabaseClient } from '../../utils/supabase.js';

export const reportConversationLanguageRouter = Router();

reportConversationLanguageRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, languageCode, language_code } = req.body as {
      callSessionId?: string;
      languageCode?: string;
      language_code?: string;
    };

    if (!callSessionId) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ success: false, error: 'Call session not found' });
      return;
    }

    const rawCode = languageCode || language_code;
    const recordFailure = async (errorCode?: string) => {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'report_conversation_language',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    if (!rawCode) {
      await recordFailure('missing_language_code');
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const normalizedCode = normalizeLanguageCode(rawCode);
    const grokBridge = getGrokBridge(callSessionId);

    if (grokBridge) {
      grokBridge.setDetectedLanguage(normalizedCode);
    } else {
      logger.warn({ callSessionId }, 'Grok bridge not found for language report');
    }

    // Check if line is in auto-detect mode and persist language
    const supabase = getSupabaseClient();
    const { data: line } = await supabase
      .from('ultaura_lines')
      .select('preferred_language_iso')
      .eq('id', session.line_id)
      .single();

    if (line && line.preferred_language_iso === null) {
      // Line is in auto-detect mode - lock in the detected language
      const persisted = await persistLanguageToLine(session.line_id, normalizedCode);
      if (persisted) {
        logger.info(
          { callSessionId, lineId: session.line_id, languageCode: normalizedCode },
          'Auto-detected language persisted to line'
        );
      }
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'report_conversation_language',
      success: true,
      languageCode: normalizedCode,
    }, { skipDebugLog: true });

    res.json({
      success: true,
      languageCode: normalizedCode,
      message: `Language detected: ${normalizedCode}`,
    });
  } catch (error) {
    logger.error({ error }, 'Error reporting conversation language');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
```

### 5.3 Media Stream Update

**File**: `telephony/src/websocket/media-stream.ts`

Update the `handleMediaStreamConnection` function to pass `isAutoDetect` flag:

In the section where `getLastDetectedLanguageForLine` is called (around line 300), change to:
```typescript
// Replace:
// const startingLanguage = await getLastDetectedLanguageForLine(line.id);

// With:
import { getStartingLanguageForLine } from '../services/language.js';

const languageResult = await getStartingLanguageForLine(line.id);
const startingLanguage = languageResult.language;
const isLanguageAutoDetect = languageResult.isAutoDetect;
```

Then pass `isLanguageAutoDetect` to the `GrokBridge` constructor:
```typescript
grokBridge = new GrokBridge({
  // ... existing options
  startingLanguage,
  isLanguageAutoDetect, // New field
  isFirstCall,
  // ...
});
```

### 5.4 Grok Bridge Update

**File**: `telephony/src/websocket/grok-bridge.ts`

Add to `GrokBridgeOptions` interface:
```typescript
isLanguageAutoDetect?: boolean;
```

Pass this to `compilePrompt`:
```typescript
const systemPrompt = compilePrompt('voice_realtime', {
  // ... existing params
  startingLanguage: this.options.startingLanguage,
  isLanguageAutoDetect: this.options.isLanguageAutoDetect,
  isFirstCall: this.options.isFirstCall,
  // ...
});
```

### 5.5 Prompt Compilation Updates

**File**: `packages/prompts/src/profiles/index.ts`

Update `CompanionPromptParams` interface:
```typescript
export interface CompanionPromptParams {
  // ... existing fields
  startingLanguage?: string;
  isLanguageAutoDetect?: boolean;
  // ...
}
```

Update `formatLanguageSection` function:
```typescript
function formatLanguageSection(
  startingLanguage: string,
  compressed: boolean,
  isAutoDetect: boolean = false,
  isFirstCall: boolean = false
): string {
  const languageName = getLanguageName(startingLanguage);

  // Auto-detect mode on first call: bilingual greeting
  if (isAutoDetect && isFirstCall) {
    const bilingual = compressed
      ? `## Language
Start with bilingual greeting: "Hello! ¡Hola! Nice to finally speak with you, {userName}! I'm Ultaura, your AI companion."
CRITICAL: Call report_conversation_language IMMEDIATELY after user's first response.
Adapt to whatever language they respond in. Stay bilingual until language is confirmed.`
      : `## Language - Auto-Detection Mode
This is a FIRST CALL with language auto-detection enabled.

### Opening Greeting
Use this bilingual greeting: "Hello! ¡Hola! Nice to finally speak with you, {userName}! I'm Ultaura, your AI companion."

### Language Detection (CRITICAL)
- Listen carefully to {userName}'s FIRST response
- IMMEDIATELY call report_conversation_language with the detected ISO 639-1 code
- This MUST happen after their first verbal response, before continuing conversation
- Supported codes: en, es, fr, de, it, pt, ja, ko, zh

### After Detection
- Continue entirely in the detected language
- Do NOT repeat the bilingual greeting
- Proceed with normal conversation flow

### If Detection Fails
- If you cannot determine the language, continue in English
- Retry detection on their next response`;

    return bilingual;
  }

  // Fixed language mode or subsequent auto-detect calls
  const baseInstruction = startingLanguage === 'en'
    ? 'Start in English.'
    : `Start in ${languageName}.`;

  const switchBehavior = compressed
    ? 'Respond in whatever language the user speaks. Switch naturally mid-conversation if they change languages.'
    : 'If the user speaks another language, switch to match them naturally.';

  const detectionInstruction = 'When you detect what language the user is speaking, call report_conversation_language with the ISO 639-1 code.';

  return `## Language\n${baseInstruction} ${switchBehavior} ${detectionInstruction}`;
}
```

Update the call site in `compilePrompt`:
```typescript
sections.push(formatLanguageSection(
  params.startingLanguage ?? 'en',
  compressed,
  params.isLanguageAutoDetect ?? false,
  params.isFirstCall ?? false
));
```

### 5.6 Voicemail Message Updates

**File**: `telephony/src/utils/voicemail-messages.ts`

Update `getVoicemailMessage` to accept line language preference:
```typescript
export function getVoicemailMessage(options: {
  name: string;
  language: string;
  preferredLanguageIso: string | null; // Add this
  behavior: VoicemailBehavior;
  isReminderCall: boolean;
  reminderMessage?: string | null;
}): string {
  const { name, language, preferredLanguageIso, behavior, isReminderCall, reminderMessage } = options;

  // If line has no preferred language (auto-detect, never detected), use English
  // Otherwise use the preferred language if supported, or fall back to detected/English
  let effectiveLanguage = language;
  if (preferredLanguageIso === null) {
    effectiveLanguage = 'en'; // Auto-detect lines with no detection yet use English
  } else if (preferredLanguageIso && VOICEMAIL_TEMPLATES[preferredLanguageIso]) {
    effectiveLanguage = preferredLanguageIso;
  }

  const normalized = normalizeLanguageCode(effectiveLanguage);
  const templates = VOICEMAIL_TEMPLATES[normalized] ?? VOICEMAIL_TEMPLATES.en;

  if (behavior === 'detailed' && isReminderCall && reminderMessage) {
    return templates.reminderDetailed(name, reminderMessage);
  }

  return behavior === 'detailed' ? templates.detailed(name) : templates.brief(name);
}
```

Update callers of `getVoicemailMessage` to pass the new field (in `twilio-outbound.ts` or wherever voicemail is triggered).

---

## 6. UI Changes

### 6.1 Add Line Modal

**File**: `src/app/dashboard/(app)/lines/components/AddLineModal.tsx`

Add language preference dropdown to Step 1 (after Timezone):

```tsx
// Add import
import { LANGUAGE_OPTIONS } from '~/lib/ultaura/constants';

// Add state
const [preferredLanguage, setPreferredLanguage] = useState<string | null>(null);

// Add to resetFormState
setPreferredLanguage(null);

// Add to hasChanges calculation
|| preferredLanguage !== null

// Add UI after Timezone section in Step 1:
{/* Language Preference */}
<div className="space-y-2">
  <label className="block text-sm font-medium text-foreground">
    Language Preference (optional)
  </label>
  <Select
    value={preferredLanguage ?? 'auto'}
    onValueChange={(value) => setPreferredLanguage(value === 'auto' ? null : value)}
  >
    <SelectTrigger>
      <SelectValue placeholder="Auto-detect" />
    </SelectTrigger>
    <SelectContent>
      {LANGUAGE_OPTIONS.map((option) => (
        <SelectItem
          key={option.value ?? 'auto'}
          value={option.value ?? 'auto'}
        >
          {option.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  <p className="text-xs text-muted-foreground">
    {preferredLanguage === null
      ? 'Ultaura will use a bilingual greeting and detect language from the first conversation.'
      : `Ultaura will start conversations in ${LANGUAGE_OPTIONS.find(o => o.value === preferredLanguage)?.label}.`}
  </p>
</div>

// Update createLine call:
const result = await createLine({
  accountId,
  displayName,
  phoneE164,
  timezone,
  preferredLanguageIso: preferredLanguage, // Add this
  seedInterests: combinedTopics.length ? combinedTopics : undefined,
  seedAvoidTopics: avoidTopics ? avoidTopics.split(',').map(s => s.trim()) : undefined,
  defaultSharingTier: isSelfUser ? undefined : defaultSharingTier,
});
```

### 6.2 Line Settings Page

**File**: `src/app/dashboard/(app)/lines/[lineId]/settings/SettingsClient.tsx`

Add language setting to the "Calling & Availability" tab:

Add to imports:
```tsx
import { LANGUAGE_OPTIONS } from '~/lib/ultaura/constants';
import { Languages } from 'lucide-react';
```

Add to section configs:
```tsx
const LINE_SETTINGS_SECTIONS: Record<LineSettingsTabValue, LineSettingsSectionConfig[]> = {
  calling: [
    { value: 'language', label: 'Language', icon: Languages }, // Add this
    { value: 'timezone', label: 'Timezone', icon: Globe },
    // ... rest
  ],
  // ...
};
```

Add state:
```tsx
const [preferredLanguage, setPreferredLanguage] = useState<string | null>(
  line.preferred_language_iso ?? null
);
```

Add to `resetFormState`:
```tsx
setPreferredLanguage(line.preferred_language_iso ?? null);
```

Add to `hasLineChanges`:
```tsx
|| preferredLanguage !== (line.preferred_language_iso ?? null)
```

Add to `handleSubmit` updates object:
```tsx
preferredLanguageIso: preferredLanguage,
```

Add section content in the switch statement:
```tsx
case 'language':
  return (
    <Section>
      <SectionHeader
        title={
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-muted-foreground" />
            Language Preference
          </div>
        }
        description="Set the language for calls with this line."
      />
      <SectionBody className="gap-4">
        <Select
          value={preferredLanguage ?? 'auto'}
          onValueChange={(value) => setPreferredLanguage(value === 'auto' ? null : value)}
          disabled={disabled}
        >
          <SelectTrigger className="w-full py-3">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_OPTIONS.map((option) => (
              <SelectItem
                key={option.value ?? 'auto'}
                value={option.value ?? 'auto'}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
          {preferredLanguage === null ? (
            <>
              <p className="font-medium text-foreground">Auto-detect mode</p>
              <p className="mt-1">
                Ultaura will use a bilingual greeting on the first call and detect
                {line.display_name}&apos;s preferred language from their response.
                Once detected, the language will be saved automatically.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-foreground">
                {LANGUAGE_OPTIONS.find(o => o.value === preferredLanguage)?.label}
              </p>
              <p className="mt-1">
                Ultaura will start all calls in {LANGUAGE_OPTIONS.find(o => o.value === preferredLanguage)?.label}.
                {line.display_name} can still switch languages during calls.
              </p>
            </>
          )}
        </div>
      </SectionBody>
    </Section>
  );
```

---

## 7. Implementation Steps

### Phase 1: Database and Types (Day 1)

1. **Create migration file**
   - File: `supabase/migrations/20260320000001_add_language_preference.sql`
   - Add `preferred_language_bcp47` and `preferred_language_iso` columns
   - Add constraint and index

2. **Regenerate database types**
   - Run: `npx supabase gen types typescript --local > src/database.types.ts`

3. **Update Zod schemas**
   - File: `packages/schemas/src/line.ts`
   - Add `preferredLanguageIso` to both schemas

4. **Update TypeScript types**
   - File: `src/lib/ultaura/types.ts`
   - Add fields to interfaces

5. **Add constants**
   - File: `src/lib/ultaura/constants.ts`
   - Add `LANGUAGE_OPTIONS` array

### Phase 2: Server Actions (Day 1)

6. **Update lines.ts**
   - File: `src/lib/ultaura/lines.ts`
   - Update `createLine()` to handle `preferredLanguageIso`
   - Update `updateLine()` to handle `preferredLanguageIso`

### Phase 3: Telephony Services (Day 2)

7. **Update language service**
   - File: `telephony/src/services/language.ts`
   - Implement `getStartingLanguageForLine()` returning `{ language, isAutoDetect }`
   - Implement `persistLanguageToLine()`
   - Keep `getLastDetectedLanguageForLine()` for backward compatibility

8. **Update report-conversation-language tool**
   - File: `telephony/src/routes/tools/report-conversation-language.ts`
   - Add logic to persist language for auto-detect lines

9. **Update media-stream.ts**
   - File: `telephony/src/websocket/media-stream.ts`
   - Change to use `getStartingLanguageForLine()`
   - Pass `isLanguageAutoDetect` to GrokBridge

10. **Update grok-bridge.ts**
    - File: `telephony/src/websocket/grok-bridge.ts`
    - Add `isLanguageAutoDetect` to options interface
    - Pass to `compilePrompt()`

### Phase 4: Prompt Updates (Day 2)

11. **Update prompt profiles**
    - File: `packages/prompts/src/profiles/index.ts`
    - Update `CompanionPromptParams` interface
    - Update `formatLanguageSection()` with bilingual greeting logic
    - Update `compilePrompt()` call site

12. **Update reminder prompt builder**
    - File: `packages/prompts/src/builders/reminder.ts`
    - Update to handle auto-detect mode if applicable

### Phase 5: Voicemail Updates (Day 3)

13. **Update voicemail messages**
    - File: `telephony/src/utils/voicemail-messages.ts`
    - Update `getVoicemailMessage()` to accept `preferredLanguageIso`
    - Update all callers to pass the new field

### Phase 6: Dashboard UI (Day 3)

14. **Update AddLineModal**
    - File: `src/app/dashboard/(app)/lines/components/AddLineModal.tsx`
    - Add language preference dropdown to Step 1

15. **Update SettingsClient**
    - File: `src/app/dashboard/(app)/lines/[lineId]/settings/SettingsClient.tsx`
    - Add language section to "Calling & Availability" tab

### Phase 7: Testing and Verification (Day 4)

16. **Manual testing**
    - Test line creation with various language preferences
    - Test first call auto-detect flow
    - Test language persistence after detection
    - Test language change during call
    - Test voicemail in different languages
    - Test settings update

17. **Edge case testing**
    - Test unsupported language detection (should store and use)
    - Test repeated detection failures
    - Test family override scenario

---

## 8. Testing Plan

### Unit Tests

1. **Language Service Tests**
   - `getStartingLanguageForLine()` returns correct result for:
     - Line with `preferred_language_iso` set
     - Line with `preferred_language_iso` = NULL (auto-detect)
   - `persistLanguageToLine()` correctly updates both columns

2. **Schema Validation Tests**
   - Valid ISO codes are accepted
   - Invalid codes are rejected
   - NULL is accepted (auto-detect)

### Integration Tests

3. **Line Creation Flow**
   - Create line with language preference set
   - Create line without language preference (auto-detect)
   - Verify database state after creation

4. **Call Flow Tests**
   - First call with auto-detect: verify bilingual greeting instruction in prompt
   - First call with fixed language: verify single-language instruction
   - Subsequent call: verify language from line table is used

5. **Language Detection Persistence**
   - Simulate `report_conversation_language` tool call
   - Verify language is persisted to line for auto-detect lines
   - Verify language is NOT persisted for fixed-language lines (no override)

### Manual QA Checklist

- [ ] Create new line with "Auto-detect" - verify bilingual greeting on first call
- [ ] Create new line with "Spanish" - verify Spanish greeting on first call
- [ ] Complete first call with auto-detect line - verify language persists
- [ ] Make second call to previously auto-detected line - verify language is used
- [ ] Change language in settings - verify next call uses new language
- [ ] Test voicemail message language selection
- [ ] Test language switch during call (senior speaks different language)
- [ ] Test UI shows correct state (auto-detect vs fixed)

---

## 9. Rollback Plan

### Immediate Rollback (Database)

If issues are discovered after deployment:

1. **Run rollback migration**
   ```sql
   ALTER TABLE ultaura_lines
     DROP CONSTRAINT IF EXISTS ultaura_lines_preferred_language_iso_check;

   DROP INDEX IF EXISTS idx_ultaura_lines_preferred_language_iso;

   ALTER TABLE ultaura_lines
     DROP COLUMN IF EXISTS preferred_language_bcp47,
     DROP COLUMN IF EXISTS preferred_language_iso;
   ```

2. **Revert code changes**
   - Revert to previous version of all modified files
   - The system will fall back to the existing `getLastDetectedLanguageForLine()` behavior

### Partial Rollback (Code Only)

If database is fine but code has issues:

1. **Revert prompt changes** - Remove bilingual greeting logic from `formatLanguageSection()`
2. **Revert tool handler** - Remove persistence logic from `report-conversation-language.ts`
3. **Revert UI** - Remove language dropdowns from AddLineModal and SettingsClient

The database columns will remain but be unused, causing no harm.

### Monitoring During Rollout

- Monitor for increased call failures or disconnections
- Watch for reports of confused users (unexpected language)
- Check `ultaura_call_events` for `report_conversation_language` tool errors
- Monitor `ultaura_lines` for unexpected language values

---

## 10. Future Enhancements (Out of Scope)

1. **Regional variants**: Support es-MX vs es-ES with different formality/vocabulary
2. **Voice selection by language**: Auto-select Grok voice based on language
3. **SMS language**: Extend language preference to SMS notifications
4. **Language analytics**: Dashboard showing language distribution across lines
5. **Family notification language**: Send weekly summaries in senior's language

---

## 11. Summary of Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language selection in setup | Optional during line creation | Keep setup flow simple while allowing upfront configuration |
| Bilingual greeting languages | English + Spanish only | Covers largest US non-English demographic; keeps greeting concise |
| Detection mechanism | LLM with forced early detection | Simpler than external service; stricter prompting addresses reliability |
| Persistence behavior | Remember but stay flexible | Start in detected language but adapt if senior switches |
| Mid-call language change | Always allowed, persists | Seniors should always be able to communicate in their preferred language |
| Dashboard dropdown | Single dropdown with "Auto-detect" first | Clean UX; auto-detect as NULL simplifies logic |
| Detection failure fallback | Continue in English | Safest fallback for US market |
| Unsupported language | Store and use, fallback messages in English | Don't limit AI capabilities; gracefully degrade for system messages |
| Storage format | Both BCP-47 and ISO 639-1 columns | Future-proof while keeping queries simple |
| Migration approach | All existing lines get auto-detect (NULL) | Clean slate; no complex backfill |
| Rollout | Full rollout immediately | Feature is low-risk and addresses critical churn issue |
| Voicemail for auto-detect | English until language detected | Consistent experience; no bilingual voicemail complexity |

---

## 12. Critical Files Reference

| File | Purpose | Changes |
|------|---------|---------|
| `supabase/migrations/20260320000001_add_language_preference.sql` | Database migration | New file |
| `packages/schemas/src/line.ts` | Zod validation | Add `preferredLanguageIso` field |
| `src/lib/ultaura/types.ts` | TypeScript types | Add language fields to interfaces |
| `src/lib/ultaura/constants.ts` | Constants | Add `LANGUAGE_OPTIONS` array |
| `src/lib/ultaura/lines.ts` | Server actions | Handle language in create/update |
| `telephony/src/services/language.ts` | Language service | New `getStartingLanguageForLine()`, `persistLanguageToLine()` |
| `telephony/src/routes/tools/report-conversation-language.ts` | Tool handler | Add persistence logic for auto-detect |
| `telephony/src/websocket/media-stream.ts` | WebSocket handler | Pass `isLanguageAutoDetect` to bridge |
| `telephony/src/websocket/grok-bridge.ts` | Grok connection | Add `isLanguageAutoDetect` option |
| `packages/prompts/src/profiles/index.ts` | Prompt compilation | Update `formatLanguageSection()` |
| `telephony/src/utils/voicemail-messages.ts` | Voicemail messages | Accept `preferredLanguageIso` param |
| `src/app/dashboard/(app)/lines/components/AddLineModal.tsx` | Line creation UI | Add language dropdown |
| `src/app/dashboard/(app)/lines/[lineId]/settings/SettingsClient.tsx` | Line settings UI | Add language section |
