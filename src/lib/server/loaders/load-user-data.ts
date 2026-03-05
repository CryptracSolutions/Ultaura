import 'server-only';

import { getUserDataById } from '~/lib/server/queries';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';
import MembershipRole from '~/lib/organizations/types/membership-role';
import type { Database } from '~/database.types';

/**
 * @name loadUserData
 * @description Loads the user's data from Supabase Auth and Database.
 * This is used in the (site) layout to display the user's name and avatar.
 */
async function loadUserData() {
  const client = getSupabaseServerComponentClient();

  try {
    const { data, error } = await client.auth.getUser();

    if (!data.user || error) {
      return emptyUserData();
    }

    const userId = data.user.id;

    const [userData, role] = await Promise.all([
      getUserDataById(client, userId),
      getEffectiveMembershipRole(client, userId),
    ]);
    const language = await getLanguage();

    return {
      session: {
        auth: {
          user: {
            id: userId,
            email: data.user.email,
            phone: data.user.phone,
          },
        },
        data: userData || undefined,
        role,
      },
      language,
    };
  } catch {
    return emptyUserData();
  }
}

async function emptyUserData() {
  const language = await getLanguage();

  return {
    accessToken: undefined,
    language,
    session: undefined,
  };
}

export default loadUserData;

async function getLanguage() {
  const { language } = await initializeServerI18n(getLanguageCookie());

  return language;
}

async function getEffectiveMembershipRole(
  client: ReturnType<typeof getSupabaseServerComponentClient>,
  userId: string,
) {
  const { data } = await client
    .from('memberships')
    .select('role')
    .eq('user_id', userId);

  if (!data?.length) {
    return undefined;
  }

  let effectiveRole: MembershipRole | undefined;
  const memberships = data as Array<Database['public']['Tables']['memberships']['Row']>;

  for (const membership of memberships) {
    const normalizedRole = normalizeMembershipRole(membership.role);

    if (normalizedRole === undefined) {
      continue;
    }

    if (effectiveRole === undefined || getRolePriority(normalizedRole) > getRolePriority(effectiveRole)) {
      effectiveRole = normalizedRole;
    }
  }

  return effectiveRole;
}

function normalizeMembershipRole(role: unknown): MembershipRole | undefined {
  const normalizedRole = Number(role);

  switch (normalizedRole) {
    case MembershipRole.Owner:
    case MembershipRole.Admin:
    case MembershipRole.Member:
    case MembershipRole.Viewer:
      return normalizedRole;
    default:
      return undefined;
  }
}

function getRolePriority(role: MembershipRole) {
  switch (role) {
    case MembershipRole.Owner:
      return 4;
    case MembershipRole.Admin:
      return 3;
    case MembershipRole.Member:
      return 2;
    case MembershipRole.Viewer:
      return 1;
    default:
      return 0;
  }
}
