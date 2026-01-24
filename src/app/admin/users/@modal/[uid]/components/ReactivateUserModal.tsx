'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { User } from '@supabase/supabase-js';

import Modal from '~/core/ui/Modal';
import { reactivateUser } from '~/app/admin/users/@modal/[uid]/actions.server';
import useCsrfToken from '~/core/hooks/use-csrf-token';
import {
  modalPrimaryButtonClass,
  modalSecondaryButtonClass,
} from '~/core/ui/modal-button-classes';

function ReactivateUserModal({
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
      await reactivateUser({
        userId: user.id,
        csrfToken,
      });

      onDismiss();
    });
  };

  return (
    <Modal heading={'Reactivate User'} isOpen={isOpen} setIsOpen={onDismiss}>
      <div className={'flex flex-col space-y-4'}>
        <div className={'flex flex-col space-y-2 text-sm'}>
          <p>
            You are about to reactivate the account belonging to{' '}
            <b>{displayText}</b>.
          </p>

          <p>Are you sure you want to do this?</p>
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
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={modalPrimaryButtonClass}
          >
            {pending ? (
              <>
                <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                Reactivating
              </>
            ) : (
              'Yes, reactivate user'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default ReactivateUserModal;
