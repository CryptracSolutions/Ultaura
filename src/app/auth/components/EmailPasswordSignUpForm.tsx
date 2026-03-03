'use client';

import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import Trans from '~/core/ui/Trans';

import TextField from '~/core/ui/TextField';
import Button from '~/core/ui/Button';
import If from '~/core/ui/If';

function getPasswordStrength(password: string) {
  if (!password) return 0;

  let score = 0;

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  if (score <= 1) return 1;
  if (score <= 2) return 2;
  if (score <= 3) return 3;
  return 4;
}

const strengthColors = [
  '',
  'bg-destructive',
  'bg-warning',
  'bg-info',
  'bg-success',
];

const strengthKeys = [
  '',
  'auth:passwordStrengthWeak',
  'auth:passwordStrengthFair',
  'auth:passwordStrengthGood',
  'auth:passwordStrengthStrong',
];

const EmailPasswordSignUpForm: React.FCC<{
  onSubmit: (params: { email: string; password: string }) => unknown;
  loading: boolean;
}> = ({ onSubmit, loading }) => {
  const { t } = useTranslation('auth');

  const { register, handleSubmit, watch, formState } = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const emailControl = register('email', { required: true });
  const errors = formState.errors;

  const passwordControl = register('password', {
    required: true,
    minLength: {
      value: 8,
      message: t('passwordLengthError'),
    },
  });

  const passwordValue = watch('password');
  const strength = useMemo(
    () => getPasswordStrength(passwordValue),
    [passwordValue],
  );

  return (
    <form className={'w-full'} onSubmit={handleSubmit(onSubmit)}>
      <div className={'flex-col space-y-4'}>
        <TextField>
          <TextField.Label>
            <Trans i18nKey={'common:emailAddress'} />

            <TextField.Input
              {...emailControl}
              data-cy={'email-input'}
              required
              type="email"
              placeholder={t('emailPlaceholder')}
            />
          </TextField.Label>

          <TextField.Error error={errors.email?.message} />
        </TextField>

        <TextField>
          <TextField.Label>
            <Trans i18nKey={'auth:newPassword'} />

            <TextField.Input
              {...passwordControl}
              data-cy={'password-input'}
              required
              type="password"
              placeholder={''}
            />

            {passwordValue.length > 0 && (
              <div className={'mt-2 space-y-1'}>
                <div className={'flex gap-1'}>
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        level <= strength
                          ? strengthColors[strength]
                          : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
                <p className={'text-xs text-muted-foreground'}>
                  <Trans i18nKey={strengthKeys[strength]} />
                </p>
              </div>
            )}

            <TextField.Hint>
              <Trans i18nKey={'auth:passwordHint'} />
            </TextField.Hint>

            <TextField.Error
              data-cy="password-error"
              error={errors.password?.message}
            />
          </TextField.Label>
        </TextField>

        <div>
          <Button
            data-cy={'auth-submit-button'}
            className={'w-full'}
            type="submit"
            loading={loading}
          >
            <If
              condition={loading}
              fallback={<Trans i18nKey={'auth:getStarted'} />}
            >
              <Trans i18nKey={'auth:signingUp'} />
            </If>
          </Button>
        </div>
      </div>
    </form>
  );
};

export default EmailPasswordSignUpForm;
