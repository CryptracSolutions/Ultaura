import { NextRequest } from 'next/server';
import { redirect } from 'next/navigation';

import { acceptInviteToOrganization } from '~/lib/memberships/mutations';
import getLogger from '~/core/logger';
import configuration from '~/configuration';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import MembershipRole from '~/lib/organizations/types/membership-role';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const logger = getLogger();
  const searchParams = requestUrl.searchParams;

  const authCode = searchParams.get('code');
  const inviteCode = searchParams.get('inviteCode');
  const error = searchParams.get('error');
  const rawNextUrl = searchParams.get('next');

  let nextUrl = getSafeNextUrl(rawNextUrl);
  let userId: Maybe<string> = undefined;
  let userEmail: Maybe<string> = undefined;

  if (authCode) {
    const client = getSupabaseRouteHandlerClient();

    try {
      const { error: exchangeError, data } =
        await client.auth.exchangeCodeForSession(authCode);

      if (exchangeError) {
        return onError({ error: exchangeError.message });
      }

      userId = data.user.id;
      userEmail = data.user.email;
    } catch (exchangeError) {
      logger.error(
        {
          error: exchangeError,
        },
        `An error occurred while exchanging code for session`,
      );

      const message =
        exchangeError instanceof Error ? exchangeError.message : exchangeError;

      return onError({ error: message as string });
    }

    if (inviteCode && userId) {
      try {
        logger.info(
          {
            userId,
            inviteCode,
          },
          `Attempting to accept user invite...`,
        );

        const inviteResult = await acceptInviteFromEmailLink({
          inviteCode,
          userId,
          userEmail,
        });

        if (inviteResult?.role === MembershipRole.Viewer && !rawNextUrl) {
          nextUrl = configuration.paths.appHome;
        }
      } catch (acceptError) {
        logger.error(
          {
            userId,
            inviteCode,
            error: acceptError,
          },
          `An error occurred while accepting user invite`,
        );

        const message = acceptError instanceof Error ? acceptError.message : acceptError;

        return onError({ error: message as string });
      }
    }
  }

  if (error) {
    return onError({ error });
  }

  return redirect(nextUrl);
}

/**
 * @name acceptInviteFromEmailLink
 * @description If we find an invite code, we try to accept the invite
 * received from the email link method
 */
async function acceptInviteFromEmailLink(params: {
  inviteCode: string;
  userId: Maybe<string>;
  userEmail?: Maybe<string>;
}) {
  const logger = getLogger();

  if (!params.userId) {
    logger.error(params, `Attempted to accept invite, but no user id provided`);

    return null;
  }

  logger.info(params, `Found invite code. Accepting invite...`);

  const adminClient = getSupabaseRouteHandlerClient({
    admin: true,
  });

  const { data, error } = await acceptInviteToOrganization(adminClient, {
    code: params.inviteCode,
    userId: params.userId,
  });

  if (error) {
    throw error;
  }

  const membershipId = (data as { membership?: number } | null)?.membership;

  if (!membershipId) {
    return null;
  }

  const { data: membership } = await adminClient
    .from('memberships')
    .select('role')
    .eq('id', membershipId)
    .maybeSingle();

  const role = (membership?.role ?? MembershipRole.Member) as MembershipRole;

  if (role === MembershipRole.Viewer) {
    await applyViewerDisplayName({
      adminClient,
      userId: params.userId,
      userEmail: params.userEmail,
    });
  }

  logger.info(params, `Invite successfully accepted`);

  return { role };
}

async function applyViewerDisplayName(params: {
  adminClient: ReturnType<typeof getSupabaseRouteHandlerClient>;
  userId: string;
  userEmail?: Maybe<string>;
}) {
  const normalizedEmail = params.userEmail?.trim().toLowerCase();

  if (!normalizedEmail) {
    return;
  }

  const { data: userRecord } = await params.adminClient
    .from('users')
    .select('display_name')
    .eq('id', params.userId)
    .maybeSingle();

  if (userRecord?.display_name?.trim()) {
    return;
  }

  const { data: recipient } = await params.adminClient
    .from('ultaura_notification_recipients')
    .select('name')
    .eq('email', normalizedEmail)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const displayName = recipient?.name?.trim();

  if (!displayName) {
    return;
  }

  await params.adminClient
    .from('users')
    .update({ display_name: displayName })
    .eq('id', params.userId);
}

function onError({ error }: { error: string }) {
  const errorMessage = getAuthErrorMessage(error);

  getLogger().error(
    {
      error,
    },
    `An error occurred while signing user in`,
  );

  const redirectUrl = `/auth/callback/error?error=${errorMessage}`;

  return redirect(redirectUrl);
}

function getSafeNextUrl(value: string | null) {
  if (!value) {
    return configuration.paths.appHome;
  }

  if (!value.startsWith('/') || value.startsWith('//')) {
    return configuration.paths.appHome;
  }

  return value;
}

/**
 * Checks if the given error message indicates a verifier error.
 * We check for this specific error because it's highly likely that the
 * user is trying to sign in using a different browser than the one they
 * used to request the sign in link. This is a common mistake, so we
 * want to provide a helpful error message.
 */
function isVerifierError(error: string) {
  return error.includes('both auth code and code verifier should be non-empty');
}

function getAuthErrorMessage(error: string) {
  return isVerifierError(error)
    ? `auth:errors.codeVerifierMismatch`
    : `auth:authenticationErrorAlertBody`;
}
