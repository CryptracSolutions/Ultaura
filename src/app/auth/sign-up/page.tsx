import Link from 'next/link';
import { redirect } from 'next/navigation';

import Trans from '~/core/ui/Trans';
import Heading from '~/core/ui/Heading';
import SignUpMethodsContainer from '~/app/auth/components/SignUpMethodsContainer';

import configuration from '~/configuration';
import verifyRequiresMfa from '~/core/session/utils/check-requires-mfa';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import { withI18n } from '~/i18n/with-i18n';
import loadAuthPageData from '~/lib/server/loaders/load-auth-page-data';
import { getInviteDestination } from '~/lib/memberships/invite-resolution';
import { getPendingInviteMembershipForResolution } from '~/lib/memberships/queries';

const SIGN_IN_PATH = configuration.paths.signIn;

export const metadata = {
  title: 'Sign up',
};

async function SignUpPage(props: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const inviteCode = getFirstQueryValue(props.searchParams?.inviteCode);
  const emailConfirmation = getFirstQueryValue(
    props.searchParams?.emailConfirmation,
  );
  let next = getFirstQueryValue(props.searchParams?.next);

  if (inviteCode) {
    const client = getSupabaseServerComponentClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (user && emailConfirmation !== 'pending') {
      const requiresMultiFactorAuthentication = await verifyRequiresMfa(client);

      if (requiresMultiFactorAuthentication) {
        return redirect(configuration.paths.signInMfa);
      }

      return redirect(`/invite/${encodeURIComponent(inviteCode)}`);
    }

    const adminClient = getSupabaseServerComponentClient({ admin: true });
    const { data: inviteMembership } = await getPendingInviteMembershipForResolution(
      adminClient,
      inviteCode,
    );

    if (!inviteMembership) {
      return redirect(configuration.paths.signIn);
    }

    next = getInviteDestination({
      role: inviteMembership.role,
      onboarded: false,
    }).destination;
  } else {
    await loadAuthPageData({
      redirectSignedIn: true,
    });
  }

  return (
    <>
      <div>
        <Heading type={5}>
          <Trans i18nKey={'auth:signUpHeading'} />
        </Heading>
      </div>

      <SignUpMethodsContainer inviteCode={inviteCode} next={next} />

      <p
        className={'text-center text-xs text-muted-foreground leading-relaxed'}
      >
        <Trans
          i18nKey={'auth:tosAgreement'}
          components={{
            termsLink: (
              <Link
                href={'/terms'}
                className={'text-primary-800 hover:underline dark:text-primary'}
              />
            ),
            privacyLink: (
              <Link
                href={'/privacy'}
                className={'text-primary-800 hover:underline dark:text-primary'}
              />
            ),
          }}
        />
      </p>

      <div className={'flex justify-center text-xs'}>
        <p className={'flex space-x-1'}>
          <span>
            <Trans i18nKey={'auth:alreadyHaveAnAccount'} />
          </span>

          <Link
            className={
              'text-primary hover:text-primary/70 hover:underline transition-colors'
            }
            href={SIGN_IN_PATH}
          >
            <Trans i18nKey={'auth:signIn'} />
          </Link>
        </p>
      </div>
    </>
  );
}

export default withI18n(SignUpPage);

function getFirstQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
