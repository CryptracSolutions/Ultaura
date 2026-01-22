import type {
  Memory,
  AccountStatus,
  PlanId,
} from '@ultaura/types';
import { getLanguageName } from '../utils/language.js';
import { IDENTITY_SECTION } from '../golden/sections/identity.js';
import { CONVERSATION_STYLE_SECTION } from '../golden/sections/conversation-style.js';
import { ADAPTIVE_PERSONA_SECTION } from '../golden/sections/adaptive-persona.js';
import { LIFE_STORY_SECTION } from '../golden/sections/life-story.js';
import { RELATIONSHIP_MAPPING_SECTION } from '../golden/sections/relationships.js';
import { EMOTIONAL_INTELLIGENCE_SECTION } from '../golden/sections/emotional-intelligence.js';
import { ACCESSIBILITY_SECTION } from '../golden/sections/accessibility.js';
import { DAILY_RHYTHM_SECTION } from '../golden/sections/daily-rhythm.js';
import { HEALTH_WELLNESS_SECTION } from '../golden/sections/health-wellness.js';
import { CELEBRATION_SECTION } from '../golden/sections/celebration.js';
import { GRIEF_SUPPORT_SECTION } from '../golden/sections/grief-support.js';
import { CONTENT_ENGINE_SECTION } from '../golden/sections/content-engine.js';
import { SEAMLESS_EXPERIENCE_SECTION } from '../golden/sections/seamless-experience.js';
import { INTERRUPTION_HANDLING_SECTION } from '../golden/sections/interruption-handling.js';
import { RECENT_CALLS_SECTION } from '../golden/sections/recent-calls.js';
import { SAFETY_POLICY_SECTION } from '../golden/sections/safety-policy.js';
import { TOOL_POLICY_SECTION } from '../golden/sections/tool-policy.js';
import { MEMORY_POLICY_SECTION } from '../golden/sections/memory-policy.js';
import { PRIVACY_POLICY_SECTION } from '../golden/sections/privacy-policy.js';
import { ONBOARDING_SECTION } from '../golden/sections/onboarding.js';
import { PLANS_PRICING_SECTION } from '../golden/sections/plans-pricing.js';
import { AVOID_SECTION } from '../golden/sections/avoid.js';
import { INSIGHTS_SECTION } from '../golden/sections/insights.js';
import { RETENTION_POLICY_SECTION, INBOUND_REMINDER_SECTION } from '../golden/sections/retention-policy.js';
import { WEB_SEARCH_POLICY_SECTION } from '../golden/sections/web-search-policy.js';
import { SEGMENTS_POLICY_SECTION } from '../golden/sections/segments-policy.js';
import { RECORDING_CONSENT_SECTION } from '../golden/sections/recording-consent.js';
import { FAMILY_SHARING_CONSENT_SECTION } from '../golden/sections/family-sharing-consent.js';
import { INSIGHTS_CONSENT_SECTION } from '../golden/sections/insights-consent.js';
import { sanitizeForPrompt, sanitizeKey } from '../utils/sanitize.js';

export type PromptProfile = 'voice_realtime' | 'admin_preview';

interface PromptSection {
  full: string;
  compressed: string;
}

export interface CompanionPromptParams {
  userName: string;
  startingLanguage?: string;
  isLanguageAutoDetect?: boolean;
  memories: Memory[];
  isFirstCall: boolean;
  memoryEnabled?: boolean;
  isPreviewMode?: boolean;
  timezone?: string;
  seedInterests?: string[] | null;
  seedAvoidTopics?: string[] | null;
  lowMinutesWarning?: boolean;
  minutesRemaining?: number;
  currentPlanId?: PlanId;
  accountStatus?: AccountStatus;
  canReceiveInboundCalls?: boolean;
  isTestCall?: boolean;
  userType?: 'self' | 'family_managed';
  sharingEnabled?: boolean;
  recordingEnabled?: boolean;
  recordingConsent?: 'pending' | 'granted' | 'denied';
  needsRecordingConsent?: boolean;
  sharingTier?: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
  sharingConsent?: 'pending' | 'granted' | 'denied';
  needsSharingConsent?: boolean;
  onboardingCompleted?: boolean;
  placeholders?: Record<string, string>;
}

function selectSection(section: PromptSection, compressed: boolean): string {
  return compressed ? section.compressed : section.full;
}

