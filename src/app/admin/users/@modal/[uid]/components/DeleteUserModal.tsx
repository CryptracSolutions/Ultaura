'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { User } from '@supabase/supabase-js';
import { XMarkIcon } from '@heroicons/react/24/outline';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { Dialog, DialogContent, DialogTitle } from '~/core/ui/Dialog';
import { deleteUserAction } from '~/app/admin/users/@modal/[uid]/actions.server';
import { TextFieldInput, TextFieldLabel } from '~/core/ui/TextField';
import Button from '~/core/ui/Button';

function DeleteUserModal({
  user,
}: React.PropsWithChildren<{
  user: User;
}>) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const [pending, startTransition] = useTransition();
  const displayText = user.email ?? user.phone ?? '';

  const onDismiss = () => {
    router.back();

    setIsOpen(false);
  };

  const onConfirm = () => {
    startTransition(async () => {
      await deleteUserAction({
        userId: user.id,
      });

      onDismiss();
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onDismiss}>
      <DialogContent
        className="sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
        overlayClassName="bg-black/50 backdrop-blur-none"
      >
        <div className="flex items-start justify-between gap-4">
          <DialogTitle className="text-xl font-semibold truncate">Deleting User</DialogTitle>
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon">
              <XMarkIcon className="h-5 w-5" />
            </Button>
          </DialogPrimitive.Close>
        </div>

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

            <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row">
              <Button
                type="button"
                onClick={onDismiss}
                disabled={pending}
                variant="outline"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                loading={pending}
                variant="destructive"
              >
                {pending ? 'Deleting' : 'Yes, delete user'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default DeleteUserModal;
