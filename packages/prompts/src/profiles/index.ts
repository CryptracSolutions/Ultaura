import type {
  Memory,
  AccountStatus,
  PlanId,
} from '@ultaura/types';
import { getLanguageName } from '../utils/language.js';
import { IDENTITY_SECTION } from '../golden/sections/identity.js';
import { CONVERSATION_STYLE_SECTION } from '../golden/sections/conversation-style.js';
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
import { sanitizeForPrompt, sanitizeKey } from '../utils/sanitize.js';

export type PromptProfile = 'voice_realtime' | 'admin_preview';

interface PromptSection {
  full: string;
  compressed: string;
}

export interface CompanionPromptParams {
  userName: string;
  startingLanguage?: string;
  memories: Memory[];
  isFirstCall: boolean;
  memoryEnabled?: boolean;
  timezone?: string;
  seedInterests?: string[] | null;
  seedAvoidTopics?: string[] | null;
  lowMinutesWarning?: boolean;
  minutesRemaining?: number;
  currentPlanId?: PlanId;
  accountStatus?: AccountStatus;
  canReceiveInboundCalls?: boolean;
  isTestCall?: boolean;
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

  const memoryText = formatMemoriesForPrompt(params.memories);
  const memoryHeader = compressed ? '## Memory' : `## Your Memory of ${safeUserName}`;
  sections.push(`${memoryHeader}\n${memoryText}`);

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

  if (params.lowMinutesWarning && params.minutesRemaining !== undefined) {
    sections.push(
      compressed
        ? `Low minutes: ~${params.minutesRemaining} remaining. Mention near end of call.`
        : `## Low Minutes Warning\n${safeUserName} has approximately ${params.minutesRemaining} minutes remaining. Near the end of the call, gently mention this.`
    );
  }

  sections.push(formatLanguageSection(params.startingLanguage ?? 'en', compressed));
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
    return `- ${key}: ${value}`;
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

function formatLanguageSection(startingLanguage: string, compressed: boolean): string {
  const languageName = getLanguageName(startingLanguage);
  const baseInstruction = startingLanguage === 'en' ? 'Start in English.' : `Start in ${languageName}.`;
  const switchBehavior = compressed
    ? 'Respond in whatever language the user speaks. Switch naturally mid-conversation if they change languages.'
    : 'If the user speaks another language, switch to match them naturally.';
  return `## Language\n${baseInstruction} ${switchBehavior} When you detect what language the user is speaking, call report_conversation_language with the ISO 639-1 code.`;
}

function formatTimezoneSection(timezone?: string): string {
  return `## Timezone\nUser timezone: ${timezone || 'America/Los_Angeles'}. Be aware of this when discussing times.`;
}

function applyPlaceholders(prompt: string, params: CompanionPromptParams): string {
  return prompt
    .replace(/\{userName\}/g, params.userName)
    .replace(/\{timezone\}/g, params.timezone || 'America/Los_Angeles');
}
