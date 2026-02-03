'use client';

import { useCallback, useState, useTransition } from 'react';

import Trans from '~/core/ui/Trans';
import Modal from '~/core/ui/Modal';
import If from '~/core/ui/If';
import {
  COMPACT_DESTRUCTIVE_BUTTON_CLASS,
  COMPACT_OUTLINE_BUTTON_CLASS,
} from '~/app/dashboard/(app)/components/compact-action-classes';

import { transferOrganizationOwnershipAction } from '~/lib/organizations/actions';
import useCurrentOrganization from '~/lib/organizations/hooks/use-current-organization';

const TransferOrganizationOwnershipModal: React.FC<{
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  membershipId: number;
  targetDisplayName: string;
}> = ({ isOpen, setIsOpen, targetDisplayName, membershipId }) => {
  return (
    <Modal
      heading={<Trans i18nKey="organization:transferOwnership" />}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
    >
      <TransferOrganizationOwnershipForm
        membershipId={membershipId}
        targetDisplayName={targetDisplayName}
        setIsOpen={setIsOpen}
      />
    </Modal>
  );
};

function TransferOrganizationOwnershipForm({
  membershipId,
  targetDisplayName,
  setIsOpen,
}: {
  membershipId: number;
  targetDisplayName: string;
  setIsOpen: (isOpen: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<boolean>();
  const organization = useCurrentOrganization();
  const organizationUid = organization?.uuid ?? '';

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      startTransition(async () => {
        try {
          await transferOrganizationOwnershipAction({
            membershipId,
            organizationUid,
          });

          setIsOpen(false);
        } catch (error) {
          setError(true);
        }
      });
    },
    [membershipId, organizationUid, setIsOpen],
  );

  return (
    <form className={'flex flex-col space-y-6 text-sm'} onSubmit={onSubmit}>
      <If condition={error}>
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p className="font-medium">
            <Trans i18nKey={'organization:transferOrganizationErrorHeading'} />
          </p>
          <Trans i18nKey={'organization:transferOrganizationErrorMessage'} />
        </div>
      </If>

      <p>
        <Trans
          i18nKey={'organization:transferOwnershipDisclaimer'}
          values={{
            member: targetDisplayName,
          }}
          components={{ b: <b /> }}
        />
      </p>

      <p>
        <Trans i18nKey={'common:modalConfirmationQuestion'} />
      </p>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className={COMPACT_OUTLINE_BUTTON_CLASS}
          disabled={pending}
        >
          <Trans i18nKey={'common:cancel'} />
        </button>

        <button
          type="submit"
          data-cy={'confirm-transfer-ownership-button'}
          disabled={pending}
          className={COMPACT_DESTRUCTIVE_BUTTON_CLASS}
        >
          {pending ? (
            <>
              <span className="w-3 h-3 block animate-spin rounded-full border-2 border-current border-t-transparent" />
              <Trans i18nKey={'organization:transferringOwnership'} />
            </>
          ) : (
            <Trans i18nKey={'organization:transferOwnership'} />
          )}
        </button>
      </div>
    </form>
  );
}

export default TransferOrganizationOwnershipModal;
