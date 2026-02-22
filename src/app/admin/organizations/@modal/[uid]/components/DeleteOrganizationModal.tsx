'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { XMarkIcon } from '@heroicons/react/24/outline';

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '~/core/ui/Dialog';
import useCsrfToken from '~/core/hooks/use-csrf-token';
import { TextFieldInput, TextFieldLabel } from '~/core/ui/TextField';
import Organization from '~/lib/organizations/types/organization';
import { deleteOrganizationAction } from '~/app/admin/organizations/@modal/[uid]/actions.server';
import Button from '~/core/ui/Button';

function DeleteOrganizationModal({
  organization,
}: React.PropsWithChildren<{
  organization: Organization;
}>) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const [pending, startTransition] = useTransition();
  const csrfToken = useCsrfToken();

  const onDismiss = () => {
    router.back();
    setIsOpen(false);
  };

  const onConfirm = () => {
    startTransition(async () => {
      await deleteOrganizationAction({
        id: organization.id,
        csrfToken,
      });

      onDismiss();
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onDismiss}>
      <DialogContent className="sm:max-w-[468px] max-h-[85vh] overflow-y-auto" overlayClassName="bg-black/50 backdrop-blur-none">
        <div className="flex items-start justify-between gap-4">
          <DialogTitle className="text-xl font-semibold truncate">Deleting Organization</DialogTitle>
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon">
              <XMarkIcon className="h-5 w-5" />
            </Button>
          </DialogPrimitive.Close>
        </div>

        <form action={onConfirm}>
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col space-y-2 text-sm">
              <p>
                You are about to delete the organization{' '}
                <b>{organization.name}</b>.
              </p>

              <p>
                Delete this organization will potentially delete the data
                associated with it.
              </p>

              <p>
                <b>This action is not reversible</b>.
              </p>

              <p>Are you sure you want to do this?</p>
            </div>

            <div>
              <TextFieldLabel>
                Confirm by typing <b>DELETE</b>
                <TextFieldInput required type="text" pattern="DELETE" />
              </TextFieldLabel>
            </div>

            <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row">
              <Button
                type="button"
                onClick={onDismiss}
                disabled={pending}
                variant="outline"
                className="w-full"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                loading={pending}
                variant="destructive"
                className="w-full"
              >
                {pending ? 'Deleting' : 'Yes, delete organization'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default DeleteOrganizationModal;
