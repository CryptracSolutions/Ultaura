'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { User } from '@supabase/supabase-js';
import { XMarkIcon } from '@heroicons/react/24/outline';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { Dialog, DialogContent, DialogTitle } from '~/core/ui/Dialog';
import { reactivateUser } from '~/app/admin/users/@modal/[uid]/actions.server';
import useCsrfToken from '~/core/hooks/use-csrf-token';
import Button from '~/core/ui/Button';

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
    <Dialog open={isOpen} onOpenChange={onDismiss}>
      <DialogContent
        className="sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
        overlayClassName="bg-black/50 backdrop-blur-none"
      >
        <div className="flex items-start justify-between gap-4">
          <DialogTitle className="text-xl font-semibold truncate">Reactivate User</DialogTitle>
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon">
              <XMarkIcon className="h-5 w-5" />
            </Button>
          </DialogPrimitive.Close>
        </div>

        <div className={'flex flex-col space-y-4'}>
          <div className={'flex flex-col space-y-2 text-sm'}>
            <p>
              You are about to reactivate the account belonging to{' '}
              <b>{displayText}</b>.
            </p>

            <p>Are you sure you want to do this?</p>
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
              type="button"
              onClick={onConfirm}
              loading={pending}
              variant="default"
            >
              {pending ? 'Reactivating' : 'Yes, reactivate user'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ReactivateUserModal;
