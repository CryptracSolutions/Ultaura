'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import useSWRMutation from 'swr/mutation';

import useSupabase from '~/core/hooks/use-supabase';
import useFactorsMutationKey from '~/core/hooks/use-user-factors-mutation-key';
import Alert from '~/core/ui/Alert';
import Button from '~/core/ui/Button';
import Modal from '~/core/ui/Modal';
import TextField from '~/core/ui/TextField';
import Trans from '~/core/ui/Trans';

import PhoneInput from '~/components/ultaura/PhoneInput';
import { formatToE164, getUsPhoneValidationError } from '~/lib/ultaura/phone';

import VerificationCodeInput from '~/app/auth/components/VerificationCodeInput';

interface PhoneMfaSetupModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

function PhoneMfaSetupModal({ isOpen, setIsOpen }: PhoneMfaSetupModalProps) {
  const { t } = useTranslation();

  const handleSuccess = useCallback(() => {
    setIsOpen(false);
    toast.success(t('profile:phoneMfaSetupSuccess'));
  }, [setIsOpen, t]);

  return (
    <Modal
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      heading={<Trans i18nKey={'profile:phoneMfaModalHeading'} />}
      description={<Trans i18nKey={'profile:phoneMfaModalDescription'} />}
    >
      <PhoneMfaSetupForm
        onSuccess={handleSuccess}
        onCancel={() => setIsOpen(false)}
      />
    </Modal>
  );
}

export default PhoneMfaSetupModal;

function PhoneMfaSetupForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<'phone' | 'verify'>('phone');
  const [phone, setPhone] = useState('');
  const [friendlyName, setFriendlyName] = useState('');
  const [factorId, setFactorId] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const { t } = useTranslation();
  const client = useSupabase();
  const mutationKey = useFactorsMutationKey();
  const cooldownRef = useRef<ReturnType<typeof setInterval>>();

  const phoneE164 = phone ? formatToE164(phone) : '';
  const maskedPhone = phoneE164
    ? `${phoneE164.slice(0, 3)}***${phoneE164.slice(-4)}`
    : '';

  const startCooldown = useCallback(() => {
    setResendCooldown(60);

    if (cooldownRef.current) clearInterval(cooldownRef.current);

    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const handleEnrollAndChallenge = useCallback(async () => {
    setError('');

    const validationError = getUsPhoneValidationError(phone, {
      required: true,
    });
    if (validationError) {
      setError(t('profile:invalidPhoneNumber'));
      return;
    }

    const enrollPhone = formatToE164(phone);
    setLoading(true);

    try {
      const name = friendlyName.trim() || `Phone ***${enrollPhone.slice(-4)}`;

      const { data: enrollData, error: enrollError } =
        await client.auth.mfa.enroll({
          factorType: 'phone',
          phone: enrollPhone,
          friendlyName: name,
        });

      if (enrollError) {
        const msg = enrollError.message?.toLowerCase() ?? '';

        if (msg.includes('already') || msg.includes('enrolled')) {
          setError(t('profile:phoneAlreadyEnrolled'));
        } else {
          setError(t('profile:phoneMfaSetupError'));
        }
        return;
      }

      setFactorId(enrollData.id);

      const { data: challengeData, error: challengeError } =
        await client.auth.mfa.challenge({
          factorId: enrollData.id,
          channel: 'sms',
        });

      if (challengeError) {
        setStep('verify');

        if (
          challengeError.status === 429 ||
          challengeError.message?.toLowerCase().includes('rate')
        ) {
          setError(t('profile:tooManyAttempts'));
          startCooldown();
        } else {
          setError(t('profile:smsDeliveryError'));
        }

        return;
      }

      setChallengeId(challengeData.id);
      setStep('verify');
      startCooldown();
    } catch {
      setError(t('profile:phoneMfaSetupError'));
    } finally {
      setLoading(false);
    }
  }, [client.auth.mfa, friendlyName, phone, startCooldown, t]);

  const verifyMutation = useSWRMutation(mutationKey, async () => {
    const { error: verifyError } = await client.auth.mfa.verify({
      factorId,
      challengeId,
      code: verifyCode,
    });

    if (verifyError) throw verifyError;
  });

  const handleVerify = useCallback(async () => {
    if (!challengeId) return;

    setError('');

    try {
      await verifyMutation.trigger();
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message?.toLowerCase() : '';

      if (message.includes('expired')) {
        setError(t('profile:codeExpired'));
      } else if (message.includes('rate') || message.includes('limit')) {
        setError(t('profile:tooManyAttempts'));
      } else {
        setError(t('profile:invalidVerificationCode'));
      }
    }
  }, [challengeId, onSuccess, t, verifyMutation]);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) return;

    setError('');

    try {
      const { data: challengeData, error: challengeError } =
        await client.auth.mfa.challenge({
          factorId,
          channel: 'sms',
        });

      if (challengeError) {
        if (
          challengeError.status === 429 ||
          challengeError.message?.toLowerCase().includes('rate')
        ) {
          setError(t('profile:tooManyAttempts'));
          startCooldown();
        } else {
          setError(t('profile:smsDeliveryError'));
        }
        return;
      }

      setChallengeId(challengeData.id);
      startCooldown();
    } catch {
      setError(t('profile:smsDeliveryError'));
    }
  }, [client.auth.mfa, factorId, resendCooldown, startCooldown, t]);

  if (step === 'verify') {
    return (
      <div className="flex flex-col space-y-4">
        <p className="text-sm text-muted-foreground">
          <Trans
            i18nKey={'profile:smsSentMessage'}
            values={{ phone: maskedPhone }}
          />
        </p>

        {error && (
          <Alert type="error">
            <Alert.Heading>
              <Trans i18nKey={'common:genericError'} defaults="Error" />
            </Alert.Heading>
            <span>{error}</span>
          </Alert>
        )}

        <VerificationCodeInput
          onValid={setVerifyCode}
          onInvalid={() => setVerifyCode('')}
        />

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
          >
            {resendCooldown > 0 ? (
              <Trans
                i18nKey={'profile:resendCodeCooldown'}
                values={{ seconds: resendCooldown }}
              />
            ) : (
              <Trans i18nKey={'profile:resendCode'} />
            )}
          </button>

          <Button
            disabled={!verifyCode || !challengeId || verifyMutation.isMutating}
            loading={verifyMutation.isMutating}
            onClick={handleVerify}
          >
            <Trans i18nKey={'profile:submitVerificationCode'} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      {error && (
        <Alert type="error">
          <Alert.Heading>
            <Trans i18nKey={'common:genericError'} defaults="Error" />
          </Alert.Heading>
          <span>{error}</span>
        </Alert>
      )}

      <TextField>
        <TextField.Label>
          <Trans i18nKey={'profile:authFactorName'} />

          <TextField.Input
            value={friendlyName}
            onChange={(e) => setFriendlyName(e.target.value)}
            placeholder="e.g. My iPhone"
            disabled={loading}
            autoComplete="off"
          />
        </TextField.Label>

        <TextField.Hint>
          <Trans i18nKey={'profile:authFactorNameHint'} />
        </TextField.Hint>
      </TextField>

      <TextField>
        <TextField.Label>
          <Trans i18nKey={'profile:phoneNumberLabel'} />

          <PhoneInput
            value={phone}
            onValueChange={(value) => {
              setPhone(value);
              if (error) setError('');
            }}
            disabled={loading}
            placeholder="(555) 123-4567"
            error={
              error === t('profile:invalidPhoneNumber') ? error : undefined
            }
          />
          <TextField.Error
            error={
              error === t('profile:invalidPhoneNumber') ? error : undefined
            }
          />
        </TextField.Label>
      </TextField>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          <Trans i18nKey={'common:cancel'} defaults="Cancel" />
        </Button>

        <Button
          onClick={handleEnrollAndChallenge}
          loading={loading}
          disabled={loading || !phone}
        >
          <Trans i18nKey={'profile:sendVerificationCodeButton'} />
        </Button>
      </div>
    </div>
  );
}
