'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import Button from '~/core/ui/Button';
import Trans from '~/core/ui/Trans';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import TextField from '~/core/ui/TextField';

export interface BirthdayStepData {
  birthday: { month: number; day: number } | null;
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
  const [error, setError] = useState<string | null>(null);

  const monthOptions = useMemo(
    () => MONTHS.map((label, index) => ({ value: String(index + 1), label })),
    []
  );

  const handleContinue = () => {
    setError(null);

    if (!month || !day) {
      setError(t('birthdayError', { defaultValue: 'Select a month and day, or skip this step.' }));
      return;
    }

    const dayNumber = Number.parseInt(day, 10);
    const monthNumber = Number.parseInt(month, 10);

    if (!Number.isFinite(dayNumber) || dayNumber < 1 || dayNumber > 31) {
      setError(t('birthdayDayError', { defaultValue: 'Enter a day between 1 and 31.' }));
      return;
    }

    onSubmit({ birthday: { month: monthNumber, day: dayNumber } });
  };

  const handleSkip = () => {
    setError(null);
    onSubmit({ birthday: null });
  };

  return (
    <div className={'flex w-full flex-1 flex-col space-y-12'}>
      <div className={'flex flex-col space-y-2'}>
        <Heading type={1}>
          <Trans i18nKey={'onboarding:birthdayHeading'} />
        </Heading>

        <SubHeading>
          <span className={'text-base'}>
            <Trans i18nKey={'onboarding:birthdayDescription'} />
          </span>
        </SubHeading>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            <Trans i18nKey={'onboarding:birthdayMonthLabel'} />
          </label>
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
        </div>

        <div className="space-y-2">
          <TextField>
            <TextField.Label>
              <Trans i18nKey={'onboarding:birthdayDayLabel'} />
              <TextField.Input
                type={'number'}
                min={1}
                max={31}
                value={day}
                onChange={(event) => setDay(event.target.value)}
                placeholder={t('birthdayDayPlaceholder')}
              />
            </TextField.Label>
          </TextField>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        <Trans i18nKey={'onboarding:birthdayPreview'} />
      </p>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-col gap-3">
        <Button type={'button'} onClick={handleContinue}>
          <Trans i18nKey={'common:continue'} />
        </Button>
        <Button type={'button'} variant={'ghost'} onClick={handleSkip}>
          <Trans i18nKey={'onboarding:skipBirthday'} />
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
