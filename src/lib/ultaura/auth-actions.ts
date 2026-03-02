'use server';

import getSupabaseServerActionClient from '~/core/supabase/action-client';

import { clearTrustedDeviceCookie } from '~/lib/server/cookies/trusted-device.cookie';

export async function signOutAction() {
  const client = getSupabaseServerActionClient();

  clearTrustedDeviceCookie();
  await client.auth.signOut();

  return { success: true };
}
