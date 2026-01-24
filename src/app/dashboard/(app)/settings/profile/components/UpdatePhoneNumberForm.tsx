'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useMutation from 'swr/mutation';
import { toast } from 'sonner';

import UserSession from '~/core/session/types/user-session';
import TextField from '~/core/ui/TextField';
import Trans from '~/core/ui/Trans';
import If from '~/core/ui/If';

import Button from '~/core/ui/Button';
import Modal from '~/core/ui/Modal';
import AuthErrorMessage from '~/app/auth/components/AuthErrorMessage';
import useSupabase from '~/core/hooks/use-supabase';
import {
  modalDestructiveButtonClass,
  modalSecondaryButtonClass,
} from '~/core/ui/modal-button-classes';

import configuration from '~/configuration';

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
  const hasChanges = phoneNumber !== currentPhoneNumber;

  const resetForm = useCallback(() => {
    setPhoneNumber(currentPhoneNumber);
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

        const promise = trigger(phoneNumber).then(() => {
          onUpdate(phoneNumber);
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

            <TextField.Input
              name={'phoneNumber'}
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
            />
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
            type={'button'}
            variant={'outline'}
            className={'w-full md:w-auto'}
            onClick={resetForm}
            disabled={!hasChanges || isMutating}
          >
            Discard changes
          </Button>
          <Button loading={isMutating} disabled={!hasChanges || isMutating}>
            <Trans i18nKey={'profile:updatePhoneNumber'} />
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
        variant={'ghost'}
        size={'small'}
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
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={isMutating}
              className={modalSecondaryButtonClass}
            >
              <Trans i18nKey={'common:cancel'} />
            </button>

            <button
              type="button"
              onClick={onUnlinkPhoneNumber}
              disabled={isMutating}
              className={modalDestructiveButtonClass}
            >
              {isMutating ? (
                <>
                  <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <Trans i18nKey={'profile:confirmRemovePhoneNumber'} />
                </>
              ) : (
                <Trans i18nKey={'profile:confirmRemovePhoneNumber'} />
              )}
            </button>
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
