import SettingsTile from '../../components/SettingsTile';
import UpdatePhoneNumberFormContainer from './UpdatePhoneNumberFormContainer';
import Trans from '~/core/ui/Trans';
import { withI18n } from '~/i18n/with-i18n';

export const metadata = {
  title: 'Phone Number',
};

const ProfilePhoneSettingsPage = () => {
  return (
    <div className="pb-12">
      <SettingsTile
        heading={<Trans i18nKey={'profile:phoneTab'} />}
        subHeading={<Trans i18nKey={'profile:phoneTabSubheading'} />}
      >
        <UpdatePhoneNumberFormContainer />
      </SettingsTile>
    </div>
  );
};

export default withI18n(ProfilePhoneSettingsPage);
