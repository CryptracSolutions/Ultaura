'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import If from '~/core/ui/If';
import Trans from '~/core/ui/Trans';
import OAuthProviders from '~/app/auth/components/OAuthProviders';

import EmailPasswordSignInContainer from '~/app/auth/components/EmailPasswordSignInContainer';
import PhoneNumberSignInContainer from '~/app/auth/components/PhoneNumberSignInContainer';
import EmailLinkAuth from '~/app/auth/components/EmailLinkAuth';

import configuration from '~/configuration';
import EmailOtpContainer from '~/app/auth/components/EmailOtpContainer';

const providers = configuration.auth.providers;

function SignInMethodsContainer() {
  const router = useRouter();

  const onSignIn = useCallback(() => {
    router.replace(configuration.paths.appHome);
  }, [router]);

  return (
    <>
      <If condition={providers.emailPassword}>
        <EmailPasswordSignInContainer onSignIn={onSignIn} />
      </If>

      <If condition={providers.oAuth.length && providers.emailPassword}>
        <div className={'flex w-full items-center gap-3'}>
          <div className={'h-px flex-1 bg-border'} />
          <span className={'text-xs uppercase text-muted-foreground'}>
            <Trans i18nKey={'common:or'} />
          </span>
          <div className={'h-px flex-1 bg-border'} />
        </div>
      </If>

      <div className={'flex w-full flex-col space-y-2'}>
        <If condition={providers.phoneNumber}>
          <PhoneNumberSignInContainer onSuccess={onSignIn} mode={'signIn'} />
        </If>

        <If condition={providers.emailLink}>
          <EmailLinkAuth />
        </If>

        <If condition={providers.emailOtp}>
          <EmailOtpContainer shouldCreateUser={false} />
        </If>

        <If condition={providers.oAuth.length}>
          <OAuthProviders />
        </If>
      </div>
    </>
  );
}

export default SignInMethodsContainer;
