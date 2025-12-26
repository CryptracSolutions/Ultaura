import SettingsTile from '../../components/SettingsTile';
import UpdateEmailFormContainer from '../components/UpdateEmailFormContainer';
import Trans from '~/core/ui/Trans';
import { withI18n } from '~/i18n/with-i18n';

export const metadata = {
  title: 'Update Email',
};

const ProfileEmailSettingsPage = () => {
  return (
    <div className="pb-12">
      <SettingsTile
        heading={<Trans i18nKey={'profile:emailTab'} />}
        subHeading={<Trans i18nKey={'profile:emailTabTabSubheading'} />}
      >
        <UpdateEmailFormContainer />
      </SettingsTile>
    </div>
  );
};

export default withI18n(ProfileEmailSettingsPage);
