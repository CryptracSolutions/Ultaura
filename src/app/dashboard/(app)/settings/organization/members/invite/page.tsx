import { redirect } from 'next/navigation';
import ArrowLeftIcon from '@heroicons/react/24/outline/ArrowLeftIcon';
import Link from 'next/link';

import SettingsTile from '~/app/dashboard/(app)/settings/components/SettingsTile';
import Trans from '~/core/ui/Trans';
import { withI18n } from '~/i18n/with-i18n';
import InviteMembersFormContainer from '../../components/InviteMembersFormContainer';
import configuration from '~/configuration';
import { COMPACT_OUTLINE_BUTTON_CLASS } from '~/app/dashboard/(app)/components/compact-action-classes';

export const metadata = {
  title: 'Invite Members',
};

const OrganizationMembersInvitePage = () => {
  // Redirect if team accounts are disabled
  if (!configuration.features.enableTeamAccounts) {
    redirect(configuration.paths.appHome);
  }

  return (
    <>
      <SettingsTile
        heading={<Trans i18nKey={'organization:inviteMembersPageHeading'} />}
        subHeading={
          <Trans i18nKey={'organization:inviteMembersPageSubheading'} />
        }
      >
        <InviteMembersFormContainer />
      </SettingsTile>

      <div className={'mt-4'}>
        <GoBackToMembersButton />
      </div>
    </>
  );
};

export default withI18n(OrganizationMembersInvitePage);

function GoBackToMembersButton() {
  return (
    <Link href={'../members'} className={COMPACT_OUTLINE_BUTTON_CLASS}>
      <span className={'flex items-center space-x-1'}>
        <ArrowLeftIcon className={'h-3 w-3'} />

        <span>
          <Trans i18nKey={'organization:goBackToMembersPage'} />
        </span>
      </span>
    </Link>
  );
}
