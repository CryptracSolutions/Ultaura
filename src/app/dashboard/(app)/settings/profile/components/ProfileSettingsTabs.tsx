'use client';

import React, { useMemo } from 'react';

import NavigationItem from '~/core/ui/Navigation/NavigationItem';
import NavigationMenu from '~/core/ui/Navigation/NavigationMenu';
import MobileNavigationDropdown from '~/core/ui/MobileNavigationDropdown';

import useUser from '~/core/hooks/use-user';

const profileTabLinks = {
  General: {
    path: '/dashboard/settings/profile',
    label: 'profile:generalTab',
  },
  Authentication: {
    path: '/dashboard/settings/profile/authentication',
    label: 'profile:authenticationTab',
  },
  Email: {
    path: '/dashboard/settings/profile/email',
    label: 'profile:emailTab',
  },
  Password: {
    path: '/dashboard/settings/profile/password',
    label: 'profile:passwordTab',
  },
};

const itemClassName = `flex justify-center lg:justify-start items-center w-full`;

const ProfileSettingsTabs: React.FC = () => {
  const canUpdatePasswordCredentials = useCanUpdatePassword();

  return (
    <>
      <div className={'hidden min-w-[12rem] lg:flex'}>
        <NavigationMenu vertical pill>
          <NavigationItem
            depth={0}
            className={itemClassName}
            link={profileTabLinks.General}
          />

          <NavigationItem
            className={itemClassName}
            link={profileTabLinks.Authentication}
          />

          <NavigationItem
            className={itemClassName}
            disabled={!canUpdatePasswordCredentials}
            link={profileTabLinks.Email}
          />

          <NavigationItem
            className={itemClassName}
            disabled={!canUpdatePasswordCredentials}
            link={profileTabLinks.Password}
          />
        </NavigationMenu>
      </div>

      <div className={'block w-full lg:hidden'}>
        <MobileNavigationDropdown links={Object.values(profileTabLinks)} />
      </div>
    </>
  );
};

export default ProfileSettingsTabs;

function useCanUpdatePassword() {
  const { data: user } = useUser();

  // user can only edit email and password
  // if they signed up with the EmailAuthProvider provider
  return useMemo(() => {
    if (!user) {
      return false;
    }

    const emailProviderId = 'email';
    const identities = user.identities ?? [];

    return identities.some((identity) => {
      return identity.provider === emailProviderId;
    });
  }, [user]);
}
