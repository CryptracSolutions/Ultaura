import 'server-only';

import { getOrganizationByUid } from '~/lib/organizations/database/queries';
import { getUserMembershipByOrganization } from '~/lib/memberships/queries';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';

export default async function getCurrentOrganization(params: {
  organizationUid: string;
  userId: string;
}) {
  const { userId, organizationUid } = params;
  const { data, error } = await fetchOrganization(organizationUid);

  if (error) {
    throw error;
  }

  const organization = data || undefined;
  const role = await fetchUserRole(organizationUid, userId);

  return {
    organization,
    role,
  };
}
/**
 * @name fetchOrganization
 * @description Fetch an organization by its ID.
 */
const fetchOrganization = async (uid: string) => {
  const client = getSupabaseServerComponentClient();

  return getOrganizationByUid(client, uid);
};

/**
 * @name fetchUserRole
 * @description Fetch the role of a user in an organization.
 */
const fetchUserRole = async (organizationUid: string, userId: string) => {
  const client = getSupabaseServerComponentClient();

  const data = await getUserMembershipByOrganization(client, {
    organizationUid,
    userId,
  });

  return data?.role;
};
