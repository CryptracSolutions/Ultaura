'use client';

import { useTranslation } from 'react-i18next';
import { useCallback, useTransition } from 'react';
import { toast } from 'sonner';

import useUserSession from '~/core/hooks/use-user-session';
import { inviteMembersToOrganizationAction } from '~/lib/organizations/actions';
import useCurrentOrganization from '~/lib/organizations/hooks/use-current-organization';
import MembershipRole from '~/lib/organizations/types/membership-role';
import InviteMembersForm from './InviteMembersForm';

import If from '~/core/ui/If';
import Trans from '~/core/ui/Trans';
import { COMPACT_PRIMARY_BUTTON_CLASS } from '~/app/dashboard/(app)/components/compact-action-classes';

const InviteMembersFormContainer = () => {
  const { t } = useTranslation('organization');
  const user = useUserSession();
  const organization = useCurrentOrganization();

  const [isSubmitting, startTransition] = useTransition();

  const onSubmit = useCallback(
    (
      invites: Array<{
        email: string;
        role: MembershipRole;
      }>,
    ) => {
      startTransition(async () => {
        if (!organization) {
          return;
        }

        const id = toast.loading(t('organization:inviteMembersLoading'));

        try {
          await inviteMembersToOrganizationAction({
            invites,
            organizationUid: organization.uuid,
          });

          toast.success(t('organization:inviteMembersSuccess'), {
            id,
          });
        } catch (e) {
          toast.error(t('organization:inviteMembersError'), {
            id,
          });
        }
      });
    },
    [organization, t],
  );

  const SubmitButton = (
    <div>
      <button
        className={COMPACT_PRIMARY_BUTTON_CLASS}
        data-cy={'send-invites-button'}
        type={'submit'}
        disabled={isSubmitting}
      >
        <If condition={!isSubmitting}>
          <Trans i18nKey={'organization:inviteMembersSubmitLabel'} />
        </If>

        <If condition={isSubmitting}>
          <>
            <span className="w-3 h-3 block animate-spin rounded-full border-2 border-current border-t-transparent" />
            <Trans i18nKey={'organization:inviteMembersLoading'} />
          </>
        </If>
      </button>
    </div>
  );

  return (
    <InviteMembersForm
      currentUserRole={user?.role}
      onSubmit={onSubmit}
      currentUserEmail={user?.auth.user.email}
      SubmitButton={SubmitButton}
    />
  );
};

export default InviteMembersFormContainer;
