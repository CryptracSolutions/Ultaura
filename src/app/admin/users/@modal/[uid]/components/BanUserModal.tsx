'use client';

import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { XMarkIcon } from '@heroicons/react/24/outline';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { banUser } from '~/app/admin/users/@modal/[uid]/actions.server';

import { Dialog, DialogContent, DialogTitle } from '~/core/ui/Dialog';
import Alert from '~/core/ui/Alert';
import useCsrfToken from '~/core/hooks/use-csrf-token';
import { TextFieldInput, TextFieldLabel } from '~/core/ui/TextField';
import ErrorBoundary from '~/core/ui/ErrorBoundary';
import Button from '~/core/ui/Button';

function BanUserModal({
  user,
}: React.PropsWithChildren<{
  user: User;
}>) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const csrfToken = useCsrfToken();
  const displayText = user.email ?? user.phone ?? '';

  const onDismiss = () => {
    router.back();

    setIsOpen(false);
  };

  const onConfirm = async () => {
    await banUser({
      userId: user.id,
      csrfToken,
    });

    onDismiss();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onDismiss}>
      <DialogContent
        className="sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
        overlayClassName="bg-black/50 backdrop-blur-none"
      >
        <div className="flex items-start justify-between gap-4">
          <DialogTitle className="text-xl font-semibold truncate">Ban User</DialogTitle>
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon">
              <XMarkIcon className="h-5 w-5" />
            </Button>
          </DialogPrimitive.Close>
        </div>

        <ErrorBoundary fallback={<BanErrorAlert />}>
          <form action={onConfirm}>
            <div className={'flex flex-col space-y-4'}>
              <div className={'flex flex-col space-y-2 text-sm'}>
                <p>
                  You are about to ban <b>{displayText}</b>.
                </p>

                <p>
                  You can unban them later, but they will not be able to log in or
                  use their account until you do.
                </p>

                <TextFieldLabel>
                  Type <b>BAN</b> to confirm
                  <TextFieldInput type="text" required pattern={'BAN'} />
                </TextFieldLabel>

                <p>Are you sure you want to do this?</p>
              </div>

              <BanUserActions onDismiss={onDismiss} />
            </div>
          </form>
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      loading={pending}
      variant="destructive"
    >
      {pending ? 'Banning' : 'Yes, ban user'}
    </Button>
  );
}

export default BanUserModal;

function BanErrorAlert() {
  return (
    <Alert type="error">
      <Alert.Heading>There was an error banning this user.</Alert.Heading>
      Check the logs for more information.
    </Alert>
  );
}

function BanUserActions({ onDismiss }: { onDismiss: () => void }) {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row">
      <Button
        type="button"
        onClick={onDismiss}
        disabled={pending}
        variant="outline"
      >
        Cancel
      </Button>

      <SubmitButton />
    </div>
  );
}
