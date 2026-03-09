import Link from 'next/link';

import Trans from '~/core/ui/Trans';
import Heading from '~/core/ui/Heading';
import SignUpMethodsContainer from '~/app/auth/components/SignUpMethodsContainer';

import configuration from '~/configuration';
import { withI18n } from '~/i18n/with-i18n';
import loadAuthPageData from '~/lib/server/loaders/load-auth-page-data';

const SIGN_IN_PATH = configuration.paths.signIn;

export const metadata = {
  title: 'Sign up',
};

async function SignUpPage(props: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await loadAuthPageData({
    redirectSignedIn: true,
  });

  const inviteCode = getFirstQueryValue(props.searchParams?.inviteCode);
  const next = getFirstQueryValue(props.searchParams?.next);

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
