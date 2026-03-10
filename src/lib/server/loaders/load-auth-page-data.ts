import 'server-only';

import { redirect } from 'next/navigation';
import configuration from '~/configuration';

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';
import verifyRequiresMfa from '~/core/session/utils/check-requires-mfa';
import { getUserDataById } from '~/lib/server/queries';
import { getOrganizationsByUserId } from '~/lib/organizations/database/queries';
import MembershipRole from '~/lib/organizations/types/membership-role';
import { autoLinkPendingViewerMemberships } from '~/lib/server/loaders/load-app-data';

interface LoadAuthPageDataOptions {
  redirectSignedIn?: boolean;
}

/**
 * @name loadAuthPageData
 * @description This function is responsible for loading the authentication
 * layout's data.
 * Optionally, callers can ask this loader to redirect signed-in users away
 * from entry pages (sign-in/sign-up) to either onboarding or app home.
 */
const loadAuthPageData = async ({
  redirectSignedIn = false,
}: LoadAuthPageDataOptions = {}) => {
  const { language } = await initializeServerI18n(getLanguageCookie());

  if (redirectSignedIn) {
    await redirectSignedInUser();
  }

  return {
    language,
  };
};

export default loadAuthPageData;

async function redirectSignedInUser() {
  const client = getSupabaseServerComponentClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return;
  }

  // Keep unconfirmed users on auth entry pages until they verify email.
  if (!user.email_confirmed_at) {
    return;
  }

  const requiresMultiFactorAuthentication = await verifyRequiresMfa(client);

  if (requiresMultiFactorAuthentication) {
    redirect(configuration.paths.signInMfa);
  }

  const userRecord = await getUserDataById(client, user.id).catch(() => null);
  const shouldContinueOnboarding = !userRecord || !userRecord.onboarded;

  if (shouldContinueOnboarding) {
    await autoLinkPendingViewerMemberships({
      userId: user.id,
      userEmail: user.email,
      emailVerifiedAt: user.email_confirmed_at,
    });

    const organizations = await getOrganizationsByUserId(client, user.id).then(
      ({ data }) => data ?? [],
      () => [],
    );
    const hasViewerOnlyAccess =
      organizations.length > 0 &&
      organizations.every(
        (organization: { role: number }) =>
          Number(organization.role) === Number(MembershipRole.Viewer),
      );

    redirect(
      hasViewerOnlyAccess
        ? configuration.paths.appHome
        : configuration.paths.onboarding,
    );
  }

  redirect(configuration.paths.appHome);
}
