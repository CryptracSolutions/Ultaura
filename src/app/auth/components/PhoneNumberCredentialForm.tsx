'use client';

import type { FormEventHandler } from 'react';
import { useCallback, useState } from 'react';

import If from '~/core/ui/If';
import TextField from '~/core/ui/TextField';
import Button from '~/core/ui/Button';
import Trans from '~/core/ui/Trans';

import PhoneInput from '~/components/ultaura/PhoneInput';
import { formatToE164, getUsPhoneValidationError } from '~/lib/ultaura/phone';

type ActionTypes = `link` | `signIn` | `signUp`;

const PhoneNumberCredentialForm: React.FC<{
  onSubmit: (phoneNumber: string) => void;
  action: ActionTypes;
  loading?: boolean;
}> = ({ onSubmit, action, loading }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState<string | undefined>(undefined);

  const onFormSubmit: FormEventHandler<HTMLFormElement> = useCallback(
    (event) => {
      event.preventDefault();

      const validationError = getUsPhoneValidationError(phoneNumber, {
        required: true,
      });

      if (validationError) {
        setPhoneError(validationError);
        return;
      }

      const e164 = formatToE164(phoneNumber);
      onSubmit(e164);
    },
    [onSubmit, phoneNumber],
  );

  return (
    <form className={'w-full'} onSubmit={onFormSubmit}>
      <div className={'flex flex-col space-y-2'}>
        <TextField>
          <TextField.Label>
            <Trans i18nKey={'profile:phoneNumberLabel'} />

            <PhoneInput
              name={'phoneNumber'}
              value={phoneNumber}
              onValueChange={(value) => {
                setPhoneNumber(value);
                if (phoneError) {
                  setPhoneError(undefined);
                }
              }}
              placeholder={'(555) 123-4567'}
              disabled={loading}
              error={phoneError}
            />
            <TextField.Error error={phoneError} />
          </TextField.Label>
        </TextField>

        <Button
          loading={loading}
          block
          type={'submit'}
          variant={'custom'}
          className={
            'relative border border-gray-200 text-gray-600 ring-ring ring-offset-1 transition-all hover:border-gray-300 hover:bg-gray-50 focus:ring-2 active:bg-gray-100 dark:border-dark-700 dark:bg-background/90 dark:text-gray-200 dark:ring-ring dark:hover:border-dark-600 dark:hover:bg-background/50 dark:focus:ring-offset-dark-800 dark:active:bg-background/80'
          }
        >
          <If condition={action === 'link'}>
            <Trans i18nKey={'profile:verifyPhoneNumberSubmitLabel'} />
          </If>

          <If condition={action === 'signIn'}>
            <Trans i18nKey={'auth:signInWithPhoneNumber'} />
          </If>

          <If condition={action === 'signUp'}>
            <Trans i18nKey={'auth:signUpWithPhoneNumber'} />
          </If>
        </Button>
      </div>
    </form>
  );
};

export default PhoneNumberCredentialForm;
