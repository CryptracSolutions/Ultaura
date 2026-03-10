import 'server-only';

import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

import configuration from '~/configuration';
import type { Database } from '~/database.types';
import getLogger from '~/core/logger';
import { createOrganizationIdCookie } from '~/lib/server/cookies/organization.cookie';
import MembershipRole from '~/lib/organizations/types/membership-role';
import { getOrganizationById } from '~/lib/organizations/database/queries';
import { acceptInviteToOrganization } from '~/lib/memberships/mutations';
import {
  getInviteMembershipForResolution,
  type InviteMembershipLookup,
} from '~/lib/memberships/queries';

type Client = SupabaseClient<Database>;

export type InviteResolutionStatus =
  | 'ready'
  | 'accepted'
  | 'consumed'
  | 'invalid'
  | 'wrong_account'
  | 'failed';

export type InviteResolutionResult = {
  status: InviteResolutionStatus;
  role?: MembershipRole;
  organizationId?: number;
  organizationUid?: string;
  invitedEmail?: string | null;
  membershipId?: number;
  destination: string;
  needsOnboarding: boolean;
  message?: string;
};

export type ResolveInviteParams = {
  client: Client;
  code: string;
  userId: string;
  userEmail?: string | null;
  consume?: boolean;
  activateOrganization?: boolean;
};

export function getInviteDestination(params: {
  role?: MembershipRole;
  onboarded: boolean;
}) {
  if (params.role === MembershipRole.Viewer) {
    return {
      destination: configuration.paths.appHome,
      needsOnboarding: false,
    };
  }

  if (!params.onboarded) {
    return {
      destination: configuration.paths.onboarding,
      needsOnboarding: true,
    };
  }

  return {
    destination: configuration.paths.appHome,
    needsOnboarding: false,
  };
}

export function isInviteEmailMatch(params: {
  invitedEmail?: string | null;
  userEmail?: string | null;
}) {
  const invitedEmail = normalizeEmail(params.invitedEmail);

  if (!invitedEmail) {
    return true;
  }

  const userEmail = normalizeEmail(params.userEmail);
  return Boolean(userEmail && invitedEmail === userEmail);
}

export async function resolveInvite(params: ResolveInviteParams): Promise<InviteResolutionResult> {
  const logger = getLogger();
  const consume = params.consume ?? true;
  const activateOrganization = params.activateOrganization ?? true;

  try {
    const { data: inviteMembership, error: lookupError } =
      await getInviteMembershipForResolution(params.client, params.code);

    if (lookupError) {
      logger.error(
        {
          code: params.code,
          userId: params.userId,
          error: lookupError,
        },
        'Failed invite lookup',
      );

      return toFailedResult('Failed to resolve invite');
    }

    if (!inviteMembership) {
      return toInvalidResult();
    }

    const inviteContext = await buildInviteContext({
      client: params.client,
      userId: params.userId,
      membership: inviteMembership,
    });

    const resolvedUserEmail =
      params.userEmail ?? (await getAuthEmailByUserId(params.client, params.userId));

    if (!isInviteEmailMatch({
      invitedEmail: inviteMembership.invitedEmail,
      userEmail: resolvedUserEmail,
    })) {
      return {
        ...inviteContext,
        status: 'wrong_account',
        message: 'Invite email does not match the authenticated account',
      };
    }

    if (inviteMembership.userId && inviteMembership.userId === params.userId) {
      if (activateOrganization) {
        setOrganizationCookie(params.userId, inviteContext.organizationUid);
      }

      return {
        ...inviteContext,
        status: 'accepted',
      };
    }

    if (inviteMembership.userId && inviteMembership.userId !== params.userId) {
      return {
        ...inviteContext,
        status: 'consumed',
      };
    }

    if (!consume) {
      return {
        ...inviteContext,
        status: 'ready',
      };
    }

    const { data: acceptData, error: acceptError } = await acceptInviteToOrganization(
      params.client,
      {
        code: params.code,
        userId: params.userId,
      },
    );

    if (acceptError) {
      if (isInviteNotFoundError(acceptError.message)) {
        return {
          ...inviteContext,
          status: 'consumed',
        };
      }

      logger.error(
        {
          code: params.code,
          userId: params.userId,
          error: acceptError,
        },
        'Failed invite acceptance',
      );

      return toFailedResult(`Failed to accept invite: ${acceptError.message}`);
    }

    const accepted = acceptData as { membership?: number; organization?: number } | null;
    const acceptedMembershipId = accepted?.membership;
    const acceptedOrganizationId = accepted?.organization ?? inviteContext.organizationId;
    const acceptedOrganizationUid =
      acceptedOrganizationId === inviteContext.organizationId
        ? inviteContext.organizationUid
        : await getOrganizationUidById(params.client, acceptedOrganizationId);

    if (
      inviteContext.role !== MembershipRole.Viewer &&
      inviteContext.needsOnboarding
    ) {
      await markOnboardingRequiredAfterAcceptance(params.client, params.userId);
    }

    if (activateOrganization) {
      setOrganizationCookie(params.userId, acceptedOrganizationUid);
    }

    return {
      ...inviteContext,
      status: 'accepted',
      membershipId: acceptedMembershipId ?? inviteContext.membershipId,
      organizationId: acceptedOrganizationId,
      organizationUid: acceptedOrganizationUid,
    };
  } catch (error) {
    logger.error(
      {
        code: params.code,
        userId: params.userId,
        error,
      },
      'Unexpected invite resolution error',
    );

    return toFailedResult(
      error instanceof Error ? error.message : 'Unexpected invite resolution error',
    );
  }
}

