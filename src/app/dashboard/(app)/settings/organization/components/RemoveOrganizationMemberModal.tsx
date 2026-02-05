import { useCallback, useState, useTransition } from 'react';

import Trans from '~/core/ui/Trans';
import Modal from '~/core/ui/Modal';
import Button from '~/core/ui/Button';

import { deleteMemberAction } from '~/lib/memberships/actions';
import If from '~/core/ui/If';

const RemoveOrganizationMemberModal: React.FCC<{
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  membershipId: number;
}> = ({ isOpen, setIsOpen, membershipId }) => {
  return (
    <Modal
      heading={<Trans i18nKey="organization:removeMemberModalHeading" />}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
    >
      <RemoveMemberForm setIsOpen={setIsOpen} membershipId={membershipId} />
    </Modal>
  );
};

export default RemoveOrganizationMemberModal;

function RemoveMemberForm({
  membershipId,
  setIsOpen,
}: {
  membershipId: number;
  setIsOpen: (isOpen: boolean) => void;
}) {
  const [isSubmitting, startTransition] = useTransition();
  const [error, setError] = useState<boolean>();

  const onMemberRemoved = useCallback(() => {
    startTransition(async () => {
      try {
        await deleteMemberAction({ membershipId });

        setIsOpen(false);
      } catch (e) {
        setError(true);
      }
    });
  }, [membershipId, setIsOpen]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onMemberRemoved();
      }}
    >
      <div className={'flex flex-col space-y-6'}>
        <p className={'text-sm'}>
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
          <Button
            type="button"
            variant="outline"
            size="small"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
          >
            <Trans i18nKey={'common:cancel'} />
          </Button>

          <Button
            data-cy={'confirm-remove-member'}
            type="submit"
            variant="destructive"
            size="small"
            loading={isSubmitting}
          >
            <Trans i18nKey={'organization:removeMemberSubmitLabel'} />
          </Button>
        </div>
      </div>
    </form>
  );
}
