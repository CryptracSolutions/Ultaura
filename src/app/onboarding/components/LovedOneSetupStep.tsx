'use client';

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import Button from '~/core/ui/Button';
import Trans from '~/core/ui/Trans';
import TextField from '~/core/ui/TextField';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/core/ui/Select';
import {
  GENDER_OPTIONS,
  TELEPHONY,
  US_TIMEZONES,
} from '~/lib/ultaura/constants';
import { formatToE164, isValidUsPhoneInput } from '~/lib/ultaura/phone';
import PhoneInput from '~/components/ultaura/PhoneInput';

export interface LovedOneSetupStepData {
  lovedOneName: string;
  lovedOnePhoneE164: string;
  lovedOneTimezone: string;
  lovedOneBirthYear: number | null;
  lovedOneGender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | null;
}

const LovedOneSetupStep: React.FCC<{
  onSubmit: (data: LovedOneSetupStepData) => void;
  onGoBack?: () => void;
}> = ({ onSubmit, onGoBack }) => {
  const { t } = useTranslation('onboarding');
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [timezone, setTimezone] = useState(TELEPHONY.DEFAULT_TIMEZONE);
  const [birthYear, setBirthYear] = useState('');
  const [selectedGender, setSelectedGender] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);

      if (!isValidUsPhoneInput(phoneNumber, { required: true })) {
        setError(
          t('phoneCollectionError', {
            defaultValue: 'Enter a valid US phone number.',
          }),
        );
        return;
      }

      if (!displayName.trim()) {
        setError(
          t('lovedOneNameError', {
            defaultValue: 'Enter their name to continue.',
          }),
        );
        return;
      }

      let parsedBirthYear: number | null = null;
      const trimmedBirthYear = birthYear.trim();
      if (trimmedBirthYear) {
        const currentYear = new Date().getFullYear();
        const yearNumber = Number.parseInt(trimmedBirthYear, 10);

        if (
          !Number.isFinite(yearNumber) ||
          yearNumber < 1900 ||
          yearNumber > currentYear
        ) {
          setError(
            t('lovedOneBirthYearError', {
              defaultValue: `Enter a valid birth year between 1900 and ${currentYear}.`,
            }),
          );
          return;
        }

        parsedBirthYear = yearNumber;
      }

      onSubmit({
        lovedOneName: displayName.trim(),
        lovedOnePhoneE164: formatToE164(phoneNumber.trim()),
        lovedOneTimezone: timezone,
        lovedOneBirthYear: parsedBirthYear,
        lovedOneGender: selectedGender
          ? (selectedGender as
              | 'male'
              | 'female'
              | 'non_binary'
              | 'prefer_not_to_say')
          : null,
      });
    },
    [
      displayName,
      phoneNumber,
      timezone,
      birthYear,
      selectedGender,
      onSubmit,
      t,
    ],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className={'flex w-full flex-1 flex-col space-y-12'}
    >
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
          <PhoneInput
            required
            name={'lovedOnePhone'}
            value={phoneNumber}
            onValueChange={setPhoneNumber}
            onBlur={() => {
              if (!isValidUsPhoneInput(phoneNumber, { required: true })) {
                setError(
                  t('phoneCollectionError', {
                    defaultValue: 'Enter a valid US phone number.',
                  }),
                );
              } else {
                setError(null);
              }
            }}
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

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            <Trans i18nKey={'onboarding:lovedOneBirthYearLabel'} />
          </label>
          <TextField.Input
            type={'number'}
            name={'lovedOneBirthYear'}
            value={birthYear}
            onChange={(event) => setBirthYear(event.target.value)}
            placeholder={t('birthYearPlaceholder')}
            min={1900}
            max={new Date().getFullYear()}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            <Trans i18nKey={'onboarding:lovedOneGenderLabel'} />
          </label>
          <Select value={selectedGender} onValueChange={setSelectedGender}>
            <SelectTrigger>
              <SelectValue placeholder={t('lovedOneGenderPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {GENDER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <p className="text-xs text-muted-foreground">
          <Trans i18nKey={'onboarding:lovedOneHelper'} />
        </p>
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
