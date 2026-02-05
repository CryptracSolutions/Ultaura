'use client';

import { useCallback, useState, useTransition } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

import Button from '~/core/ui/Button';
import Modal from '~/core/ui/Modal';
import Trans from '~/core/ui/Trans';
import If from '~/core/ui/If';
import { Close as DialogPrimitiveClose } from '@radix-ui/react-dialog';

import { deleteMemberAction } from '~/lib/memberships/actions';

const DeleteInviteButton: React.FCC<{
  membershipId: number;
  memberEmail: string;
}> = ({ membershipId, memberEmail }) => {
  return (
    <Modal
      heading={<Trans i18nKey={'organization:deleteInviteModalHeading'} />}
      Trigger={
        <Button
          variant="ghost"
          size="icon"
          data-cy={'delete-invite-button'}
          aria-label={'Delete Invite'}
        >
          <XMarkIcon className={'h-6'} />
        </Button>
      }
    >
      <DeleteInviteForm membershipId={membershipId} memberEmail={memberEmail} />
    </Modal>
  );
};

function DeleteInviteForm({
  membershipId,
  memberEmail,
}: {
  membershipId: number;
  memberEmail: string;
}) {
  const [isSubmitting, startTransition] = useTransition();
  const [error, setError] = useState<boolean>();

  const onInviteDeleteRequested = useCallback(async () => {
    startTransition(async () => {
      try {
        await deleteMemberAction({ membershipId });
      } catch (e) {
        setError(true);
      }
    });
  }, [membershipId]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onInviteDeleteRequested();
      }}
    >
      <div className={'flex flex-col space-y-4 text-sm'}>
        <p>
          <Trans
            i18nKey={'organization:confirmDeletingMemberInvite'}
            values={{ email: memberEmail }}
            components={{ b: <b /> }}
          />
        </p>

        <p>
          <Trans i18nKey={'common:modalConfirmationQuestion'} />
        </p>

        <If condition={error}>
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <p className="font-medium">
              <Trans i18nKey={'organization:removeMemberErrorHeading'} />
            </p>
            <Trans i18nKey={'organization:removeMemberErrorMessage'} />
          </div>
        </If>

        <div className="flex gap-3 pt-2">
          <DialogPrimitiveClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>
              <Trans i18nKey={'common:cancel'} />
            </Button>
          </DialogPrimitiveClose>

          <Button
            type="submit"
            variant="destructive"
            data-cy={'confirm-delete-invite-button'}
            disabled={isSubmitting}
            loading={isSubmitting}
          >
            <Trans i18nKey={'organization:deleteInviteSubmitLabel'} />
          </Button>
        </div>
      </div>
    </form>
  );
}

export default DeleteInviteButton;
