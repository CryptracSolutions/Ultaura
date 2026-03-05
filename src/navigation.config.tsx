import {
  Squares2X2Icon,
  ChartBarIcon,
  PhoneIcon,
  CalendarDaysIcon,
  BellIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

import configuration from '~/configuration';
import MembershipRole from '~/lib/organizations/types/membership-role';

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

export interface NavigationContext {
  userType?: 'self' | 'family_managed';
  accountId?: string;
  role?: number;
}

const NAVIGATION_CONFIG = (context?: NavigationContext): NavigationConfig => {
  const isSelfUser = context?.userType === 'self';
  const normalizedRole = typeof context?.role === 'number' && Number.isFinite(context.role)
    ? context.role
    : null;
  const isViewer = normalizedRole === Number(MembershipRole.Viewer);
  const hasResolvedRole = normalizedRole !== null;
  const items: NavigationItem[] = [
    {
      label: 'Dashboard',
      collapsible: false,
      children: [
        {
          label: 'Home',
          path: getPath(''),
          Icon: ({ className }: { className: string }) => {
            return <Squares2X2Icon className={className} />;
          },
          end: true,
        },
      ],
    },
    {
      label: 'Care',
      collapsible: false,
      children: [
        {
          label: isSelfUser ? 'My Line' : 'Lines',
          path: getPath('lines'),
          Icon: ({ className }: { className: string }) => {
            return <PhoneIcon className={className} />;
          },
          activeMatch: isLineRouteActive,
        },
        {
          label: 'Calls',
          path: getPath('calls'),
          Icon: ({ className }: { className: string }) => {
            return <CalendarDaysIcon className={className} />;
          },
          activeMatch: isCallsRouteActive,
        },
        {
          label: 'Reminders',
          path: getPath('reminders'),
          Icon: ({ className }: { className: string }) => {
            return <BellIcon className={className} />;
          },
          activeMatch: isRemindersRouteActive,
        },
      ],
    },
  ];

  if (!isSelfUser) {
    const careGroup = items.find(
      (item): item is NavigationGroup => 'children' in item && item.label === 'Care',
    );

    careGroup?.children.push(
      {
        label: 'Insights',
        path: getPath('insights'),
        Icon: ({ className }: { className: string }) => {
          return <EyeIcon className={className} />;
        },
        activeMatch: isInsightsRouteActive,
      },
      {
        label: 'Alerts',
        path: getPath('alerts'),
        Icon: ({ className }: { className: string }) => {
          return <ExclamationTriangleIcon className={className} />;
        },
        activeMatch: isAlertsRouteActive,
      },
    );
  }

  const accountChildren: NavigationItemLink[] = [];

  if (!isViewer && hasResolvedRole) {
    accountChildren.push(
      {
        label: 'Usage',
        path: getPath('usage'),
        Icon: ({ className }: { className: string }) => {
          return <ChartBarIcon className={className} />;
        },
      },
      {
        label: 'common:privacyTabLabel',
        path: getPath('privacy'),
        Icon: ({ className }: { className: string }) => {
          return <ShieldCheckIcon className={className} />;
        },
      },
    );
  }

  if (accountChildren.length > 0) {
    items.push({
      label: 'Account',
      collapsible: false,
      children: accountChildren,
    });
  }

  return { items };
};

export default NAVIGATION_CONFIG;

function getPath(path: string) {
  const appPrefix = configuration.paths.appPrefix;

  return [appPrefix, path].filter(Boolean).join('/');
}

const remindersRoutePattern = createRoutePattern(getPath('reminders'));
const callsRoutePattern = createRoutePattern(getPath('calls'));
const insightsRoutePattern = createRoutePattern(getPath('insights'));
const alertsRoutePattern = createRoutePattern(getPath('alerts'));
const linesRoutePattern = createRoutePattern(getPath('lines'));
const lineInsightsRoutePattern = createRoutePattern(
  getPath('lines/:lineId/insights'),
);

function isRemindersRouteActive(currentPath: string) {
  return remindersRoutePattern.test(currentPath);
}

function isCallsRouteActive(currentPath: string) {
  return callsRoutePattern.test(currentPath);
}

function isInsightsRouteActive(currentPath: string) {
  return (
    insightsRoutePattern.test(currentPath) ||
    lineInsightsRoutePattern.test(currentPath)
  );
}

function isAlertsRouteActive(currentPath: string) {
  return alertsRoutePattern.test(currentPath);
}

function isLineRouteActive(currentPath: string) {
  if (lineInsightsRoutePattern.test(currentPath)) {
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