export function compilePrompt(
  profile: PromptProfile,
  params: CompanionPromptParams
): string {
  const sections: string[] = [];
  const compressed = profile === 'voice_realtime';
  const memoryEnabled = params.memoryEnabled !== false;
  const canReceiveInboundCalls = params.canReceiveInboundCalls === true;
  const isTestCall = params.isTestCall === true;
  const safeUserName = sanitizeForPrompt(params.userName);
  const safeSeedInterests = params.seedInterests
    ?.map((interest) => sanitizeForPrompt(interest))
    .filter((interest) => interest.length > 0);
  const safeSeedAvoidTopics = params.seedAvoidTopics
    ?.map((topic) => sanitizeForPrompt(topic))
    .filter((topic) => topic.length > 0);

  sections.push(selectSection(IDENTITY_SECTION, compressed));
  sections.push(selectSection(CONVERSATION_STYLE_SECTION, compressed));
  sections.push(selectSection(ADAPTIVE_PERSONA_SECTION, compressed));
  sections.push(selectSection(LIFE_STORY_SECTION, compressed));
  sections.push(selectSection(RELATIONSHIP_MAPPING_SECTION, compressed));
  sections.push(selectSection(EMOTIONAL_INTELLIGENCE_SECTION, compressed));
  sections.push(selectSection(ACCESSIBILITY_SECTION, compressed));
  sections.push(selectSection(DAILY_RHYTHM_SECTION, compressed));

  const memoryText = formatMemoriesForPrompt(params.memories);
  const memoryHeader = compressed ? '## Memory' : `## Your Memory of ${safeUserName}`;
  sections.push(`${memoryHeader}\n${memoryText}`);

  sections.push(selectSection(HEALTH_WELLNESS_SECTION, compressed));
  sections.push(selectSection(CELEBRATION_SECTION, compressed));
  sections.push(selectSection(GRIEF_SUPPORT_SECTION, compressed));
  sections.push(selectSection(CONTENT_ENGINE_SECTION, compressed));
  sections.push(selectSection(SEAMLESS_EXPERIENCE_SECTION, compressed));
  sections.push(selectSection(INTERRUPTION_HANDLING_SECTION, compressed));

  sections.push(selectSection(PRIVACY_POLICY_SECTION, compressed));
  sections.push(selectSection(SAFETY_POLICY_SECTION, compressed));
  sections.push(selectSection(TOOL_POLICY_SECTION, compressed));

  if (memoryEnabled) {
    sections.push(selectSection(MEMORY_POLICY_SECTION, compressed));
  }

  if (!isTestCall) {
    sections.push(selectSection(RETENTION_POLICY_SECTION, compressed));
    if (canReceiveInboundCalls) {
      sections.push(selectSection(INBOUND_REMINDER_SECTION, compressed));
    }
  }

  sections.push(selectSection(WEB_SEARCH_POLICY_SECTION, compressed));

  if (!isTestCall) {
    sections.push(selectSection(SEGMENTS_POLICY_SECTION, compressed));
  }

  sections.push(selectSection(INSIGHTS_SECTION, compressed));
  sections.push(selectSection(INSIGHTS_CONSENT_SECTION, compressed));

  if (params.currentPlanId && params.accountStatus) {
    sections.push(formatPlansSection(params.currentPlanId, params.accountStatus, compressed));
  }

  if (safeSeedInterests?.length) {
    const interests = safeSeedInterests.join(', ');
    sections.push(
      compressed
        ? `Interests (from family): ${interests}`
        : `## Interests (provided by family)\n${safeUserName}'s family mentioned they enjoy: ${interests}.\nUse these as natural conversation starters. Don't force - weave in organically.`
    );
  }

  if (safeSeedAvoidTopics?.length) {
    const topics = safeSeedAvoidTopics.join(', ');
    sections.push(
      compressed
        ? `Avoid topics: ${topics}`
        : `## Topics to Avoid (provided by family)\nPlease avoid discussing: ${topics}.\nIf ${safeUserName} brings up these topics themselves, engage gently but don't initiate.`
    );
  }

  if (params.isFirstCall) {
    sections.push(selectSection(ONBOARDING_SECTION, compressed));
  }

  if (params.needsRecordingConsent && params.recordingEnabled) {
    sections.push(selectSection(RECORDING_CONSENT_SECTION, compressed));
  }

  if (params.needsSharingConsent && params.userType === 'family_managed') {
    sections.push(selectSection(FAMILY_SHARING_CONSENT_SECTION, compressed));
  }

  if (params.lowMinutesWarning && params.minutesRemaining !== undefined) {
    sections.push(
      compressed
        ? `Low minutes: ~${params.minutesRemaining} remaining. Mention near end of call.`
        : `## Low Minutes Warning\n${safeUserName} has approximately ${params.minutesRemaining} minutes remaining. Near the end of the call, gently mention this.`
    );
  }

  sections.push(selectSection(RECENT_CALLS_SECTION, compressed));
  sections.push(formatLanguageSection(
    params.startingLanguage ?? 'en',
    compressed,
    params.isLanguageAutoDetect ?? false,
    params.isFirstCall ?? false
  ));
  sections.push(formatTimezoneSection(params.timezone));

  if (!compressed) {
    sections.push(AVOID_SECTION.full);
  }

  return applyPlaceholders(sections.join('\n\n'), {
    ...params,
    userName: safeUserName,
    seedInterests: safeSeedInterests,
    seedAvoidTopics: safeSeedAvoidTopics,
  });
}

