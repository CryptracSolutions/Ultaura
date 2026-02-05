'use client';

import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { useState } from 'react';
import type { User } from '@supabase/supabase-js';

import { banUser } from '~/app/admin/users/@modal/[uid]/actions.server';

import Modal from '~/core/ui/Modal';
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
    <Modal heading={'Ban User'} isOpen={isOpen} setIsOpen={onDismiss}>
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
    </Modal>
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
    <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <p className="font-medium">There was an error banning this user.</p>
      Check the logs for more information.
    </div>
  );
}

function BanUserActions({ onDismiss }: { onDismiss: () => void }) {
  const { pending } = useFormStatus();

  return (
    <div className="flex gap-3 pt-2">
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
