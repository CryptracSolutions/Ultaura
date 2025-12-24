import 'server-only';

import { cache } from 'react';
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

/**
 * @name loadAppData
 * @description This function is responsible for loading the application data
 * from the server-side, used in the (app) layout. The data is cached for
 * the request lifetime, which allows you to call the same across layouts.
 */
const loadAppData = cache(async (organizationUid: string) => {
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
        `User is not a member of any organization. Redirecting to home...`,
      );

      return redirect(configuration.paths.appHome);
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
});

/**
 * @name loadAppDataForUser
 * @description Loads application data by getting the organization from the
 * authenticated user instead of from URL parameters. Used when organizations
 * are not included in the URL structure (1:1 user:organization mapping).
 */
export const loadAppDataForUser = cache(async () => {
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

    // Get user's organizations (should be exactly one in 1:1 mapping)
    const { data: organizationsData, error: orgsError } =
      await getOrganizationsByUserId(client, userId);

    if (orgsError || !organizationsData || organizationsData.length === 0) {
      logger.info(
        {
          name: 'loadAppDataForUser',
          userId,
        },
        `User is not a member of any organization. Redirecting to home...`,
      );

      return redirect(configuration.paths.appHome);
    }

    // Use the first (and should be only) organization
    const { organization, role } = organizationsData[0];

    if (!organization) {
      logger.info(
        {
          name: 'loadAppDataForUser',
          userId,
        },
        `Organization not found. Redirecting to home...`,
      );

      return redirect(configuration.paths.appHome);
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
});

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
