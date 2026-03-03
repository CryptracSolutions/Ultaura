'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useMutation from 'swr/mutation';
import { toast } from 'sonner';

import UserSession from '~/core/session/types/user-session';
import TextField from '~/core/ui/TextField';
import Trans from '~/core/ui/Trans';
import If from '~/core/ui/If';

import Modal from '~/core/ui/Modal';
import AuthErrorMessage from '~/app/auth/components/AuthErrorMessage';
import useSupabase from '~/core/hooks/use-supabase';

import configuration from '~/configuration';
import { formatToE164, getUsPhoneValidationError } from '~/lib/ultaura/phone';
import PhoneInput from '~/components/ultaura/PhoneInput';
import Button from '~/core/ui/Button';

interface UpdatePhoneNumberFormProps {
  session: UserSession;
  onUpdate: (phoneNumber: Maybe<string>) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onRegisterReset?: (handler: () => void) => void;
}

function UpdatePhoneNumberForm({
  session,
  onUpdate,
  onDirtyChange,
  onRegisterReset,
}: UpdatePhoneNumberFormProps) {
  const { trigger, isMutating } = useUpdatePhoneNumber();
  const { t } = useTranslation();
  const currentPhoneNumber = session.auth?.user?.phone ?? '';
  const [phoneNumber, setPhoneNumber] = useState(currentPhoneNumber);
  const [phoneError, setPhoneError] = useState<string | undefined>(undefined);
  const hasChanges = phoneNumber !== currentPhoneNumber;

  const resetForm = useCallback(() => {
    setPhoneNumber(currentPhoneNumber);
    setPhoneError(undefined);
  }, [currentPhoneNumber]);

  useEffect(() => {
    resetForm();
  }, [currentPhoneNumber, resetForm]);

  useEffect(() => {
    onDirtyChange?.(hasChanges);
  }, [hasChanges, onDirtyChange]);

  useEffect(() => {
    onRegisterReset?.(resetForm);
  }, [onRegisterReset, resetForm]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!hasChanges) return;

        const validationError = getUsPhoneValidationError(phoneNumber, {
          required: false,
        });
        if (validationError) {
          setPhoneError(validationError);
          return;
        }

        const normalized = phoneNumber.trim()
          ? formatToE164(phoneNumber)
          : phoneNumber;

        const promise = trigger(normalized).then(() => {
          onUpdate(normalized);
        });

        return toast.promise(promise, {
          loading: t(`profile:updatePhoneNumberLoading`),
          success: t(`profile:updatePhoneNumberSuccess`),
          error: t(`profile:updatePhoneNumberError`),
        });
      }}
      data-cy={'update-phone-number-form'}
    >
      <div className={'flex flex-col space-y-4'}>
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
              onBlur={(event) => {
                setPhoneError(
                  getUsPhoneValidationError(event.target.value, {
                    required: false,
                  }) ?? undefined,
                );
              }}
              error={phoneError}
            />
            <TextField.Error error={phoneError} />
          </TextField.Label>

          {/* Only show this if phone number is enabled */}
          <If condition={configuration.auth.providers.phoneNumber}>
            <div>
              <If condition={currentPhoneNumber}>
                <RemovePhoneNumberButton
                  onSuccess={() => {
                    onUpdate(undefined);
                  }}
                />
              </If>
            </div>
          </If>
        </TextField>

        <div className={'flex flex-col gap-3 md:flex-row'}>
          <Button
            variant="default"
            size="small"
            disabled={!hasChanges || isMutating}
            loading={isMutating}
          >
            <Trans i18nKey={'profile:updatePhoneNumber'} />
          </Button>
          <Button
            type={'button'}
            variant="outline"
            size="small"
            onClick={resetForm}
            disabled={!hasChanges || isMutating}
          >
            Discard
          </Button>
        </div>
      </div>
    </form>
  );
}

export default UpdatePhoneNumberForm;

function RemovePhoneNumberButton({
  onSuccess,
}: React.PropsWithChildren<{
  onSuccess: () => void;
}>) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { t } = useTranslation();
  const { trigger, error, isMutating } = useUpdatePhoneNumber();

  const onUnlinkPhoneNumber = useCallback(() => {
    const promise = trigger('').then(() => {
      setIsModalOpen(false);
      onSuccess();
    });

    return toast.promise(promise, {
      loading: t(`profile:unlinkActionLoading`),
      success: t(`profile:unlinkActionSuccess`),
      error: t(`profile:unlinkActionError`),
    });
  }, [trigger, t, onSuccess]);

  return (
    <>
      <Button
        type={'button'}
        variant="outline"
        size="small"
        onClick={() => setIsModalOpen(true)}
      >
        <span className={'text-xs font-normal'}>
          <Trans i18nKey={'profile:removePhoneNumber'} />
        </span>
      </Button>

      <Modal
        heading={<Trans i18nKey={'profile:removePhoneNumber'} />}
        isOpen={isModalOpen}
        setIsOpen={setIsModalOpen}
      >
        <div className={'flex flex-col space-y-2.5 text-sm'}>
          <div>
            <Trans i18nKey={'profile:confirmRemovePhoneNumberDescription'} />
          </div>

          <div>
            <Trans i18nKey={'common:modalConfirmationQuestion'} />
          </div>

          <AuthErrorMessage error={error} />

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="small"
              onClick={() => setIsModalOpen(false)}
              disabled={isMutating}
            >
              <Trans i18nKey={'common:cancel'} />
            </Button>

            <Button
              type="button"
              variant="destructive"
              size="small"
              onClick={onUnlinkPhoneNumber}
              disabled={isMutating}
              loading={isMutating}
            >
              <Trans i18nKey={'profile:confirmRemovePhoneNumber'} />
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function useUpdatePhoneNumber() {
  const client = useSupabase();
  const key = 'useUpdatePhoneNumber';

  return useMutation(key, async (_, { arg: phone }: { arg: string }) => {
    return client.auth.updateUser({ phone }).then((response) => {
      if (response.error) {
        throw response.error;
      }

      return response.data;
    });
  });
}
