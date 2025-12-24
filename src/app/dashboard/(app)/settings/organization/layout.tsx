import OrganizationSettingsTabs from '~/app/dashboard/(app)/settings/organization/components/OrganizationSettingsTabs';
import SettingsContentContainer from '~/app/dashboard/(app)/settings/components/SettingsContentContainer';
import { withI18n } from '~/i18n/with-i18n';

async function OrganizationSettingsLayout({
  children,
}: React.PropsWithChildren) {
  return (
    <>
      <div>
        <OrganizationSettingsTabs />
      </div>

      <SettingsContentContainer>{children}</SettingsContentContainer>
    </>
  );
}

export default withI18n(OrganizationSettingsLayout);
