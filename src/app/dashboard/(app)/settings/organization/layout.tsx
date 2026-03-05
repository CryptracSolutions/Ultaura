import OrganizationSettingsTabs from '~/app/dashboard/(app)/settings/organization/components/OrganizationSettingsTabs';
import SettingsContentContainer from '~/app/dashboard/(app)/settings/components/SettingsContentContainer';
import { withI18n } from '~/i18n/with-i18n';
import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import { redirectViewerAway } from '~/lib/ultaura/viewer-guards';

async function OrganizationSettingsLayout({
  children,
}: React.PropsWithChildren) {
  const appData = await loadAppDataForUser();
  redirectViewerAway(appData.role);

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
