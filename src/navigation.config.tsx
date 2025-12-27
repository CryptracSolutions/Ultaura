import {
  Squares2X2Icon,
  ChartBarIcon,
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
  activeMatch?: (currentPath: string) => boolean;
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
      label: 'Usage',
      path: getPath('usage'),
      Icon: ({ className }: { className: string }) => {
        return <ChartBarIcon className={className} />;
      },
    },
    {
      label: 'Lines',
      path: getPath('lines'),
      Icon: ({ className }: { className: string }) => {
        return <PhoneIcon className={className} />;
      },
      activeMatch: (currentPath: string) =>
        isLineRouteActive(currentPath),
    },
    {
      label: 'Reminders',
      path: getPath('reminders'),
      Icon: ({ className }: { className: string }) => {
        return <BellIcon className={className} />;
      },
      activeMatch: (currentPath: string) =>
        isRemindersRouteActive(currentPath),
    },
    {
      label: 'Calls',
      path: getPath('calls'),
      Icon: ({ className }: { className: string }) => {
        return <CalendarDaysIcon className={className} />;
      },
      activeMatch: (currentPath: string) =>
        isCallsRouteActive(currentPath),
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

const remindersRoutePattern = createRoutePattern(
  getPath('reminders'),
);
const callsRoutePattern = createRoutePattern(getPath('calls'));
const linesRoutePattern = createRoutePattern(getPath('lines'));
const lineRemindersRoutePattern = createRoutePattern(
  getPath('lines/:lineId/reminders'),
);
const lineScheduleRoutePattern = createRoutePattern(
  getPath('lines/:lineId/schedule'),
);

function isRemindersRouteActive(currentPath: string) {
  return (
    remindersRoutePattern.test(currentPath) ||
    lineRemindersRoutePattern.test(currentPath)
  );
}

function isCallsRouteActive(currentPath: string) {
  return (
    callsRoutePattern.test(currentPath) ||
    lineScheduleRoutePattern.test(currentPath)
  );
}

function isLineRouteActive(currentPath: string) {
  if (
    lineRemindersRoutePattern.test(currentPath) ||
    lineScheduleRoutePattern.test(currentPath)
  ) {
    return false;
  }

  return linesRoutePattern.test(currentPath);
}

function createRoutePattern(path: string) {
  const segments = path.split('/').filter(Boolean);
  const patternSegments = segments.map((segment) => {
    if (segment.startsWith(':')) {
      return '[^/]+';
    }

    return escapeRegExp(segment);
  });

  return new RegExp(`^/${patternSegments.join('/')}(?:/|$)`);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
