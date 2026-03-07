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
import { acceptInviteAction } from '~/lib/memberships/actions';

const providers = configuration.auth.providers;

function SignUpMethodsContainer(props: {
  inviteCode?: string;
  next?: string;
}) {
  const router = useRouter();
  const inviteCode = props.inviteCode?.trim() || undefined;
  const nextPath = getSafeNextPath(props.next);

  const onSignUp = useCallback(() => {
    const requireEmailConfirmation =
      configuration.auth.requireEmailConfirmation;

    // If the user is required to confirm their email, we show them a message
    if (requireEmailConfirmation) {
      return;
    }

    // Otherwise, we redirect them to the onboarding page
    router.replace(nextPath);
  }, [nextPath, router]);

  // Phone sign-ups verify identity via OTP — email confirmation doesn't apply.
  // Always redirect to onboarding after successful phone OTP verification.
  const onPhoneSignUp = useCallback(() => {
    router.replace(nextPath);
  }, [nextPath, router]);

  const acceptInviteIfPresent = useCallback(
    async (userId?: string) => {
      if (!inviteCode) {
        return;
      }

      await acceptInviteAction({
        code: inviteCode,
        userId,
      }).catch(() => undefined);
    },
    [inviteCode],
  );

  const onInviteAwareSignUp = useCallback(
    async (userId?: string) => {
      await acceptInviteIfPresent(userId);
      onSignUp();
    },
    [acceptInviteIfPresent, onSignUp],
  );

  const onInviteAwarePhoneSignUp = useCallback(async () => {
    await acceptInviteIfPresent();
    onPhoneSignUp();
  }, [acceptInviteIfPresent, onPhoneSignUp]);

  return (
    <>
      <If condition={providers.emailPassword}>
        <EmailPasswordSignUpContainer onSignUp={onInviteAwareSignUp} />
      </If>

      <If
        condition={
          providers.emailPassword &&
          (providers.oAuth.length > 0 || providers.phoneNumber)
        }
      >
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
          <PhoneNumberSignInContainer
            onSuccess={onInviteAwarePhoneSignUp}
            mode={'signUp'}
          />
        </If>

        <If condition={providers.emailLink}>
          <EmailLinkAuth inviteCode={inviteCode} />
        </If>

        <If condition={providers.emailOtp}>
          <EmailOtpContainer inviteCode={inviteCode} shouldCreateUser={true} />
        </If>

        <If condition={providers.oAuth.length}>
          <OAuthProviders
          inviteCode={inviteCode}
          returnUrl={nextPath}
          mode={'signUp'}
        />
        </If>
      </div>
    </>
  );
}

export default SignUpMethodsContainer;

function getSafeNextPath(value?: string) {
  if (!value) {
    return configuration.paths.appHome;
  }

  if (!value.startsWith('/') || value.startsWith('//')) {
    return configuration.paths.appHome;
  }

  return value;
}
