import 'server-only';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  isRedirectError,
  getURLFromRedirectError,
} from 'next/dist/client/components/redirect';

import getCurrentOrganization from '~/lib/server/organizations/get-current-organization';
import { getOrganizationsByUserId } from '~/lib/organizations/database/queries';

import getUIStateCookies from '~/lib/server/loaders/utils/get-ui-state-cookies';
import { getUserDataById } from '../queries';

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import requireSession from '~/lib/user/require-session';
import getLogger from '~/core/logger';

import configuration from '~/configuration';
import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';
import {
  hasManualOrganizationSelectionCookie,
  parseOrganizationIdCookie,
} from '~/lib/server/cookies/organization.cookie';
import MembershipRole from '~/lib/organizations/types/membership-role';

/**
 * @name loadAppData
 * @description This function is responsible for loading the application data
 * from the server-side, used in the (app) layout. The data is cached for
 * the request lifetime, which allows you to call the same across layouts.
 */
const loadAppData = async (organizationUid: string) => {
  const logger = getLogger();

  try {
    const client = getSupabaseServerComponentClient();
    const session = await requireSession(client);

    const user = session.user;
    const userId = user.id;

    // we fetch the user record from the Database
    // which is a separate object from the auth metadata
    const [userRecord, organizationData] = await Promise.all([
      getUserDataById(client, userId),
      getCurrentOrganization({ organizationUid, userId }),
    ]);

    const isOnboarded = Boolean(userRecord?.onboarded);

    if (!userRecord) {
      logger.info(
        {
          name: 'loadAppData',
          userId,
        },
        `User record not found in the database. Redirecting to onboarding...`,
      );

      return redirectToOnboarding();
    }

    if (!isOnboarded) {
      logger.info(
        {
          name: 'loadAppData',
        },
        `User is not yet onboarded. Redirecting to onboarding...`,
      );

      return redirectToOnboarding();
    }

    if (!organizationData) {
      logger.info(
        {
          name: 'loadAppData',
          userId,
        },
        `User is not a member of any organization. Redirecting to home page...`,
      );

      return redirectToHomePage();
    }

    const csrfToken = getCsrfToken();

    // we initialize the i18n server-side
    const { language } = await initializeServerI18n(getLanguageCookie());

    return {
      language,
      csrfToken,
      auth: {
        accessToken: session.access_token,
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
        },
      },
      user: userRecord,
      organization: organizationData?.organization,
      role: organizationData?.role,
      ui: getUIStateCookies(),
    };
  } catch (error) {
    // if the error is a redirect error, we simply redirect the user
    // to the destination URL extracted from the error
    if (isRedirectError(error)) {
      const url = getURLFromRedirectError(error);

      return redirect(url);
    }

    logger.warn(
      {
        name: 'loadAppData',
        error: JSON.stringify(error),
      },
      `Could not load application data`,
    );

    // in case of any error, we redirect the user to the home page
    // to avoid any potential infinite loop
    return redirectToHomePage();
  }
};

/**
 * @name loadAppDataForUser
 * @description Loads application data by getting the organization from the
 * authenticated user instead of from URL parameters. Used when organizations
 * are not included in the URL structure (1:1 user:organization mapping).
 */
export const loadAppDataForUser = async () => {
  const logger = getLogger();

  try {
    const client = getSupabaseServerComponentClient();
    const session = await requireSession(client);

    const user = session.user;
    const userId = user.id;

    // Get user record from database
    const userRecord = await getUserDataById(client, userId);

    const isOnboarded = Boolean(userRecord?.onboarded);

    if (!userRecord) {
      logger.info(
        {
          name: 'loadAppDataForUser',
          userId,
        },
        `User record not found in the database. Redirecting to onboarding...`,
      );

      return redirectToOnboarding();
    }

    if (!isOnboarded) {
      logger.info(
        {
          name: 'loadAppDataForUser',
        },
        `User is not yet onboarded. Redirecting to onboarding...`,
      );

      return redirectToOnboarding();
    }

    await autoLinkPendingViewerMemberships({
      userId,
      userEmail: user.email,
      emailVerifiedAt: user.email_confirmed_at,
    });

    const { data: organizationsData, error: orgsError } =
      await getOrganizationsByUserId(client, userId);

    if (orgsError || !organizationsData || organizationsData.length === 0) {
      logger.info(
        {
          name: 'loadAppDataForUser',
          userId,
        },
        `User is not a member of any organization. Redirecting...`,
      );

      return redirect('/dashboard/access-removed');
    }

    const sortedOrganizations = sortOrganizationsForSelection(organizationsData);

    const organizationCookie = await parseOrganizationIdCookie(userId);
    const hasManualSelection = await hasManualOrganizationSelectionCookie(userId);
    const selectedMembership = selectOrganizationMembership({
      organizations: sortedOrganizations,
      organizationCookie,
      hasManualSelection,
    });
    if (!selectedMembership) {
      return redirectToOnboarding();
    }

    const organization = selectedMembership.organization;
    const role = selectedMembership.role;

    if (!organization) {
      logger.info(
        {
          name: 'loadAppDataForUser',
          userId,
        },
        `Organization not found. Redirecting to onboarding...`,
      );

      return redirectToOnboarding();
    }

    const csrfToken = getCsrfToken();

    // Initialize i18n server-side
    const { language } = await initializeServerI18n(getLanguageCookie());

    return {
      language,
      csrfToken,
      auth: {
        accessToken: session.access_token,
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
        },
      },
      user: userRecord,
      organization,
      role,
      allOrganizations: sortedOrganizations.map((item) => ({
        organization: item.organization,
        role: item.role,
      })),
      ui: getUIStateCookies(),
    };
  } catch (error) {
    if (isRedirectError(error)) {
      const url = getURLFromRedirectError(error);
      return redirect(url);
    }

    logger.warn(
      {
        name: 'loadAppDataForUser',
        error: JSON.stringify(error),
      },
      `Could not load application data`,
    );

    return redirectToHomePage();
  }
};

