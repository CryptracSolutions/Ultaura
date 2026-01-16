'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Trans from '~/core/ui/Trans';

import AuthErrorMessage from './AuthErrorMessage';
import VerificationCodeInput from './VerificationCodeInput';
import useSignUpWithEmailAndPasswordMutation from '~/core/hooks/use-sign-up-with-email-password';
import useVerifyOtp from '~/core/hooks/use-verify-otp';
import If from '~/core/ui/If';
import Alert from '~/core/ui/Alert';
import Button from '~/core/ui/Button';

import EmailPasswordSignUpForm from '~/app/auth/components/EmailPasswordSignUpForm';

import configuration from '~/configuration';

const requireEmailConfirmation = configuration.auth.requireEmailConfirmation;

const EmailPasswordSignUpContainer: React.FCC<{
  onSignUp: (userId?: string) => unknown;
  onError?: (error?: unknown) => unknown;
}> = ({ onSignUp, onError }) => {
  const router = useRouter();
  const signUpMutation = useSignUpWithEmailAndPasswordMutation();
  const verifyOtpMutation = useVerifyOtp();
  const redirecting = useRef(false);
  const loading = signUpMutation.isMutating || redirecting.current;
  const [showVerifyEmailAlert, setShowVerifyEmailAlert] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState<Error | null>(null);

  const callOnErrorCallback = useCallback(() => {
    if (signUpMutation.error && onError) {
      onError(signUpMutation.error);
    }
  }, [signUpMutation.error, onError]);

  useEffect(() => {
    callOnErrorCallback();
  }, [callOnErrorCallback]);

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
        }

        onSignUp(data.user?.id);
      } catch (error) {
        if (onError) {
          onError(error);
        }
      }
    },
    [loading, onError, onSignUp, signUpMutation],
  );

  const onVerifyCode = useCallback(async () => {
    if (!verifyCode || !signupEmail) {
      return;
    }

    setVerifyError(null);

    try {
      await verifyOtpMutation.trigger({
        email: signupEmail,
        token: verifyCode,
        type: 'signup',
      });

      // Redirect to onboarding after successful verification
      router.replace(configuration.paths.onboarding);
    } catch (error) {
      setVerifyError(error as Error);
    }
  }, [verifyCode, signupEmail, verifyOtpMutation, router]);

  return (
    <>
      <If condition={showVerifyEmailAlert}>
        <Alert type={'success'}>
          <Alert.Heading>
            <Trans i18nKey={'auth:emailConfirmationAlertHeading'} />
          </Alert.Heading>

          <p data-cy={'email-confirmation-alert'}>
            <Trans i18nKey={'auth:emailConfirmationAlertBody'} />
          </p>
        </Alert>

        <div className={'mt-6 flex flex-col space-y-4'}>
          <p className={'text-center text-sm text-gray-500 dark:text-gray-400'}>
            <Trans i18nKey={'auth:orEnterCodeBelow'} />
          </p>

          <VerificationCodeInput
            onValid={setVerifyCode}
            onInvalid={() => setVerifyCode('')}
          />

          <If condition={verifyError}>
            <Alert type={'error'}>
              <Trans i18nKey={'auth:verifyCodeError'} />
            </Alert>
          </If>

          <Button
            onClick={onVerifyCode}
            loading={verifyOtpMutation.isMutating}
            disabled={!verifyCode}
          >
            {verifyOtpMutation.isMutating ? (
              <Trans i18nKey={'auth:verifyingCode'} />
            ) : (
              <Trans i18nKey={'auth:verifyCode'} />
            )}
          </Button>
        </div>
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
