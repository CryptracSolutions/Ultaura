'use client';

import { useCallback, useState } from 'react';
import type { User } from '@supabase/supabase-js';

import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';

import useUpdateUserMutation from '~/core/hooks/use-update-user-mutation';

import TextField from '~/core/ui/TextField';
import Alert from '~/core/ui/Alert';
import If from '~/core/ui/If';
import Trans from '~/core/ui/Trans';

import configuration from '~/configuration';
import { useLeavePageGuard } from '~/core/hooks/use-leave-page-guard';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import {
  COMPACT_OUTLINE_BUTTON_CLASS,
  COMPACT_PRIMARY_BUTTON_CLASS,
} from '~/app/dashboard/(app)/components/compact-action-classes';

const UpdatePasswordForm = ({ user }: { user: User }) => {
  const { t } = useTranslation();
  const updateUserMutation = useUpdateUserMutation();
  const [needsReauthentication, setNeedsReauthentication] = useState(false);

  const { register, handleSubmit, reset, getValues, formState } = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      repeatPassword: '',
    },
  });

  const errors = formState.errors;

  const newPasswordControl = register('newPassword', {
    value: '',
    required: true,
    minLength: {
      value: 6,
      message: t(`auth:passwordLengthError`),
    },
    validate: (value) => {
      // current password cannot be the same as the current one
      if (value === getValues('currentPassword')) {
        return t(`profile:passwordNotChanged`);
      }
    },
  });

  const repeatPasswordControl = register('repeatPassword', {
    value: '',
    required: true,
    minLength: {
      value: 6,
      message: t(`profile:passwordLengthError`),
    },
    validate: (value) => {
      // new password and repeat new password must match
      if (value !== getValues('newPassword')) {
        return t(`profile:passwordNotMatching`);
      }
    },
  });

  const updatePasswordFromCredential = useCallback(
    (password: string) => {
      const redirectTo = [
        window.location.origin,
        configuration.paths.authCallback,
      ].join('');

      const promise = updateUserMutation
        .trigger({ password, redirectTo })
        .then(() => {
          reset();
        })
        .catch((error) => {
          if (error.includes('Password update requires reauthentication')) {
            setNeedsReauthentication(true);
          }
        });

      toast.promise(promise, {
        success: t(`profile:updatePasswordSuccess`),
        error: t(`profile:updatePasswordError`),
        loading: t(`profile:updatePasswordLoading`),
      });
    },
    [updateUserMutation, t, reset],
  );

  const updatePasswordCallback = useCallback(
    async ({ newPassword }: { newPassword: string }) => {
      const email = user.email;

      // if the user does not have an email assigned, it's possible they
      // don't have an email/password factor linked, and the UI is out of sync
      if (!email) {
        return Promise.reject(t(`profile:cannotUpdatePassword`));
      }

      updatePasswordFromCredential(newPassword);
    },
    [user.email, updatePasswordFromCredential, t],
  );

  const { isMutating, data } = updateUserMutation;
  const hasChanges = formState.isDirty;
  const shouldWarnOnNavigate = hasChanges && !isMutating;
  const resetForm = useCallback(() => {
    reset();
    setNeedsReauthentication(false);
  }, [reset]);
  const { dialogProps } = useLeavePageGuard({
    isDirty: shouldWarnOnNavigate,
    onDiscard: resetForm,
  });

  return (
    <form
      data-cy={'update-password-form'}
      onSubmit={handleSubmit(updatePasswordCallback)}
    >
      <div className={'flex flex-col space-y-4'}>
        <If condition={data}>
          <Alert type={'success'}>
            <Alert.Heading>
              <Trans i18nKey={'profile:updatePasswordSuccess'} />
            </Alert.Heading>

            <Trans i18nKey={'profile:updatePasswordSuccessMessage'} />
          </Alert>
        </If>

        <If condition={needsReauthentication}>
          <Alert type={'warn'}>
            <Alert.Heading>
              <Trans i18nKey={'profile:needsReauthentication'} />
            </Alert.Heading>

            <Trans i18nKey={'profile:needsReauthenticationDescription'} />
          </Alert>
        </If>

        <TextField>
          <TextField.Label>
            <Trans i18nKey={'profile:newPassword'} />

            <TextField.Input
              data-cy={'new-password'}
              required
              type={'password'}
              {...newPasswordControl}
            />

            <TextField.Error
              data-cy={'new-password-error'}
              error={errors.newPassword?.message}
            />
          </TextField.Label>
        </TextField>

        <TextField>
          <TextField.Label>
            <Trans i18nKey={'profile:repeatPassword'} />

            <TextField.Input
              data-cy={'repeat-new-password'}
              required
              type={'password'}
              {...repeatPasswordControl}
            />

            <TextField.Error
              data-cy={'repeat-password-error'}
              error={errors.repeatPassword?.message}
            />
          </TextField.Label>
        </TextField>

        <div>
          <div className={'flex flex-col gap-3 md:flex-row'}>
            <button
              type={'button'}
              className={COMPACT_OUTLINE_BUTTON_CLASS}
              onClick={resetForm}
              disabled={!hasChanges || isMutating}
            >
              Discard changes
            </button>
            <button
              className={COMPACT_PRIMARY_BUTTON_CLASS}
              disabled={!hasChanges || isMutating}
            >
              {isMutating ? (
                <>
                  <span className="w-3 h-3 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <Trans i18nKey={'profile:updatePasswordSubmitLabel'} />
                </>
              ) : (
                <Trans i18nKey={'profile:updatePasswordSubmitLabel'} />
              )}
            </button>
          </div>
        </div>
      </div>

      <ConfirmationDialog
        open={dialogProps.open}
        onOpenChange={dialogProps.onOpenChange}
        title="Unsaved changes"
        description="You have unsaved changes. Leave without saving?"
        confirmLabel="Discard & leave"
        cancelLabel="Stay here"
        variant="default"
        onConfirm={dialogProps.onConfirm}
      />
    </form>
  );
};

export default UpdatePasswordForm;
