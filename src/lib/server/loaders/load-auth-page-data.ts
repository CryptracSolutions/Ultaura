import 'server-only';

import { redirect } from 'next/navigation';
import configuration from '~/configuration';

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';
import verifyRequiresMfa from '~/core/session/utils/check-requires-mfa';
import { getUserDataById } from '~/lib/server/queries';

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

  redirect(
    shouldContinueOnboarding
      ? configuration.paths.onboarding
      : configuration.paths.appHome,
  );
}
