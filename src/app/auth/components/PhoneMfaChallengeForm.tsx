'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import useSupabase from '~/core/hooks/use-supabase';
import Alert from '~/core/ui/Alert';
import Button from '~/core/ui/Button';
import Heading from '~/core/ui/Heading';
import Trans from '~/core/ui/Trans';

import VerificationCodeInput from './VerificationCodeInput';

interface PhoneMfaChallengeFormProps {
  factorId: string;
  onSuccess: () => void;
  onBack: () => void;
  onTrustDevice?: (factorId: string) => Promise<void>;
}

function PhoneMfaChallengeForm({
  factorId,
  onSuccess,
  onBack,
  onTrustDevice,
}: PhoneMfaChallengeFormProps) {
  const client = useSupabase();

  const [challengeId, setChallengeId] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(true);
  const [resendCooldown, setResendCooldown] = useState(0);

  const cooldownRef = useRef<ReturnType<typeof setInterval>>();
  const hasSentRef = useRef(false);

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

  const sendChallenge = useCallback(async () => {
    setSending(true);
    setError('');

    try {
      const { data, error: challengeError } = await client.auth.mfa.challenge({
        factorId,
        channel: 'sms',
      });

      if (challengeError) {
        if (
          challengeError.status === 429 ||
          challengeError.message?.toLowerCase().includes('rate')
        ) {
          setError('auth:phoneMfaSendError');
          startCooldown();
        } else {
          setError('auth:phoneMfaSendError');
        }
        return;
      }

      setChallengeId(data.id);
      startCooldown();
    } catch {
      setError('auth:phoneMfaSendError');
    } finally {
      setSending(false);
    }
  }, [client.auth.mfa, factorId, startCooldown]);

  useEffect(() => {
    if (!hasSentRef.current) {
      hasSentRef.current = true;
      sendChallenge();
    }
  }, [sendChallenge]);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const handleVerify = useCallback(async () => {
    if (!challengeId || !verifyCode) return;

    setError('');
    setLoading(true);

    try {
      const { error: verifyError } = await client.auth.mfa.verify({
        factorId,
        challengeId,
        code: verifyCode,
      });

      if (verifyError) {
        setError('auth:phoneMfaVerifyError');
        return;
      }

      if (onTrustDevice) {
        await onTrustDevice(factorId);
      }

      onSuccess();
    } catch {
      setError('auth:phoneMfaVerifyError');
    } finally {
      setLoading(false);
    }
  }, [
    challengeId,
    client.auth.mfa,
    factorId,
    onSuccess,
    onTrustDevice,
    verifyCode,
  ]);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) return;
    await sendChallenge();
  }, [resendCooldown, sendChallenge]);

  return (
    <div className="flex flex-col space-y-4">
      <div>
        <Heading type={5}>
          <Trans i18nKey={'auth:phoneMfaChallengeHeading'} />
        </Heading>

        <p className="text-sm text-muted-foreground">
          <Trans i18nKey={'auth:phoneMfaChallengeDescription'} />
        </p>
      </div>

      {error && (
        <Alert type="error">
          <Alert.Heading>
            <Trans i18nKey={'common:genericError'} defaults="Error" />
          </Alert.Heading>
          <span>
            <Trans i18nKey={error} />
          </span>
        </Alert>
      )}

      {sending ? (
        <p className="text-sm text-muted-foreground">
          <Trans i18nKey={'auth:sendingMfaCode'} />
        </p>
      ) : !challengeId ? (
        <div className="flex flex-col space-y-3">
          <Button onClick={handleResend} disabled={resendCooldown > 0}>
            {resendCooldown > 0 ? (
              <Trans
                i18nKey={'auth:phoneMfaResendCooldown'}
                values={{ seconds: resendCooldown }}
              />
            ) : (
              <Trans i18nKey={'auth:phoneMfaResendCode'} />
            )}
          </Button>

          <button
            type="button"
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            <Trans i18nKey={'common:goBack'} defaults="Back" />
          </button>
        </div>
      ) : (
        <>
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
                  i18nKey={'auth:phoneMfaResendCooldown'}
                  values={{ seconds: resendCooldown }}
                />
              ) : (
                <Trans i18nKey={'auth:phoneMfaResendCode'} />
              )}
            </button>

            <Button
              disabled={!verifyCode || !challengeId || loading}
              loading={loading}
              onClick={handleVerify}
            >
              <Trans i18nKey={'auth:verifyMfaCodeSuccess'} defaults="Verify" />
            </Button>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            <Trans i18nKey={'common:goBack'} defaults="Back" />
          </button>
        </>
      )}
    </div>
  );
}

export default PhoneMfaChallengeForm;
