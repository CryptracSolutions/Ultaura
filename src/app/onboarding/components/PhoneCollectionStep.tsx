'use client';

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import Button from '~/core/ui/Button';
import Trans from '~/core/ui/Trans';
import { TELEPHONY } from '~/lib/ultaura/constants';
import { formatToE164, isValidUsPhoneInput } from '~/lib/ultaura/phone';
import PhoneInput from '~/components/ultaura/PhoneInput';

export interface PhoneCollectionStepData {
  phoneE164: string;
  timezone: string;
}

const FALLBACK_TIMEZONE = 'America/Los_Angeles';

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIMEZONE;
  } catch {
    return FALLBACK_TIMEZONE;
  }
}

const PhoneCollectionStep: React.FCC<{
  onSubmit: (data: PhoneCollectionStepData) => void;
  onGoBack?: () => void;
}> = ({ onSubmit, onGoBack }) => {
  const { t } = useTranslation('onboarding');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);

      if (!isValidUsPhoneInput(phoneNumber, { required: true })) {
        setError(t('phoneCollectionError', { defaultValue: 'Enter a valid US phone number.' }));
        return;
      }

      onSubmit({
        phoneE164: formatToE164(phoneNumber.trim()),
        timezone: detectTimezone(),
      });
    },
    [phoneNumber, onSubmit, t]
  );

  return (
    <form onSubmit={handleSubmit} className={'flex w-full flex-1 flex-col space-y-12'}>
      <div className={'flex flex-col space-y-2'}>
        <Heading type={1}>
          <Trans i18nKey={'onboarding:phoneCollectionHeading'} />
        </Heading>

        <SubHeading>
          <span className={'text-base'}>
            <Trans i18nKey={'onboarding:phoneCollectionDescription'} />
          </span>
        </SubHeading>
      </div>

      <div className={'flex flex-1 flex-col space-y-2'}>
        <label className="text-sm font-medium text-foreground">
          <Trans i18nKey={'onboarding:phoneCollectionLabel'} />
        </label>
        <PhoneInput
          data-cy={'self-phone-input'}
          required
          name={'phone'}
          value={phoneNumber}
          onValueChange={setPhoneNumber}
          onBlur={() => {
            if (!isValidUsPhoneInput(phoneNumber, { required: true })) {
              setError(t('phoneCollectionError', { defaultValue: 'Enter a valid US phone number.' }));
            } else {
              setError(null);
            }
          }}
          placeholder={t('phoneCollectionPlaceholder')}
        />
        <p className="text-xs text-muted-foreground">
          <Trans i18nKey={'onboarding:phoneCollectionHelper'} />
        </p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <div className={'flex flex-col space-y-3'}>
        <Button type={'submit'}>
          <Trans i18nKey={'common:continue'} />
        </Button>

        {onGoBack && (
          <Button type={'button'} variant={'ghost'} onClick={onGoBack}>
            <Trans i18nKey={'common:goBack'} />
          </Button>
        )}
      </div>
    </form>
  );
};

export default PhoneCollectionStep;
