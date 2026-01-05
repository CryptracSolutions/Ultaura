import type {
  PreferredLanguage,
  SpanishFormality,
  Memory,
  AccountStatus,
  PlanId,
} from '@ultaura/types';
import { IDENTITY_SECTION } from '../golden/sections/identity.js';
import { CONVERSATION_STYLE_SECTION } from '../golden/sections/conversation-style.js';
import { SAFETY_POLICY_SECTION } from '../golden/sections/safety-policy.js';
import { TOOL_POLICY_SECTION } from '../golden/sections/tool-policy.js';
import { MEMORY_POLICY_SECTION } from '../golden/sections/memory-policy.js';
import { PRIVACY_POLICY_SECTION } from '../golden/sections/privacy-policy.js';
import { ONBOARDING_SECTION } from '../golden/sections/onboarding.js';
import { PLANS_PRICING_SECTION } from '../golden/sections/plans-pricing.js';
import { AVOID_SECTION } from '../golden/sections/avoid.js';

export type PromptProfile = 'voice_realtime' | 'admin_preview';

export interface CompanionPromptParams {
  userName: string;
  language: PreferredLanguage;
  spanishFormality?: SpanishFormality;
  memories: Memory[];
  isFirstCall: boolean;
  timezone?: string;
  seedInterests?: string[] | null;
  seedAvoidTopics?: string[] | null;
  lowMinutesWarning?: boolean;
  minutesRemaining?: number;
  currentPlanId?: PlanId;
  accountStatus?: AccountStatus;
}

export function compilePrompt(
  profile: PromptProfile,
  params: CompanionPromptParams
): string {
  const sections: string[] = [];
  const isRealtime = profile === 'voice_realtime';

  sections.push(isRealtime ? IDENTITY_SECTION.compressed : IDENTITY_SECTION.full);

  sections.push(
    isRealtime
      ? CONVERSATION_STYLE_SECTION.compressed
      : CONVERSATION_STYLE_SECTION.full
  );

  const memoryText = formatMemoriesForPrompt(params.memories);
  sections.push(
    isRealtime
      ? `## Memory\n${memoryText}`
      : `## Your Memory of ${params.userName}\n${memoryText}`
  );

  sections.push(
    isRealtime
      ? PRIVACY_POLICY_SECTION.compressed
      : PRIVACY_POLICY_SECTION.full
  );

  sections.push(
    isRealtime
      ? SAFETY_POLICY_SECTION.compressed
      : SAFETY_POLICY_SECTION.full
  );

  sections.push(
    isRealtime
      ? TOOL_POLICY_SECTION.compressed
      : TOOL_POLICY_SECTION.full
  );

  sections.push(
    isRealtime
      ? MEMORY_POLICY_SECTION.compressed
      : MEMORY_POLICY_SECTION.full
  );

  if (params.currentPlanId && params.accountStatus) {
    sections.push(
      isRealtime
        ? formatPlansCompressed(params.currentPlanId, params.accountStatus)
        : formatPlansFull(params.currentPlanId, params.accountStatus)
    );
  }

  if (params.seedInterests?.length) {
    sections.push(
      isRealtime
        ? `Interests (from family): ${params.seedInterests.join(', ')}`
        : `## Interests (provided by family)\n${params.userName}'s family mentioned they enjoy: ${params.seedInterests.join(', ')}.\nUse these as natural conversation starters. Don't force - weave in organically.`
    );
  }

  if (params.seedAvoidTopics?.length) {
    sections.push(
      isRealtime
        ? `Avoid topics: ${params.seedAvoidTopics.join(', ')}`
        : `## Topics to Avoid (provided by family)\nPlease avoid discussing: ${params.seedAvoidTopics.join(', ')}.\nIf ${params.userName} brings up these topics themselves, engage gently but don't initiate.`
    );
  }

  if (params.isFirstCall) {
    sections.push(isRealtime ? ONBOARDING_SECTION.compressed : ONBOARDING_SECTION.full);
  }

  if (params.lowMinutesWarning && params.minutesRemaining !== undefined) {
    sections.push(
      isRealtime
        ? `Low minutes: ~${params.minutesRemaining} remaining. Mention near end of call.`
        : `## Low Minutes Warning\n${params.userName} has approximately ${params.minutesRemaining} minutes remaining. Near the end of the call, gently mention this.`
    );
  }

  sections.push(formatLanguageSection(params.language, params.spanishFormality, isRealtime));
  sections.push(formatTimezoneSection(params.timezone));

  if (!isRealtime) {
    sections.push(AVOID_SECTION.full);
  }

  let prompt = sections.join('\n\n');
  prompt = applyPlaceholders(prompt, params);

  return prompt;
}

export function formatMemoriesForPrompt(memories: Memory[]): string {
  if (!memories.length) return 'No previous memories recorded yet.';
  return memories.map((memory) => `- ${memory.key}: ${formatValue(memory.value)}`).join('\n');
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}

function formatPlansFull(planId: PlanId, status: AccountStatus): string {
  const labels = formatPlanLabels(planId, status);
  return PLANS_PRICING_SECTION.full
    .replace(/\{currentPlanLabel\}/g, labels.planLabel)
    .replace(/\{accountStatusLabel\}/g, labels.statusLabel);
}

function formatPlansCompressed(planId: PlanId, status: AccountStatus): string {
  const labels = formatPlanLabels(planId, status);
  return PLANS_PRICING_SECTION.compressed
    .replace(/\{currentPlanLabel\}/g, labels.planLabel)
    .replace(/\{accountStatusLabel\}/g, labels.statusLabel);
}

function formatPlanLabels(planId: PlanId, status: AccountStatus): {
  planLabel: string;
  statusLabel: string;
} {
  const planLabel = planId === 'free_trial' ? 'Trial' : planId;
  const statusLabel =
    status === 'trial' ? 'Trial' : status === 'active' ? 'Active Subscription' : status;
  return { planLabel, statusLabel };
}

function formatLanguageSection(
  language: PreferredLanguage,
  spanishFormality: SpanishFormality | undefined,
  isRealtime: boolean
): string {
  if (language === 'es') {
    const formality = spanishFormality === 'tu' ? 'tú' : 'usted';
    return isRealtime
      ? `## Language\nSpeak Spanish. Use ${formality}.`
      : `## Language\nSpeak in Spanish by default. Use ${formality} unless they indicate otherwise.\nIf they switch to English, follow their lead smoothly.`;
  }

  if (language === 'auto') {
    return isRealtime
      ? '## Language\nStart in English. Switch smoothly if needed.'
      : '## Language\nStart in English. If they speak another language or ask to switch, transition smoothly.';
  }

  return isRealtime
    ? '## Language\nSpeak English.'
    : '## Language\nSpeak in English. If they speak another language, try to accommodate and switch gracefully.';
}

function formatTimezoneSection(timezone?: string): string {
  return `## Timezone\nUser timezone: ${timezone || 'America/Los_Angeles'}. Be aware of this when discussing times.`;
}

function applyPlaceholders(prompt: string, params: CompanionPromptParams): string {
  return prompt
    .replace(/\{userName\}/g, params.userName)
    .replace(/\{timezone\}/g, params.timezone || 'America/Los_Angeles');
}
