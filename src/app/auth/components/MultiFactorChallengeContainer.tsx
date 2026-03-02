import { useCallback, useEffect, useMemo, useState } from 'react';
import useMutation from 'swr/mutation';

import useSupabase from '~/core/hooks/use-supabase';
import Spinner from '~/core/ui/Spinner';
import Alert from '~/core/ui/Alert';
import Button from '~/core/ui/Button';
import useSignOut from '~/core/hooks/use-sign-out';
import Heading from '~/core/ui/Heading';
import If from '~/core/ui/If';
import Trans from '~/core/ui/Trans';

import { Shield, Smartphone } from 'lucide-react';
import PhoneMfaChallengeForm from './PhoneMfaChallengeForm';
import VerificationCodeInput from './VerificationCodeInput';
import useFetchAuthFactors from '~/core/hooks/use-fetch-factors';

function MultiFactorChallengeContainer({
  onSuccess,
  onTrustDevice,
}: React.PropsWithChildren<{
  onSuccess: () => void;
  onTrustDevice?: (factorId: string) => Promise<void>;
}>) {
  const [factorId, setFactorId] = useState('');
  const [factorType, setFactorType] = useState<'totp' | 'phone'>('totp');
  const [verifyCode, setVerifyCode] = useState('');

  const mutation = useVerifyMFAChallenge();

  const onSubmitClicked = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!factorId || !verifyCode) {
        return;
      }

      await mutation.trigger({
        factorId,
        verifyCode,
      });

      if (onTrustDevice) {
        await onTrustDevice(factorId);
      }

      onSuccess();
    },
    [factorId, mutation, onSuccess, onTrustDevice, verifyCode],
  );

  if (factorId && factorType === 'phone') {
    return (
      <PhoneMfaChallengeForm
        factorId={factorId}
        onSuccess={onSuccess}
        onBack={() => {
          setFactorId('');
          setFactorType('totp');
        }}
        onTrustDevice={onTrustDevice}
      />
    );
  }

  if (!factorId) {
    return (
      <FactorsListContainer
        onSelect={setFactorId}
        onSelectType={setFactorType}
        onSuccess={onSuccess}
      />
    );
  }

  return (
    <form onSubmit={onSubmitClicked}>
      <div className={'flex flex-col space-y-4'}>
        <span className={'text-sm'}>
          <Trans i18nKey={'profile:verifyActivationCodeDescription'} />
        </span>

        <div className={'flex w-full flex-col space-y-2.5'}>
          <VerificationCodeInput
            onInvalid={() => setVerifyCode('')}
            onValid={setVerifyCode}
          />

          <If condition={mutation.error}>
            <Alert type={'error'}>
              <Trans i18nKey={'profile:invalidVerificationCode'} />
            </Alert>
          </If>
        </div>

        <Button loading={mutation.isMutating} disabled={!verifyCode}>
          {mutation.isMutating ? (
            <Trans i18nKey={'profile:verifyingCode'} />
          ) : (
            <Trans i18nKey={'profile:submitVerificationCode'} />
          )}
        </Button>
      </div>
    </form>
  );
}

export default MultiFactorChallengeContainer;

function useVerifyMFAChallenge() {
  const client = useSupabase();

  return useMutation(
    ['mfa-verify-challenge'],
    async (
      _,
      {
        arg,
      }: {
        arg: {
          factorId: string;
          verifyCode: string;
        };
      },
    ) => {
      const { factorId, verifyCode: code } = arg;

      const response = await client.auth.mfa.challengeAndVerify({
        factorId,
        code,
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    },
  );
}

function FactorsListContainer({
  onSelect,
  onSelectType,
  onSuccess,
}: {
  onSelect: (factorId: string) => void;
  onSelectType: (type: 'totp' | 'phone') => void;
  onSuccess: () => void;
}) {
  const signOut = useSignOut();

  const { data: factors, isLoading, error } = useFetchAuthFactors();

  const isSuccess = factors && !isLoading && !error;

  const allFactors = useMemo(
    () =>
      [...(factors?.totp ?? []), ...(factors?.phone ?? [])].filter(
        (f) => f.status === 'verified',
      ),
    [factors?.totp, factors?.phone],
  );

  useEffect(() => {
    if (isSuccess && allFactors.length === 0) {
      onSuccess();
    }
  }, [isSuccess, allFactors.length, onSuccess]);

  useEffect(() => {
    if (error) {
      void signOut();
    }
  }, [error, signOut]);

  useEffect(() => {
    if (isSuccess && allFactors.length === 1) {
      onSelect(allFactors[0].id);
      onSelectType(allFactors[0].factor_type as 'totp' | 'phone');
    }
  }, [isSuccess, allFactors, onSelect, onSelectType]);

  if (isLoading) {
    return (
      <div className={'flex flex-col items-center space-y-4 py-8'}>
        <Spinner />

        <div>
          <Trans i18nKey={'profile:loadingFactors'} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={'w-full'}>
        <Alert type={'error'}>
          <Trans i18nKey={'profile:factorsListError'} />
        </Alert>
      </div>
    );
  }

  return (
    <div className={'flex flex-col space-y-4'}>
      <div>
        <Heading type={5}>
          <Trans i18nKey={'auth:selectFactorHeading'} />
        </Heading>
      </div>

      {allFactors.map((factor) => (
        <div key={factor.id}>
          <Button
            block
            variant={'outline'}
            className={'border-input'}
            onClick={() => {
              onSelect(factor.id);
              onSelectType(factor.factor_type as 'totp' | 'phone');
            }}
          >
            {factor.factor_type === 'phone' ? (
              <Smartphone className="h-4 w-4 mr-2" />
            ) : (
              <Shield className="h-4 w-4 mr-2" />
            )}
            {factor.friendly_name}
          </Button>
        </div>
      ))}
    </div>
  );
}
