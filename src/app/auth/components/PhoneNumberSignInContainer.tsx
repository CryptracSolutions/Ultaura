import type { FormEventHandler } from 'react';
import React, { useCallback, useState } from 'react';

import Button from '~/core/ui/Button';
import configuration from '~/configuration';

import If from '~/core/ui/If';
import Alert from '~/core/ui/Alert';
import Trans from '~/core/ui/Trans';

import PhoneNumberCredentialForm from '~/app/auth/components/PhoneNumberCredentialForm';
import VerificationCodeInput from '~/app/auth/components/VerificationCodeInput';

import useVerifyOtp from '~/core/hooks/use-verify-otp';
import useSignInWithOtp from '~/core/hooks/use-sign-in-with-otp';

enum Step {
  Phone,
  Otp,
}

const PhoneNumberSignInContainer: React.FC<{
  onSuccess: () => unknown;
  mode: 'signIn' | 'signUp';
}> = ({ onSuccess, mode }) => {
  const [step, setStep] = useState<Step>(Step.Phone);
  const [verificationCode, setVerificationCode] = useState('');
  const [phone, setPhone] = useState('');

  const signInWithOtp = useSignInWithOtp();
  const verifyOtp = useVerifyOtp();

  const onPhoneNumberSubmit = useCallback(
    async (phone: string) => {
      await signInWithOtp.trigger({
        phone,
        options: {
          shouldCreateUser: mode === 'signUp',
          channel: 'sms',
        },
      });

      setStep(Step.Otp);
      setPhone(phone);
    },
    [mode, signInWithOtp],
  );

  const onGoBack = useCallback(() => {
    setStep(Step.Phone);
    setVerificationCode('');
    verifyOtp.reset();
  }, [verifyOtp]);

  const onOTPSubmit: FormEventHandler = useCallback(
    async (e) => {
      e.preventDefault();

      const redirectTo = `${window.location.origin}${configuration.paths.appHome}`;

      await verifyOtp.trigger({
        token: verificationCode,
        phone,
        type: 'sms',
        options: {
          redirectTo,
        },
      });

      onSuccess();
    },
    [onSuccess, verificationCode, phone, verifyOtp],
  );

  if (step === Step.Otp) {
    return (
      <form className={'w-full'} onSubmit={onOTPSubmit}>
        <div className={'flex flex-col space-y-4'}>
          <If condition={verifyOtp.error}>
            <Alert type={'error'}>
              <Alert.Heading>
                <Trans i18nKey={'auth:phoneOtpVerifyErrorHeading'} />
              </Alert.Heading>
              <Trans i18nKey={'auth:phoneOtpVerifyErrorBody'} />
            </Alert>
          </If>

          <VerificationCodeInput
            onInvalid={() => setVerificationCode('')}
            onValid={setVerificationCode}
          />

          <Button
            disabled={!verificationCode}
            loading={verifyOtp.isMutating}
            type={'submit'}
          >
            <Trans
              i18nKey={mode === 'signUp' ? 'auth:signUp' : 'auth:signIn'}
            />
          </Button>

          <button
            type={'button'}
            onClick={onGoBack}
            className={
              'text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors'
            }
          >
            <Trans i18nKey={'auth:phoneOtpGoBack'} />
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className={'flex w-full flex-col space-y-4'}>
      <If condition={signInWithOtp.error}>
        <Alert type={'error'}>
          <Alert.Heading>
            <Trans i18nKey={'auth:phoneOtpSendErrorHeading'} />
          </Alert.Heading>
          <Trans i18nKey={'auth:phoneOtpSendErrorBody'} />
        </Alert>
      </If>

      <PhoneNumberCredentialForm
        action={mode}
        onSubmit={onPhoneNumberSubmit}
        loading={signInWithOtp.isMutating}
      />
    </div>
  );
};

export default PhoneNumberSignInContainer;
