import {
  Squares2X2Icon,
  PhoneIcon,
  CalendarDaysIcon,
  BellIcon,
  UserIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';

import configuration from '~/configuration';

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

const NAVIGATION_CONFIG = (): NavigationConfig => ({
  items: [
    {
      label: 'Home',
      path: getPath(''),
      Icon: ({ className }: { className: string }) => {
        return <Squares2X2Icon className={className} />;
      },
      end: true,
    },
    {
      label: 'Calls',
      path: getPath('calls'),
      Icon: ({ className }: { className: string }) => {
        return <CalendarDaysIcon className={className} />;
      },
    },
    {
      label: 'Reminders',
      path: getPath('reminders'),
      Icon: ({ className }: { className: string }) => {
        return <BellIcon className={className} />;
      },
    },
    {
      label: 'Lines',
      path: getPath('lines'),
      Icon: ({ className }: { className: string }) => {
        return <PhoneIcon className={className} />;
      },
    },
    {
      label: 'Settings',
      collapsible: false,
      children: [
        {
          label: 'Profile',
          path: getPath('settings/profile'),
          Icon: ({ className }: { className: string }) => {
            return <UserIcon className={className} />;
          },
        },
        {
          label: 'Subscription',
          path: getPath('settings/subscription'),
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
