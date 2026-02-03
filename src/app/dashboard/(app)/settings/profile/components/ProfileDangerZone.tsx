'use client';

import { useFormStatus } from 'react-dom';
import { Close as DialogPrimitiveClose } from '@radix-ui/react-dialog';

import Modal from '~/core/ui/Modal';
import Heading from '~/core/ui/Heading';
import { TextFieldInput, TextFieldLabel } from '~/core/ui/TextField';
import Trans from '~/core/ui/Trans';
import ErrorBoundary from '~/core/ui/ErrorBoundary';
import { deleteUserAccountAction } from '~/lib/user/actions.server';
import {
  COMPACT_DESTRUCTIVE_BUTTON_CLASS,
  COMPACT_OUTLINE_BUTTON_CLASS,
} from '~/app/dashboard/(app)/components/compact-action-classes';

function ProfileDangerZone() {
  return <DeleteProfileContainer />;
}

export default ProfileDangerZone;

function DeleteProfileContainer() {
  return (
    <div className={'flex flex-col space-y-4'}>
      <div className={'flex flex-col space-y-1'}>
        <Heading type={6}>
          <Trans i18nKey={'profile:deleteAccount'} />
        </Heading>

        <p className={'text-gray-500 text-sm'}>
          <Trans i18nKey={'profile:deleteAccountDescription'} />
        </p>
      </div>

      <div>
        <DeleteProfileModal />
      </div>
    </div>
  );
}

function DeleteProfileModal() {
  return (
    <Modal
      heading={<Trans i18nKey={'profile:deleteAccount'} />}
      Trigger={
        <button
          data-cy={'delete-account-button'}
          className={COMPACT_DESTRUCTIVE_BUTTON_CLASS}
        >
          <Trans i18nKey={'profile:deleteAccount'} />
        </button>
      }
    >
      <ErrorBoundary fallback={<DeleteProfileErrorAlert />}>
        <DeleteProfileForm />
      </ErrorBoundary>
    </Modal>
  );
}

function DeleteProfileForm() {
  return (
    <form
      action={deleteUserAccountAction}
      className={'flex flex-col space-y-4'}
    >
      <div className={'flex flex-col space-y-6'}>
        <div className={'border-2 border-red-500 p-4 text-sm text-red-500'}>
          <div className={'flex flex-col space-y-2'}>
            <div>
              <Trans i18nKey={'profile:deleteAccountDescription'} />
            </div>

            <div>
              <Trans i18nKey={'common:modalConfirmationQuestion'} />
            </div>
          </div>
        </div>

        <TextFieldLabel>
          <Trans i18nKey={'profile:deleteProfileConfirmationInputLabel'} />

          <TextFieldInput
            data-cy={'delete-account-input-field'}
            required
            type={'text'}
            className={'w-full'}
            placeholder={''}
            pattern={`DELETE`}
          />
        </TextFieldLabel>
      </div>

      <DeleteAccountActions />
    </form>
  );
}

function DeleteAccountSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      data-cy={'confirm-delete-account-button'}
      name={'action'}
      value={'delete'}
      type="submit"
      disabled={pending}
      className={COMPACT_DESTRUCTIVE_BUTTON_CLASS}
    >
      {pending ? (
        <>
          <span className="w-3 h-3 block animate-spin rounded-full border-2 border-current border-t-transparent" />
          <Trans i18nKey={'profile:deleteAccount'} />
        </>
      ) : (
        <Trans i18nKey={'profile:deleteAccount'} />
      )}
    </button>
  );
}

function DeleteProfileErrorAlert() {
  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <p className="font-medium">
        <Trans i18nKey={'profile:deleteAccountErrorHeading'} />
      </p>
      <Trans i18nKey={'common:genericError'} />
    </div>
  );
}

function DeleteAccountActions() {
  const { pending } = useFormStatus();

  return (
    <div className="flex gap-3 pt-2">
      <DialogPrimitiveClose asChild>
        <button
          type="button"
          disabled={pending}
          className={COMPACT_OUTLINE_BUTTON_CLASS}
        >
          <Trans i18nKey={'common:cancel'} />
        </button>
      </DialogPrimitiveClose>

      <DeleteAccountSubmitButton />
    </div>
  );
}
