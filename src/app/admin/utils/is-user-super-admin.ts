import type { SupabaseClient } from '@supabase/supabase-js';
import GlobalRole from '~/core/session/types/global-role';
import { Database } from '~/database.types';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';

function getEnforceMfa(): boolean {
  const envValue = process.env.ADMIN_ENFORCE_MFA;
  if (envValue !== undefined) {
    return envValue === 'true';
  }
  return process.env.NODE_ENV === 'production';
}

/**
 * @name isUserSuperAdmin
 * @description Checks if the current user is an admin by checking the
 * user_metadata.role field in Supabase Auth is set to a SuperAdmin role.
 * MFA (AAL2) is enforced in production by default, controlled via ADMIN_ENFORCE_MFA env var.
 */
const isUserSuperAdmin = async (
  params: {
    client: SupabaseClient<Database>;
    enforceMfa?: boolean;
  } = {
    client: getSupabaseServerComponentClient(),
    enforceMfa: getEnforceMfa(),
  },
) => {
  const client = params.client ?? getSupabaseServerComponentClient();
  const enforceMfa = params.enforceMfa ?? getEnforceMfa();

  const { data, error } = await client.auth.getUser();

  if (error) {
    return false;
  }

  // If we enforce MFA, we need to check that the user is MFA authenticated.
  if (enforceMfa) {
    const isMfaAuthenticated = await verifyIsMultiFactorAuthenticated(client);

    if (!isMfaAuthenticated) {
      return false;
    }
  }

  const adminMetadata = data.user?.app_metadata;
  const role = adminMetadata?.role;

  return role === GlobalRole.SuperAdmin;
};

export default isUserSuperAdmin;

export { getEnforceMfa };

export async function isUserSuperAdminWithoutMfa(
  client?: SupabaseClient<Database>,
) {
  const c = client ?? getSupabaseServerComponentClient();
  const { data, error } = await c.auth.getUser();
  if (error) return false;
  return data.user?.app_metadata?.role === GlobalRole.SuperAdmin;
}

export async function isUserMfaAuthenticated(
  client?: SupabaseClient<Database>,
) {
  const c = client ?? getSupabaseServerComponentClient();
  return verifyIsMultiFactorAuthenticated(c);
}

async function verifyIsMultiFactorAuthenticated(client: SupabaseClient) {
  const { data, error } =
    await client.auth.mfa.getAuthenticatorAssuranceLevel();

  if (error || !data) {
    return false;
  }

  return data.currentLevel === 'aal2';
}
