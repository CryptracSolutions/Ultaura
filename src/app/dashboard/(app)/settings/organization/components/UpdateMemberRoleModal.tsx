import { useCallback, useState, useTransition } from 'react';
import Trans from '~/core/ui/Trans';

import Modal from '~/core/ui/Modal';
import If from '~/core/ui/If';
import {
  COMPACT_OUTLINE_BUTTON_CLASS,
  COMPACT_PRIMARY_BUTTON_CLASS,
} from '~/app/dashboard/(app)/components/compact-action-classes';

import type MembershipRole from '~/lib/organizations/types/membership-role';
import { updateMemberAction } from '~/lib/memberships/actions';

import MembershipRoleSelector from './MembershipRoleSelector';
import useCurrentUserRole from '~/lib/organizations/hooks/use-current-user-role';

const UpdateMemberRoleModal: React.FCC<{
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  membershipId: number;
  memberRole: MembershipRole;
}> = ({ isOpen, setIsOpen, memberRole, membershipId }) => {
  return (
    <Modal
      heading={<Trans i18nKey={'organization:updateMemberRoleModalHeading'} />}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
    >
      <UpdateMemberForm
        setIsOpen={setIsOpen}
        memberRole={memberRole}
        membershipId={membershipId}
      />
    </Modal>
  );
};

function UpdateMemberForm({
  membershipId,
  setIsOpen,
  memberRole,
}: React.PropsWithChildren<{
  membershipId: number;
  memberRole: MembershipRole;
  setIsOpen: (isOpen: boolean) => void;
}>) {
  const [role, setRole] = useState<MembershipRole>(memberRole);
  const [isSubmitting, startTransition] = useTransition();
  const currentUserRole = useCurrentUserRole();
  const [error, setError] = useState<boolean>();

  const onRoleUpdated = useCallback(async () => {
    if (role !== undefined) {
      startTransition(async () => {
        try {
          await updateMemberAction({ membershipId, role });

          setIsOpen(false);
        } catch (e) {
          setError(true);
        }
      });
    }
  }, [membershipId, role, setIsOpen]);

  return (
    <div className={'flex flex-col space-y-6'}>
      <MembershipRoleSelector
        targetUserRole={memberRole}
        currentUserRole={currentUserRole}
        value={role}
        onChange={setRole}
      />

      <If condition={error}>
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p className="font-medium">
            <Trans i18nKey={'organization:updateRoleErrorHeading'} />
          </p>
          <Trans i18nKey={'organization:updateRoleErrorMessage'} />
        </div>
      </If>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className={COMPACT_OUTLINE_BUTTON_CLASS}
          disabled={isSubmitting}
        >
          <Trans i18nKey={'common:cancel'} />
        </button>

        <button
          type="button"
          data-cy={'confirm-update-member-role'}
          disabled={isSubmitting}
          onClick={onRoleUpdated}
          className={COMPACT_PRIMARY_BUTTON_CLASS}
        >
          {isSubmitting ? (
            <>
              <span className="w-3 h-3 block animate-spin rounded-full border-2 border-current border-t-transparent" />
              <Trans i18nKey={'organization:updateRoleSubmitLabel'} />
            </>
          ) : (
            <Trans i18nKey={'organization:updateRoleSubmitLabel'} />
          )}
        </button>
      </div>
    </div>
  );
}

export default UpdateMemberRoleModal;
