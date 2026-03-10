'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

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
const INVITE_ERROR_PATH = '/auth/invite-error';

function SignUpMethodsContainer(props: {
  inviteCode?: string;
  next?: string;
}) {
  const router = useRouter();
  const inviteCode = props.inviteCode?.trim() || undefined;
  const [nextPath, setNextPath] = useState(() => getOptionalSafeNextPath(props.next));
  const redirectPath = getSafeNextPath(nextPath);

  const onSignUp = useCallback((destination?: string) => {
    const requireEmailConfirmation =
      configuration.auth.requireEmailConfirmation;

    // If the user is required to confirm their email, we show them a message
    if (requireEmailConfirmation) {
      return;
    }

    // When email confirmation is not required, continue directly.
    router.replace(getSafeNextPath(destination ?? nextPath));
  }, [nextPath, router]);

  const onPhoneSignUp = useCallback(() => {
    router.replace(redirectPath);
  }, [redirectPath, router]);

  const acceptInviteIfPresent = useCallback(
    async (userId?: string) => {
      if (!inviteCode) {
        return null;
      }

      return acceptInviteAction({
        code: inviteCode,
        userId,
        redirectOnSuccess: false,
      });
    },
    [inviteCode],
  );

  const onInviteAwareSignUp = useCallback(
    async (userId?: string) => {
      try {
        const result = await acceptInviteIfPresent(userId);

        if (result?.destination) {
          setNextPath(getOptionalSafeNextPath(result.destination));
        }

        onSignUp(result?.destination);
      } catch {
        router.replace(INVITE_ERROR_PATH);
      }
    },
    [acceptInviteIfPresent, onSignUp, router],
  );

  const onInviteAwarePhoneSignUp = useCallback(async () => {
    try {
      await acceptInviteIfPresent();
      onPhoneSignUp();
    } catch {
      router.replace(INVITE_ERROR_PATH);
    }
  }, [acceptInviteIfPresent, onPhoneSignUp, router]);

  return (
    <>
      <If condition={providers.emailPassword}>
        <EmailPasswordSignUpContainer
          onSignUp={onInviteAwareSignUp}
          inviteCode={inviteCode}
          nextPath={nextPath}
        />
      </If>

      <If
        condition={
          providers.emailPassword &&
          (providers.oAuth.length > 0 ||
            (providers.phoneNumber && !inviteCode) ||
            providers.emailLink ||
            providers.emailOtp)
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
        <If condition={providers.phoneNumber && !inviteCode}>
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
            returnUrl={redirectPath}
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

function getOptionalSafeNextPath(value?: string) {
  if (!value) {
    return undefined;
  }

  if (!value.startsWith('/') || value.startsWith('//')) {
    return undefined;
  }

  return value;
}
