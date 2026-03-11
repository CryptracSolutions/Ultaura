'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useMutation from 'swr/mutation';
import { toast } from 'sonner';

import UserSession from '~/core/session/types/user-session';
import TextField from '~/core/ui/TextField';
import Trans from '~/core/ui/Trans';
import If from '~/core/ui/If';

import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
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
  const showRemovePhoneSection =
    configuration.auth.providers.phoneNumber && Boolean(currentPhoneNumber) && !hasChanges;

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
          <p className="text-sm text-muted-foreground">
            <Trans i18nKey={'profile:phoneNumberHelperText'} />
          </p>
        </TextField>

        <div className={'flex flex-col gap-3 md:flex-row'}>
          <Button
            size="small"
            disabled={!hasChanges || isMutating}
            loading={isMutating}
          >
            <Trans
              i18nKey={
                currentPhoneNumber
                  ? 'profile:updatePhoneNumber'
                  : 'profile:addPhoneNumber'
              }
            />
          </Button>
          <Button
            type={'button'}
            size="small"
            onClick={resetForm}
            disabled={!hasChanges || isMutating}
          >
            Discard
          </Button>
        </div>

        <If condition={showRemovePhoneSection}>
          <div className="border-t border-border pt-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  <Trans i18nKey={'profile:removePhoneNumber'} />
                </p>
                <p className="text-sm text-muted-foreground">
                  <Trans i18nKey={'profile:removePhoneNumberSectionDescription'} />
                </p>
              </div>

              <RemovePhoneNumberButton
                onSuccess={() => {
                  onUpdate(undefined);
                }}
              />
            </div>
          </div>
        </If>
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
  const { trigger, isMutating } = useUpdatePhoneNumber();

  const onUnlinkPhoneNumber = useCallback(async () => {
    const promise = trigger('').then(() => {
      onSuccess();
    });

    toast.promise(promise, {
      loading: t(`profile:unlinkActionLoading`),
      success: t(`profile:unlinkActionSuccess`),
      error: t(`profile:unlinkActionError`),
    });

    await promise;
  }, [trigger, t, onSuccess]);

  return (
    <>
      <Button
        type={'button'}
        variant="destructive"
        size="small"
        onClick={() => setIsModalOpen(true)}
      >
        <span className={'text-xs font-normal'}>
          <Trans i18nKey={'profile:removePhoneNumber'} />
        </span>
      </Button>

      <ConfirmationDialog
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title={t('profile:removePhoneNumber')}
        description={t('profile:confirmRemovePhoneNumberDescription')}
        confirmLabel={t('profile:confirmRemovePhoneNumber')}
        cancelLabel={t('common:cancel')}
        variant="destructive"
        onConfirm={onUnlinkPhoneNumber}
      />
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
