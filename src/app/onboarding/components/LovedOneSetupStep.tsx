'use client';

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import Button from '~/core/ui/Button';
import Trans from '~/core/ui/Trans';
import TextField from '~/core/ui/TextField';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import { TELEPHONY, US_TIMEZONES } from '~/lib/ultaura/constants';

export interface LovedOneSetupStepData {
  lovedOneName: string;
  lovedOnePhoneE164: string;
  lovedOneTimezone: string;
}

function formatToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (!phone.startsWith('+')) {
    return `+${digits}`;
  }

  return phone;
}

const LovedOneSetupStep: React.FCC<{
  onSubmit: (data: LovedOneSetupStepData) => void;
  onGoBack?: () => void;
}> = ({ onSubmit, onGoBack }) => {
  const { t } = useTranslation('onboarding');
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [timezone, setTimezone] = useState(TELEPHONY.DEFAULT_TIMEZONE);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);

      const formatted = formatToE164(phoneNumber.trim());

      if (!TELEPHONY.PHONE_REGEX.test(formatted)) {
        setError(t('phoneCollectionError', { defaultValue: 'Enter a valid US phone number.' }));
        return;
      }

      if (!displayName.trim()) {
        setError(t('lovedOneNameError', { defaultValue: 'Enter their name to continue.' }));
        return;
      }

      onSubmit({
        lovedOneName: displayName.trim(),
        lovedOnePhoneE164: formatted,
        lovedOneTimezone: timezone,
      });
    },
    [displayName, phoneNumber, timezone, onSubmit, t]
  );

  return (
    <form onSubmit={handleSubmit} className={'flex w-full flex-1 flex-col space-y-12'}>
      <div className={'flex flex-col space-y-2'}>
        <Heading type={1}>
          <Trans i18nKey={'onboarding:lovedOneHeading'} />
        </Heading>

        <SubHeading>
          <span className={'text-base'}>
            <Trans i18nKey={'onboarding:lovedOneDescription'} />
          </span>
        </SubHeading>
      </div>

      <div className="flex flex-1 flex-col space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            <Trans i18nKey={'onboarding:lovedOneNameLabel'} />
          </label>
          <TextField.Input
            required
            name={'lovedOneName'}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={t('lovedOneNamePlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            <Trans i18nKey={'onboarding:lovedOnePhoneLabel'} />
          </label>
          <TextField.Input
            required
            name={'lovedOnePhone'}
            type={'tel'}
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder={t('phoneCollectionPlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            <Trans i18nKey={'onboarding:lovedOneTimezoneLabel'} />
          </label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger>
              <SelectValue placeholder={t('lovedOneTimezonePlaceholder')} />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {US_TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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

export default LovedOneSetupStep;
