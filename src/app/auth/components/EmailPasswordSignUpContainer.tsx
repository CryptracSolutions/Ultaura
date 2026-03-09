'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import AuthErrorMessage from './AuthErrorMessage';
import useSignUpWithEmailAndPasswordMutation from '~/core/hooks/use-sign-up-with-email-password';
import If from '~/core/ui/If';

import EmailPasswordSignUpForm from '~/app/auth/components/EmailPasswordSignUpForm';
import EmailConfirmationWaiting from '~/app/auth/components/EmailConfirmationWaiting';

import configuration from '~/configuration';
import useResendSignupConfirmation from '~/core/hooks/use-resend-signup-confirmation';

const requireEmailConfirmation = configuration.auth.requireEmailConfirmation;
const RESEND_COOLDOWN_SECONDS = 60;

const EmailPasswordSignUpContainer: React.FCC<{
  onSignUp: (userId?: string) => unknown;
  onError?: (error?: unknown) => unknown;
}> = ({ onSignUp, onError }) => {
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
        const data = await signUpMutation.trigger(params);

        // If the user is required to confirm their email, we display a message
        if (requireEmailConfirmation) {
          setSignupEmail(params.email);
          setShowVerifyEmailAlert(true);
          setResendSuccess(false);
          setResendError(null);
          startCooldown();
        }

        onSignUp(data.user?.id);
      } catch (error) {
        if (onError) {
          onError(error);
        }
      }
    },
    [loading, onError, onSignUp, signUpMutation, startCooldown],
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
