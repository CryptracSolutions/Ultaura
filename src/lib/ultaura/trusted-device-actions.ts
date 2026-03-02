'use server';

import getSupabaseServerActionClient from '~/core/supabase/action-client';

import {
  setTrustedDeviceCookie,
  clearTrustedDeviceCookie,
} from '~/lib/server/cookies/trusted-device.cookie';
import { generateTrustedDeviceToken } from '~/lib/server/trusted-device';

export async function setTrustedDeviceAction(factorId: string) {
  const client = getSupabaseServerActionClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { data: assurance } =
    await client.auth.mfa.getAuthenticatorAssuranceLevel();

  if (assurance?.currentLevel !== 'aal2') throw new Error('MFA not verified');

  const { data: factors } = await client.auth.mfa.listFactors();
  const allFactors = [...(factors?.totp ?? []), ...(factors?.phone ?? [])];

  if (!allFactors.some((f) => f.id === factorId)) {
    throw new Error('Invalid factor');
  }

  const token = generateTrustedDeviceToken(user.id, factorId);
  setTrustedDeviceCookie(token);

  return { success: true };
}

export async function clearTrustedDeviceAction() {
  clearTrustedDeviceCookie();

  return { success: true };
}
