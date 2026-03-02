'use client';

import { useMemo, useState } from 'react';
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
import { GENDER_OPTIONS } from '~/lib/ultaura/constants';

export interface BirthdayStepData {
  birthday: { month: number; day: number } | null;
  birthYear: number | null;
  gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | null;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const BirthdayStep: React.FCC<{
  onSubmit: (data: BirthdayStepData) => void;
  onGoBack?: () => void;
}> = ({ onSubmit, onGoBack }) => {
  const { t } = useTranslation('onboarding');
  const [month, setMonth] = useState<string>('');
  const [day, setDay] = useState<string>('');
  const [birthYear, setBirthYear] = useState<string>('');
  const [selectedGender, setSelectedGender] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const monthOptions = useMemo(
    () => MONTHS.map((label, index) => ({ value: String(index + 1), label })),
    [],
  );

  const dayOptions = useMemo(
    () =>
      Array.from({ length: 31 }, (_, i) => ({
        value: String(i + 1),
        label: String(i + 1),
      })),
    [],
  );

  const handleContinue = () => {
    setError(null);

    const hasMonth = Boolean(month);
    const hasDay = Boolean(day);

    if (hasMonth !== hasDay) {
      setError(
        t('birthdayError', {
          defaultValue: 'Select a month and day, or skip this step.',
        }),
      );
      return;
    }

    let birthday: { month: number; day: number } | null = null;

    if (hasMonth && hasDay) {
      const dayNumber = Number.parseInt(day, 10);
      const monthNumber = Number.parseInt(month, 10);

      if (!Number.isFinite(dayNumber) || dayNumber < 1 || dayNumber > 31) {
        setError(
          t('birthdayDayError', {
            defaultValue: 'Enter a day between 1 and 31.',
          }),
        );
        return;
      }

      birthday = { month: monthNumber, day: dayNumber };
    }

    const trimmedBirthYear = birthYear.trim();
    let parsedBirthYear: number | null = null;
    if (trimmedBirthYear) {
      const currentYear = new Date().getFullYear();
      const yearNumber = Number.parseInt(trimmedBirthYear, 10);

      if (
        !Number.isFinite(yearNumber) ||
        yearNumber < 1900 ||
        yearNumber > currentYear
      ) {
        setError(
          t('birthYearError', {
            defaultValue: `Enter a valid birth year between 1900 and ${currentYear}.`,
          }),
        );
        return;
      }

      parsedBirthYear = yearNumber;
    }

    onSubmit({
      birthday,
      birthYear: parsedBirthYear,
      gender: selectedGender
        ? (selectedGender as
            | 'male'
            | 'female'
            | 'non_binary'
            | 'prefer_not_to_say')
        : null,
    });
  };

  const handleSkip = () => {
    setError(null);
    onSubmit({ birthday: null, birthYear: null, gender: null });
  };

  return (
    <div className={'flex w-full flex-1 flex-col space-y-12'}>
      <div className={'flex flex-col space-y-2'}>
        <Heading type={1}>
          <Trans i18nKey={'onboarding:personalHeading'} />
        </Heading>

        <SubHeading>
          <span className={'text-base'}>
            <Trans i18nKey={'onboarding:personalDescription'} />
          </span>
        </SubHeading>
      </div>

      <div className="flex flex-1 flex-col space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            <Trans i18nKey={'onboarding:birthdayLabel'} />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger>
                <SelectValue placeholder={t('birthdayMonthPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={day} onValueChange={setDay}>
              <SelectTrigger>
                <SelectValue placeholder={t('birthdayDayPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {dayOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            <Trans i18nKey={'onboarding:birthYearLabel'} />
          </label>
          <TextField.Input
            type={'number'}
            name={'birthYear'}
            value={birthYear}
            onChange={(event) => setBirthYear(event.target.value)}
            placeholder={t('birthYearPlaceholder')}
            min={1900}
            max={new Date().getFullYear()}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            <Trans i18nKey={'onboarding:genderLabel'} />
          </label>
          <Select value={selectedGender} onValueChange={setSelectedGender}>
            <SelectTrigger>
              <SelectValue placeholder={t('genderPlaceholder')} />
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
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-col gap-3">
        <Button type={'button'} onClick={handleContinue}>
          <Trans i18nKey={'common:continue'} />
        </Button>
        <Button type={'button'} variant={'ghost'} onClick={handleSkip}>
          <Trans i18nKey={'onboarding:skipPersonal'} />
        </Button>
        {onGoBack && (
          <Button type={'button'} variant={'ghost'} onClick={onGoBack}>
            <Trans i18nKey={'common:goBack'} />
          </Button>
        )}
      </div>
    </div>
  );
};

export default BirthdayStep;