export function sortOrganizationsForSelection<T extends { role: number; organization?: { name?: string | null; uuid?: string | null } | null }>(
  organizations: T[],
): T[] {
  return [...organizations].sort((a, b) => {
    const roleDiff = getRolePriority(b.role) - getRolePriority(a.role);
    if (roleDiff !== 0) {
      return roleDiff;
    }

    const nameA = a.organization?.name ?? '';
    const nameB = b.organization?.name ?? '';
    const nameDiff = nameA.localeCompare(nameB);
    if (nameDiff !== 0) {
      return nameDiff;
    }

    const uuidA = a.organization?.uuid ?? '';
    const uuidB = b.organization?.uuid ?? '';
    return uuidA.localeCompare(uuidB);
  });
}

export function selectOrganizationMembership<T extends { role: number; organization?: { uuid?: string | null } | null }>(params: {
  organizations: T[];
  organizationCookie?: string;
  hasManualSelection: boolean;
}): T | undefined {
  const cookieSelection = params.organizationCookie
    ? params.organizations.find((item) => item.organization?.uuid === params.organizationCookie)
    : undefined;

  const defaultSelection = params.organizations.find(
    (item) => item.role !== MembershipRole.Viewer,
  ) ?? params.organizations[0];

  const shouldPreferDefaultOverViewerCookie =
    !params.hasManualSelection &&
    cookieSelection?.role === MembershipRole.Viewer &&
    defaultSelection?.role !== MembershipRole.Viewer;

  return shouldPreferDefaultOverViewerCookie
    ? defaultSelection
    : (cookieSelection ?? defaultSelection);
}

function redirectToOnboarding() {
  return redirect(configuration.paths.onboarding);
}

function redirectToHomePage() {
  return redirect('/');
}

function getCsrfToken() {
  return headers().get('X-CSRF-Token');
}

export default loadAppData;

function getRolePriority(role: MembershipRole) {
  switch (role) {
    case MembershipRole.Owner:
      return 4;
    case MembershipRole.Admin:
      return 3;
    case MembershipRole.Member:
      return 2;
    case MembershipRole.Viewer:
    default:
      return 1;
  }
}

export async function autoLinkPendingViewerMemberships(params: {
  userId: string;
  userEmail?: string | null;
  emailVerifiedAt?: string | null;
}) {
  const logger = getLogger();
  const normalizedEmail = params.userEmail?.trim().toLowerCase();

  if (!normalizedEmail || !params.emailVerifiedAt) {
    return;
  }

  const adminClient = getSupabaseServerComponentClient({ admin: true });
  const { data: pendingMemberships, error: lookupError } = await adminClient
    .from('memberships')
    .select('id, organization_id')
    .eq('invited_email', normalizedEmail)
    .eq('role', MembershipRole.Viewer)
    .not('code', 'is', null);

  if (lookupError || !pendingMemberships?.length) {
    return;
  }

  const { data: recipients, error: recipientsError } = await adminClient
    .from('ultaura_notification_recipients')
    .select('account_id')
    .eq('email', normalizedEmail)
    .not('confirmed_at', 'is', null)
    .not('dashboard_access_granted_at', 'is', null);

  if (recipientsError || !recipients?.length) {
    return;
  }

  const recipientAccountIds = Array.from(
    new Set(recipients.map((recipient) => recipient.account_id).filter(Boolean)),
  );

  if (!recipientAccountIds.length) {
    return;
  }

  const { data: recipientAccounts, error: accountsError } = await adminClient
    .from('ultaura_accounts')
    .select('id, organization_id')
    .in('id', recipientAccountIds);

  if (accountsError || !recipientAccounts?.length) {
    return;
  }

  const organizationsWithGrantedAccess = new Set(
    recipientAccounts.map((account) => account.organization_id),
  );

  for (const membership of pendingMemberships) {
    if (!organizationsWithGrantedAccess.has(membership.organization_id)) {
      continue;
    }

    const { error: updateError } = await adminClient
      .from('memberships')
      .update({
        user_id: params.userId,
        invited_email: null,
        code: null,
      })
      .eq('id', membership.id);

    if (!updateError) {
      continue;
    }

    // Already linked in a concurrent flow; clean up stale pending invite.
    if (updateError.code === '23505') {
      await adminClient
        .from('memberships')
        .delete()
        .eq('id', membership.id)
        .not('code', 'is', null);
      continue;
    }

    logger.warn(
      {
        name: 'autoLinkPendingViewerMemberships',
        userId: params.userId,
        membershipId: membership.id,
        organizationId: membership.organization_id,
        error: updateError,
      },
      'Failed to auto-link pending viewer membership',
    );
  }
}
