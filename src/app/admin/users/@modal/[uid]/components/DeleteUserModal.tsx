'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { User } from '@supabase/supabase-js';

import Modal from '~/core/ui/Modal';
import { deleteUserAction } from '~/app/admin/users/@modal/[uid]/actions.server';
import useCsrfToken from '~/core/hooks/use-csrf-token';
import { TextFieldInput, TextFieldLabel } from '~/core/ui/TextField';
import {
  modalDestructiveButtonClass,
  modalSecondaryButtonClass,
} from '~/core/ui/modal-button-classes';

function DeleteUserModal({
  user,
}: React.PropsWithChildren<{
  user: User;
}>) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const [pending, startTransition] = useTransition();
  const csrfToken = useCsrfToken();
  const displayText = user.email ?? user.phone ?? '';

  const onDismiss = () => {
    router.back();

    setIsOpen(false);
  };

  const onConfirm = () => {
    startTransition(async () => {
      await deleteUserAction({
        userId: user.id,
        csrfToken,
      });

      onDismiss();
    });
  };

  return (
    <Modal heading={'Deleting User'} isOpen={isOpen} setIsOpen={onDismiss}>
      <form action={onConfirm}>
        <div className={'flex flex-col space-y-4'}>
          <div className={'flex flex-col space-y-2 text-sm'}>
            <p>
              You are about to delete the user <b>{displayText}</b>.
            </p>

            <p>
              Delete this user will also delete the organizations they are a
              Owner of, and potentially the data associated with those
              organizations.
            </p>

            <p>
              <b>This action is not reversible</b>.
            </p>

            <p>Are you sure you want to do this?</p>
          </div>

          <div>
            <TextFieldLabel>
              Confirm by typing <b>DELETE</b>
              <TextFieldInput required type={'text'} pattern={'DELETE'} />
            </TextFieldLabel>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onDismiss}
              disabled={pending}
              className={modalSecondaryButtonClass}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={pending}
              className={modalDestructiveButtonClass}
            >
              {pending ? (
                <>
                  <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Deleting
                </>
              ) : (
                'Yes, delete user'
              )}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default DeleteUserModal;
