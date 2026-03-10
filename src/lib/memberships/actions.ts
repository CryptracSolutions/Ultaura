'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

import MembershipRole from '~/lib/organizations/types/membership-role';

import {
  deleteMembershipById,
  updateMembershipById,
} from '~/lib/memberships/mutations';
import { resolveInvite } from '~/lib/memberships/invite-resolution';

import getLogger from '~/core/logger';
import { withSession } from '~/core/generic/actions-utils';
import getSupabaseServerActionClient from '~/core/supabase/action-client';

import configuration from '~/configuration';
import { Database } from '~/database.types';

export const updateMemberAction = withSession(
  async (params: { membershipId: number; role: MembershipRole }) => {
    const client = getSupabaseServerActionClient();

    await handleUpdateMemberRequest(client, params);

    // we revalidate the cache for the members page
    revalidateMembersPage();

    return {
      success: true,
    };
  },
);

export const deleteMemberAction = withSession(
  async (params: { membershipId: number }) => {
    const client = getSupabaseServerActionClient();

    await handleRemoveMemberRequest(client, params.membershipId);

    // we revalidate the cache for the members page
    revalidateMembersPage();

    return {
      success: true,
    };
  },
);

export const acceptInviteAction = async (params: {
  code: string;
  userId?: string;
  userEmail?: string;
  redirectOnSuccess?: boolean;
}) => {
  const code = params.code;

  const logger = getLogger();
  const client = getSupabaseServerActionClient();

  // if the user ID is provided, we use it
  // (for example, when signing up for the 1st time)
  let userId = params.userId;
  const shouldRedirectOnSuccess = params.redirectOnSuccess ?? true;

  let userEmail = params.userEmail;
  const { data } = await client.auth.getUser();

  if (data.user) {
    userEmail = data.user.email ?? userEmail;

    if (!userId) {
      userId = data.user.id;
    }
  }

  // if the user ID is still not available, we throw an error
  if (!userId) {
    throw new Error(`Session not available`);
  }

  if (params.userId && params.userId !== userId) {
    throw new Error(`User ID mismatch`);
  }

  logger.info(
    {
      code,
      userId,
    },
    `Adding member to organization...`,
  );

  const adminClient = getSupabaseServerActionClient({
    admin: true,
  });

  const inviteResolution = await resolveInvite({
    client: adminClient,
    code,
    userId,
    userEmail,
  });

  if (
    inviteResolution.status === 'invalid' ||
    inviteResolution.status === 'consumed' ||
    inviteResolution.status === 'wrong_account' ||
    inviteResolution.status === 'failed'
  ) {
    throw new Error(
      inviteResolution.message ?? `Invite could not be accepted (${inviteResolution.status})`,
    );
  }

  const organizationId = inviteResolution.organizationId;
  const membershipId = inviteResolution.membershipId;

  logger.info(
    {
      membershipId,
      organizationId,
      userId,
      status: inviteResolution.status,
    },
    `Member successfully added to organization`,
  );

  // When signup passes an explicit userId, keep invite completion behind
  // the confirmation gate even if Supabase creates a same-user session.
  const needsEmailVerification =
    configuration.auth.requireEmailConfirmation && Boolean(params.userId);

  // if the user is *not* required to confirm their email
  // we redirect them to the app home
  if (!needsEmailVerification && shouldRedirectOnSuccess) {
    logger.info(
      {
        membershipId,
      },
      `Redirecting user after invite acceptance...`,
    );

    redirect(inviteResolution.destination);
  }

  logger.info(
    {
      membershipId,
    },
    `User needs to verify their email address - returning JSON response...`,
  );

  return {
    success: true,
    needsEmailVerification,
    destination: inviteResolution.destination,
  };
};

async function handleRemoveMemberRequest(
  client: SupabaseClient<Database>,
  membershipId: number,
) {
  const logger = getLogger();

  logger.info(
    {
      membershipId,
    },
    `Removing member...`,
  );

  const { error } = await deleteMembershipById(client, membershipId);

  if (error) {
    logger.error(
      {
        membershipId,
        error,
      },
      `Error removing member`,
    );

    throw new Error(`Error removing member`);
  }

  logger.info(
    {
      membershipId,
    },
    `Member successfully removed.`,
  );
}

async function handleUpdateMemberRequest(
  client: SupabaseClient<Database>,
  params: {
    membershipId: number;
    role: MembershipRole;
  },
) {
  const logger = getLogger();
  const { role, membershipId } = getUpdateMembershipBodySchema().parse(params);

  logger.info(
    {
      membershipId,
      role,
    },
    `Updating member...`,
  );

  const canUpdateUserRoleResponse = await client.rpc('can_update_user_role', {
    membership_id: membershipId,
  });

  if (canUpdateUserRoleResponse.error || !canUpdateUserRoleResponse.data) {
    logger.error(
      {
        membershipId,
        error: canUpdateUserRoleResponse.error,
      },
      `Error checking if user can update role`,
    );

    throw new Error(`Error checking if user can update role`);
  }

  // we use the Admin client to update the membership
  // as we have no RLS policies on the memberships table to update the role
  const adminClient = getSupabaseServerActionClient({ admin: true });

  const { error } = await updateMembershipById(adminClient, {
    id: membershipId,
    role,
  });

  if (error) {
    logger.error(
      {
        membershipId,
        error,
      },
      `Error updating member`,
    );

    throw new Error(`Error updating member`);
  }

  logger.info(
    {
      membershipId,
    },
    `Member successfully updated.`,
  );
}

function getUpdateMembershipBodySchema() {
  return z.object({
    role: z.nativeEnum(MembershipRole),
    membershipId: z.number(),
  });
}

function revalidateMembersPage() {
  return revalidatePath('/settings/organization/members');
}
