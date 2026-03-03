'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import If from '~/core/ui/If';
import Trans from '~/core/ui/Trans';

import EmailPasswordSignUpContainer from '~/app/auth/components/EmailPasswordSignUpContainer';
import PhoneNumberSignInContainer from '~/app/auth/components/PhoneNumberSignInContainer';
import EmailLinkAuth from '~/app/auth/components/EmailLinkAuth';
import OAuthProviders from '~/app/auth/components/OAuthProviders';

import configuration from '~/configuration';
import EmailOtpContainer from '~/app/auth/components/EmailOtpContainer';

const providers = configuration.auth.providers;

function SignUpMethodsContainer() {
  const router = useRouter();

  const onSignUp = useCallback(() => {
    const requireEmailConfirmation =
      configuration.auth.requireEmailConfirmation;

    // If the user is required to confirm their email, we show them a message
    if (requireEmailConfirmation) {
      return;
    }

    // Otherwise, we redirect them to the onboarding page
    router.replace(configuration.paths.onboarding);
  }, [router]);

  // Phone sign-ups verify identity via OTP — email confirmation doesn't apply.
  // Always redirect to onboarding after successful phone OTP verification.
  const onPhoneSignUp = useCallback(() => {
    router.replace(configuration.paths.onboarding);
  }, [router]);

  return (
    <>
      <If condition={providers.emailPassword}>
        <EmailPasswordSignUpContainer onSignUp={onSignUp} />
      </If>

      <If condition={providers.phoneNumber && providers.emailPassword}>
        <div className={'flex w-full items-center gap-3'}>
          <div className={'h-px flex-1 bg-border'} />
          <span className={'text-xs uppercase text-muted-foreground'}>
            <Trans i18nKey={'common:or'} />
          </span>
          <div className={'h-px flex-1 bg-border'} />
        </div>
      </If>

      <If condition={providers.phoneNumber}>
        <PhoneNumberSignInContainer onSuccess={onPhoneSignUp} mode={'signUp'} />
      </If>

      <If condition={providers.emailLink}>
        <EmailLinkAuth />
      </If>

      <If condition={providers.emailOtp}>
        <EmailOtpContainer shouldCreateUser={true} />
      </If>

      <If condition={providers.oAuth.length}>
        <If condition={providers.emailPassword || providers.phoneNumber}>
          <div className={'flex w-full items-center gap-3'}>
            <div className={'h-px flex-1 bg-border'} />
            <span className={'text-xs uppercase text-muted-foreground'}>
              <Trans i18nKey={'common:or'} />
            </span>
            <div className={'h-px flex-1 bg-border'} />
          </div>
        </If>

        <OAuthProviders />
      </If>
    </>
  );
}

export default SignUpMethodsContainer;