function toInvalidResult(): InviteResolutionResult {
  return {
    status: 'invalid',
    destination: configuration.paths.appHome,
    needsOnboarding: false,
    message: 'Invite not found',
  };
}

function toFailedResult(message: string): InviteResolutionResult {
  return {
    status: 'failed',
    destination: '/auth/invite-error',
    needsOnboarding: false,
    message,
  };
}

async function buildInviteContext(params: {
  client: Client;
  userId: string;
  membership: InviteMembershipLookup;
}): Promise<InviteResolutionResult> {
  const role = normalizeMembershipRole(params.membership.role);
  const onboarded = await isUserOnboarded(params.client, params.userId);
  const destination = getInviteDestination({ role, onboarded });

  const organizationId = params.membership.organizationId;
  const organizationUid =
    params.membership.organization?.uuid ?? (await getOrganizationUidById(params.client, organizationId));

  return {
    status: 'ready',
    role,
    organizationId,
    organizationUid,
    invitedEmail: params.membership.invitedEmail,
    membershipId: params.membership.id,
    destination: destination.destination,
    needsOnboarding: destination.needsOnboarding,
  };
}

async function isUserOnboarded(client: Client, userId: string) {
  const { data: userRecord, error } = await client
    .from('users')
    .select('onboarded')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    return false;
  }

  return Boolean(userRecord?.onboarded);
}

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() ?? '';
}

function normalizeMembershipRole(value: unknown) {
  const role = Number(value);

  if (
    role === MembershipRole.Viewer ||
    role === MembershipRole.Member ||
    role === MembershipRole.Admin ||
    role === MembershipRole.Owner
  ) {
    return role as MembershipRole;
  }

  return MembershipRole.Member;
}

function isInviteNotFoundError(message?: string) {
  if (!message) {
    return false;
  }

  return message.toLowerCase().includes('invite code not found');
}

async function getOrganizationUidById(client: Client, organizationId?: number) {
  if (!organizationId) {
    return undefined;
  }

  try {
    const { data } = await getOrganizationById(client, organizationId);
    return data?.uuid;
  } catch {
    return undefined;
  }
}

function setOrganizationCookie(userId: string, organizationUid?: string) {
  if (!organizationUid) {
    return;
  }

  cookies().set(
    createOrganizationIdCookie({
      userId,
      organizationUid,
    }),
  );
}

async function getAuthEmailByUserId(client: Client, userId: string) {
  const response = await client.auth.admin.getUserById(userId).catch(() => null);
  return response?.data?.user?.email ?? null;
}

async function markOnboardingRequiredAfterAcceptance(
  client: Client,
  userId: string,
) {
  await client
    .from('users')
    .update({ onboarded: false } as never)
    .eq('id', userId);
}
