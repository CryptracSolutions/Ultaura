import type { SupabaseClient } from '@supabase/supabase-js';
import type { SharingTier, VoiceConsentStatus } from '@ultaura/types';

export interface SharingGateResult {
  canAccessNonSafety: boolean;
  effectiveTier: SharingTier;
  allowMood: boolean;
  allowTopics: boolean;
  allowConcerns: boolean;
  isFamilyOutputSuppressed: boolean;
  isSelfUser: boolean;
  insightsEnabled: boolean;
}

interface InternalSharingGateContext {
  userType: 'self' | 'family_managed';
  sharingConsent: VoiceConsentStatus;
  sharingTier: SharingTier;
  isPaused: boolean;
  insightsEnabled: boolean;
  privateTopicCodes: string[];
}

export async function validateAccountOwnership(
  userClient: SupabaseClient,
  accountId: string
): Promise<boolean> {
  const { data } = await userClient
    .from('ultaura_accounts')
    .select('id')
    .eq('id', accountId)
    .maybeSingle();

  return data !== null;
}

export async function getSharingGate(
  adminClient: SupabaseClient,
  lineId: string,
  accountId: string
): Promise<SharingGateResult> {
  const context = await fetchInternalContext(adminClient, lineId, accountId);
  return evaluateSharingGate(context);
}

export async function getPrivateTopicCodes(
  adminClient: SupabaseClient,
  lineId: string
): Promise<string[]> {
  const { data } = await adminClient
    .from('ultaura_insight_privacy')
    .select('private_topic_codes')
    .eq('line_id', lineId)
    .maybeSingle();

  return (data?.private_topic_codes as string[]) ?? [];
}

export function filterPrivateTopics<T extends { code?: string; topic_code?: string }>(
  topics: T[],
  privateTopicCodes: string[]
): T[] {
  const privateSet = new Set(privateTopicCodes);

  return topics.filter((topic) => {
    const code = topic.code || topic.topic_code;
    return code ? !privateSet.has(code) : true;
  });
}

export function evaluateSharingGate(
  context: InternalSharingGateContext
): SharingGateResult {
  const isSelfUser = context.userType === 'self';
  const insightsEnabled = context.insightsEnabled;
  const consentGranted = context.sharingConsent === 'granted';
  const effectiveTier: SharingTier = isSelfUser
    ? 'tier_4'
    : consentGranted
      ? context.sharingTier
      : 'tier_1';
  const canAccessNonSafety = insightsEnabled && (isSelfUser || consentGranted);

  return {
    canAccessNonSafety,
    effectiveTier,
    allowMood: canAccessNonSafety && (isSelfUser || effectiveTier !== 'tier_1'),
    allowTopics: canAccessNonSafety && (isSelfUser || effectiveTier === 'tier_3' || effectiveTier === 'tier_4'),
    allowConcerns: canAccessNonSafety && (isSelfUser || effectiveTier === 'tier_4'),
    isFamilyOutputSuppressed: !isSelfUser && context.isPaused,
    isSelfUser,
    insightsEnabled,
  };
}

async function fetchInternalContext(
  client: SupabaseClient,
  lineId: string,
  accountId: string
): Promise<InternalSharingGateContext> {
  const { data: account } = await client
    .from('ultaura_accounts')
    .select('user_type')
    .eq('id', accountId)
    .single();

  const { data: voiceConsent } = await client
    .from('ultaura_line_voice_consent')
    .select('sharing_consent, sharing_tier')
    .eq('line_id', lineId)
    .maybeSingle();

  const { data: privacy } = await client
    .from('ultaura_insight_privacy')
    .select('is_paused, insights_enabled')
    .eq('line_id', lineId)
    .maybeSingle();

  return {
    userType: (account?.user_type ?? 'family_managed') as 'self' | 'family_managed',
    sharingConsent: (voiceConsent?.sharing_consent ?? 'pending') as VoiceConsentStatus,
    sharingTier: (voiceConsent?.sharing_tier ?? 'tier_1') as SharingTier,
    isPaused: privacy?.is_paused ?? false,
    insightsEnabled: privacy?.insights_enabled ?? true,
    privateTopicCodes: [],
  };
}
