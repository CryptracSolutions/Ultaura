import {
  CreditCardIcon,
  Squares2X2Icon,
  UserGroupIcon,
  UserIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';

import configuration from '~/configuration';

const enableTeamAccounts = configuration.features.enableTeamAccounts;

type Divider = {
  divider: true;
};

type NavigationItemLink = {
  label: string;
  path: string;
  Icon: (props: { className: string }) => JSX.Element;
  end?: boolean;
};

type NavigationGroup = {
  label: string;
  collapsible?: boolean;
  collapsed?: boolean;
  children: NavigationItemLink[];
};

type NavigationItem = NavigationItemLink | NavigationGroup | Divider;

type NavigationConfig = {
  items: NavigationItem[];
};

const paths = configuration.paths.settings;

const NAVIGATION_CONFIG = (): NavigationConfig => ({
  items: [
    {
      label: 'common:dashboardTabLabel',
      path: getPath(''),
      Icon: ({ className }: { className: string }) => {
        return <Squares2X2Icon className={className} />;
      },
      end: true,
    },
    {
      label: 'Lines',
      path: getPath('lines'),
      Icon: ({ className }: { className: string }) => {
        return <PhoneIcon className={className} />;
      },
    },
    {
      label: 'common:settingsTabLabel',
      collapsible: false,
      children: [
        {
          label: 'common:profileSettingsTabLabel',
          path: getPath(paths.profile),
          Icon: ({ className }: { className: string }) => {
            return <UserIcon className={className} />;
          },
        },
        // Only show organization settings when team accounts are enabled
        ...(enableTeamAccounts
          ? [
              {
                label: 'common:organizationSettingsTabLabel',
                path: getPath(paths.organization),
                Icon: ({ className }: { className: string }) => {
                  return <UserGroupIcon className={className} />;
                },
              },
            ]
          : []),
        {
          label: 'common:subscriptionSettingsTabLabel',
          path: getPath(paths.subscription),
          Icon: ({ className }: { className: string }) => {
            return <CreditCardIcon className={className} />;
          },
        },
      ],
    },
  ],
});

export default NAVIGATION_CONFIG;

function getPath(path: string) {
  const appPrefix = configuration.paths.appPrefix;

  return [appPrefix, path].filter(Boolean).join('/');
}