export function formatMemoriesForPrompt(memories: Memory[]): string {
  if (!memories.length) return 'No previous memories recorded yet.';
  return memories.map((memory) => {
    const key = sanitizeKey(memory.key);
    const value = sanitizeForPrompt(formatValue(memory.value));
    const expiryNote = memory.expiryPending ? ' (needs review)' : '';
    return `- ${key}: ${value}${expiryNote}`;
  }).join('\n');
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}

function formatPlansSection(planId: PlanId, status: AccountStatus, compressed: boolean): string {
  const planLabel = planId === 'free_trial' ? 'Trial' : planId;
  const statusLabel = status === 'trial' ? 'Trial' : status === 'active' ? 'Active Subscription' : status;
  const template = compressed ? PLANS_PRICING_SECTION.compressed : PLANS_PRICING_SECTION.full;
  return template
    .replace(/\{currentPlanLabel\}/g, planLabel)
    .replace(/\{accountStatusLabel\}/g, statusLabel);
}

function formatLanguageSection(
  startingLanguage: string,
  compressed: boolean,
  isAutoDetect: boolean = false,
  isFirstCall: boolean = false
): string {
  const languageName = getLanguageName(startingLanguage);

  if (isAutoDetect && isFirstCall) {
    return compressed
      ? `## Language
Start with bilingual greeting: "Hello! \u00a1Hola! Nice to finally speak with you, {userName}! I'm Ultaura, your AI companion."
Language persistence: The system may auto-detect language from the user's first response. If you confidently detect the language (or they switch), call report_conversation_language with the ISO 639-1 code.
Adapt to whatever language they respond in. Stay bilingual until language is confirmed.
If they switch languages later, call report_conversation_language again.`
      : `## Language - Auto-Detection Mode
This is a FIRST CALL with language auto-detection enabled.

### Opening Greeting
Use this bilingual greeting: "Hello! \u00a1Hola! Nice to finally speak with you, {userName}! I'm Ultaura, your AI companion."

### Language Detection (CRITICAL)
- Listen carefully to {userName}'s FIRST response
- If you confidently detect the language (or they switch), call report_conversation_language with the detected ISO 639-1 code
- Supported codes: en, es, fr, de, it, pt, ja, ko, zh, nl, ru, ar, hi, tr, pl, sv, da, no, fi, cs, th, vi, id, ms, tl, uk, el, he, ro, hu

### After Detection
- Continue entirely in the detected language
- Do NOT repeat the bilingual greeting
- Proceed with normal conversation flow
- If they switch languages later, call report_conversation_language again and continue in the new language

### If Detection Fails
- If you cannot determine the language, continue in English
- Retry detection on their next response`;
  }

  const baseInstruction = startingLanguage === 'en' ? 'Start in English.' : `Start in ${languageName}.`;
  const switchBehavior = compressed
    ? 'Respond in whatever language the user speaks. Switch naturally mid-conversation if they change languages.'
    : 'If the user speaks another language, switch to match them naturally.';
  const detectionInstruction =
    'When you detect what language the user is speaking, call report_conversation_language with the ISO 639-1 code. If they switch languages later, call it again.';

  return `## Language\n${baseInstruction} ${switchBehavior} ${detectionInstruction}`;
}

function formatTimezoneSection(timezone?: string): string {
  return `## Timezone\nUser timezone: ${timezone || 'America/Los_Angeles'}. Be aware of this when discussing times.`;
}

function applyPlaceholders(prompt: string, params: CompanionPromptParams): string {
  const replacements: Record<string, string> = {
    userName: params.userName,
    timezone: params.timezone || 'America/Los_Angeles',
    sharingTier: params.sharingTier || '',
    ...(params.placeholders ?? {}),
  };

  let output = prompt;
  for (const [key, value] of Object.entries(replacements)) {
    const safeValue = value ?? '';
    const pattern = new RegExp(`\\{${escapeRegExp(key)}\\}`, 'g');
    output = output.replace(pattern, safeValue);
  }

  return output;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
