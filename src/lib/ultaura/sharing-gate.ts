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
}

export async function validateAccountOwnership(
  userClient: SupabaseClient,
  accountId: string
): Promise<boolean> {
  const { data: authData, error: authError } = await userClient.auth.getUser();
  const ownerUserId = authData.user?.id;
  if (authError || !ownerUserId) {
    return false;
  }

  const { data } = await userClient
    .from('ultaura_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('created_by_user_id', ownerUserId)
    .maybeSingle();

  return data !== null;
}

// NOTE: Health Profile is intentionally excluded from the sharing gate.
// Health access is owner-only (gated by requireHealthOwner) and governed by
// its own consent system (ultaura_health_line_consent). The sharing gate
// only controls insight/memory sharing with family viewers — Health data
// never flows through this gate.
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
  const [accountResult, voiceConsentResult, privacyResult] = await Promise.all([
    client
      .from('ultaura_accounts')
      .select('user_type')
      .eq('id', accountId)
      .single(),
    client
      .from('ultaura_line_voice_consent')
      .select('sharing_consent, sharing_tier')
      .eq('line_id', lineId)
      .maybeSingle(),
    client
      .from('ultaura_insight_privacy')
      .select('is_paused, insights_enabled')
      .eq('line_id', lineId)
      .maybeSingle(),
  ]);

  return {
    userType: (accountResult.data?.user_type ?? 'family_managed') as 'self' | 'family_managed',
    sharingConsent: (voiceConsentResult.data?.sharing_consent ?? 'pending') as VoiceConsentStatus,
    sharingTier: (voiceConsentResult.data?.sharing_tier ?? 'tier_1') as SharingTier,
    isPaused: privacyResult.data?.is_paused ?? false,
    insightsEnabled: privacyResult.error ? false : (privacyResult.data?.insights_enabled ?? false),
  };
}
