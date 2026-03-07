'use client';

import { useFormStatus } from 'react-dom';
import { Close as DialogPrimitiveClose } from '@radix-ui/react-dialog';

import Modal from '~/core/ui/Modal';
import Heading from '~/core/ui/Heading';
import Button from '~/core/ui/Button';
import { TextFieldInput, TextFieldLabel } from '~/core/ui/TextField';
import Trans from '~/core/ui/Trans';
import ErrorBoundary from '~/core/ui/ErrorBoundary';
import { deleteUserAccountAction } from '~/lib/user/actions.server';

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

      <div className={'flex justify-end'}>
        <DeleteProfileModal />
      </div>
    </div>
  );
}

function DeleteProfileModal() {
  return (
    <Modal
      heading="Delete your account"
      Trigger={
        <Button
          data-cy={'delete-account-button'}
          variant="destructive"
          size="small"
          className="w-full sm:w-auto"
        >
          <Trans i18nKey={'profile:deleteAccount'} />
        </Button>
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
        <div className={'flex flex-col space-y-2 text-sm text-red-500'}>
          <div>
            <Trans i18nKey={'profile:deleteAccountDescription'} />
          </div>

          <div>
            <Trans i18nKey={'common:modalConfirmationQuestion'} />
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
    <Button
      data-cy={'confirm-delete-account-button'}
      name={'action'}
      value={'delete'}
      type="submit"
      disabled={pending}
      loading={pending}
      variant="destructive"
      size="small"
      className="w-full"
    >
      Delete your account
    </Button>
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
    <div className="flex flex-col gap-3 pt-4 sm:flex-row">
      <DialogPrimitiveClose asChild>
        <Button
          type="button"
          disabled={pending}
          variant="outline"
          size="small"
          className="w-full"
        >
          <Trans i18nKey={'common:cancel'} />
        </Button>
      </DialogPrimitiveClose>

      <DeleteAccountSubmitButton />
    </div>
  );
}
