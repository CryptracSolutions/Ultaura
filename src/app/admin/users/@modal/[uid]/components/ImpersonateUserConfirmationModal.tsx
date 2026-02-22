'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { User } from '@supabase/supabase-js';
import { XMarkIcon } from '@heroicons/react/24/outline';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { Dialog, DialogContent, DialogTitle } from '~/core/ui/Dialog';
import Alert from '~/core/ui/Alert';
import If from '~/core/ui/If';
import Button from '~/core/ui/Button';

import { impersonateUser } from '~/app/admin/users/@modal/[uid]/actions.server';
import useCsrfToken from '~/core/hooks/use-csrf-token';

import ImpersonateUserAuthSetter from '../components/ImpersonateUserAuthSetter';
import PageLoadingIndicator from '~/core/ui/PageLoadingIndicator';

function ImpersonateUserConfirmationModal({
  user,
}: React.PropsWithChildren<{
  user: User;
}>) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const [pending, startTransition] = useTransition();
  const csrfToken = useCsrfToken();
  const [error, setError] = useState<boolean>();

  const [tokens, setTokens] = useState<{
    accessToken: string;
    refreshToken: string;
  }>();

  const displayText = user.email ?? user.phone ?? '';

  const onDismiss = () => {
    router.back();

    setIsOpen(false);
  };

  const onConfirm = () => {
    startTransition(async () => {
      try {
        const response = await impersonateUser({
          userId: user.id,
          csrfToken,
        });

        setTokens(response);
      } catch (e) {
        setError(true);
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onDismiss}>
      <DialogContent
        className="sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
        overlayClassName="bg-black/50 backdrop-blur-none"
      >
        <div className="flex items-start justify-between gap-4">
          <DialogTitle className="text-xl font-semibold truncate">Impersonate User</DialogTitle>
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon">
              <XMarkIcon className="h-5 w-5" />
            </Button>
          </DialogPrimitive.Close>
        </div>

        <If condition={tokens}>
          {(tokens) => {
            return (
              <>
                <ImpersonateUserAuthSetter tokens={tokens} />

                <PageLoadingIndicator>
                  Setting up your session...
                </PageLoadingIndicator>
              </>
            );
          }}
        </If>

        <If condition={error}>
          <Alert type="error">
            <Alert.Heading>Impersonation error</Alert.Heading>
            Sorry, something went wrong. Please check the logs.
          </Alert>
        </If>

        <If condition={!error && !tokens}>
          <div className={'flex flex-col space-y-4'}>
            <div className={'flex flex-col space-y-2 text-sm'}>
              <p>
                You are about to impersonate the account belonging to{' '}
                <b>{displayText}</b> with ID <b>{user.id}</b>.
              </p>

              <p>
                You will be able to log in as them, see and do everything they
                can. To return to your own account, simply log out.
              </p>

              <p>
                Like Uncle Ben said, with great power comes great responsibility.
                Use this power wisely.
              </p>
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
                variant="destructive"
              >
                {pending ? 'Impersonating' : "Yes, let's do it"}
              </Button>
            </div>
          </div>
        </If>
      </DialogContent>
    </Dialog>
  );
}

export default ImpersonateUserConfirmationModal;
