'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import AuthErrorMessage from './AuthErrorMessage';
import useSignUpWithEmailAndPasswordMutation from '~/core/hooks/use-sign-up-with-email-password';
import If from '~/core/ui/If';

import EmailPasswordSignUpForm from '~/app/auth/components/EmailPasswordSignUpForm';
import EmailConfirmationWaiting from '~/app/auth/components/EmailConfirmationWaiting';

import configuration from '~/configuration';
import useResendSignupConfirmation from '~/core/hooks/use-resend-signup-confirmation';

const requireEmailConfirmation = configuration.auth.requireEmailConfirmation;
const RESEND_COOLDOWN_SECONDS = 60;
const EMAIL_CONFIRMATION_STATE_KEY = 'ultaura.email-confirmation.pending';

const EmailPasswordSignUpContainer: React.FCC<{
  onSignUp: (userId?: string) => unknown;
  onError?: (error?: unknown) => unknown;
  inviteCode?: string;
  nextPath?: string;
}> = ({ onSignUp, onError, inviteCode, nextPath }) => {
  const router = useRouter();
  const signUpMutation = useSignUpWithEmailAndPasswordMutation();
  const resendConfirmationMutation = useResendSignupConfirmation();
  const redirecting = useRef(false);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const loading = signUpMutation.isMutating || redirecting.current;
  const [showVerifyEmailAlert, setShowVerifyEmailAlert] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<Error | null>(null);

  const callOnErrorCallback = useCallback(() => {
    if (signUpMutation.error && onError) {
      onError(signUpMutation.error);
    }
  }, [signUpMutation.error, onError]);

  useEffect(() => {
    callOnErrorCallback();
  }, [callOnErrorCallback]);

  useEffect(() => {
    if (showVerifyEmailAlert || typeof window === 'undefined') {
      return;
    }

    const pending = readPendingEmailConfirmationState();

    if (
      !pending ||
      pending.inviteCode !== (inviteCode ?? null) ||
      pending.nextPath !== (nextPath ?? null)
    ) {
      return;
    }

    setSignupEmail(pending.email);
    setShowVerifyEmailAlert(true);
    setResendSuccess(false);
    setResendError(null);
  }, [inviteCode, nextPath, showVerifyEmailAlert]);

  const stopCooldown = useCallback(() => {
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
      cooldownIntervalRef.current = null;
    }
  }, []);

  const startCooldown = useCallback(() => {
    stopCooldown();
    setResendCooldown(RESEND_COOLDOWN_SECONDS);

    cooldownIntervalRef.current = setInterval(() => {
      setResendCooldown((current) => {
        if (current <= 1) {
          stopCooldown();
          return 0;
        }

        return current - 1;
      });
    }, 1000);
  }, [stopCooldown]);

  useEffect(() => {
    return () => {
      stopCooldown();
    };
  }, [stopCooldown]);

  const onSignupRequested = useCallback(
    async (params: { email: string; password: string }) => {
      if (loading) {
        return;
      }

      try {
        if (requireEmailConfirmation) {
          persistPendingEmailConfirmationState({
            email: params.email,
            inviteCode,
            nextPath,
          });
        }

        const data = await signUpMutation.trigger({
          ...params,
          inviteCode,
          next: nextPath,
        });

        // If the user is required to confirm their email, we display a message
        if (requireEmailConfirmation) {
          setSignupEmail(params.email);
          setShowVerifyEmailAlert(true);
          setResendSuccess(false);
          setResendError(null);
          startCooldown();
        }

        await onSignUp(data.user?.id);

        if (requireEmailConfirmation) {
          router.replace(
            getPendingConfirmationPath({
              email: params.email,
              inviteCode,
              nextPath,
            }),
          );
        }
      } catch (error) {
        clearPendingEmailConfirmationState();

        if (onError) {
          onError(error);
        }
      }
    },
    [inviteCode, loading, nextPath, onError, onSignUp, router, signUpMutation, startCooldown],
  );

  const onResendConfirmation = useCallback(async () => {
    if (
      !signupEmail ||
      resendCooldown > 0 ||
      resendConfirmationMutation.isMutating
    ) {
      return;
    }

    setResendSuccess(false);
    setResendError(null);

    try {
      await resendConfirmationMutation.trigger({
        email: signupEmail,
      });

      setResendSuccess(true);
      startCooldown();
    } catch (error) {
      setResendError(error as Error);
    }
  }, [
    resendConfirmationMutation,
    resendCooldown,
    signupEmail,
    startCooldown,
  ]);

  return (
    <>
      <If condition={showVerifyEmailAlert}>
        <EmailConfirmationWaiting
          email={signupEmail}
          inviteCode={inviteCode}
          nextPath={nextPath}
          resendCooldown={resendCooldown}
          resendSuccess={resendSuccess}
          resendError={resendError}
          isResending={resendConfirmationMutation.isMutating}
          onResend={onResendConfirmation}
        />
      </If>

      <If condition={!showVerifyEmailAlert}>
        <AuthErrorMessage error={signUpMutation.error} />

        <EmailPasswordSignUpForm
          onSubmit={onSignupRequested}
          loading={loading}
        />
      </If>
    </>
  );
};

export default EmailPasswordSignUpContainer;

function persistPendingEmailConfirmationState(params: {
  email: string;
  inviteCode?: string;
  nextPath?: string;
}) {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(
    EMAIL_CONFIRMATION_STATE_KEY,
    JSON.stringify({
      email: params.email,
      inviteCode: params.inviteCode ?? null,
      nextPath: params.nextPath ?? null,
    }),
  );

  const url = new URL(window.location.href);
  url.searchParams.set('emailConfirmation', 'pending');
  window.history.replaceState(null, '', url.toString());
}

function getPendingConfirmationPath(params: {
  email: string;
  inviteCode?: string;
  nextPath?: string;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set('pending', '1');
  searchParams.set('email', params.email);

  if (params.inviteCode) {
    searchParams.set('inviteCode', params.inviteCode);
  }

  if (params.nextPath) {
    searchParams.set('next', params.nextPath);
  }

  return `/auth/confirmed?${searchParams.toString()}`;
}

function readPendingEmailConfirmationState(): {
  email: string;
  inviteCode: string | null;
  nextPath: string | null;
} | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);

  if (params.get('emailConfirmation') !== 'pending') {
    return null;
  }

  const raw = window.sessionStorage.getItem(EMAIL_CONFIRMATION_STATE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as {
      email?: string;
      inviteCode?: string | null;
      nextPath?: string | null;
    };

    if (!parsed.email) {
      return null;
    }

    return {
      email: parsed.email,
      inviteCode: parsed.inviteCode ?? null,
      nextPath: parsed.nextPath ?? null,
    };
  } catch {
    return null;
  }
}

function clearPendingEmailConfirmationState() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(EMAIL_CONFIRMATION_STATE_KEY);

  const url = new URL(window.location.href);
  url.searchParams.delete('emailConfirmation');
  window.history.replaceState(null, '', url.toString());
}
