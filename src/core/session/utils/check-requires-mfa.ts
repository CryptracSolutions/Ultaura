import type { SupabaseClient } from '@supabase/supabase-js';

import { isTrustedDevice } from '~/lib/server/cookies/trusted-device.cookie';

const ASSURANCE_LEVEL_2 = 'aal2';

async function checkSessionRequiresMultiFactorAuthentication(
  client: SupabaseClient,
  options?: { userId?: string; factorIds?: string[] },
) {
  // @ts-expect-error: suppressGetSessionWarning is not part of the public API
  client.auth.suppressGetSessionWarning = true;

  const assuranceLevel = await client.auth.mfa.getAuthenticatorAssuranceLevel();

  // @ts-expect-error: suppressGetSessionWarning is not part of the public API
  client.auth.suppressGetSessionWarning = false;

  if (assuranceLevel.error) {
    throw new Error(assuranceLevel.error.message);
  }

  const { nextLevel, currentLevel } = assuranceLevel.data;
  const mfaRequired =
    nextLevel === ASSURANCE_LEVEL_2 && nextLevel !== currentLevel;

  if (!mfaRequired) {
    return false;
  }

  let userId = options?.userId;
  let factorIds = options?.factorIds;

  if (!userId || !factorIds) {
    const {
      data: { user },
    } = await client.auth.getUser();

    userId = user?.id;

    if (userId && !factorIds) {
      const { data: factors } = await client.auth.mfa.listFactors();

      factorIds = [...(factors?.totp ?? []), ...(factors?.phone ?? [])].map(
        (f) => f.id,
      );
    }
  }

  if (userId && factorIds?.length) {
    try {
      const trusted = isTrustedDevice(userId, factorIds);

      if (trusted) return false;
    } catch {
      // If trusted device check fails, fall through to require normal MFA.
    }
  }

  return true;
}

export default checkSessionRequiresMultiFactorAuthentication;
