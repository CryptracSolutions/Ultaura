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
import { HeartPulse } from 'lucide-react';

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
  locked?: boolean;
  badge?: number;
  featureFlag?: string;
  hidden?: boolean;
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
  /** True only when the current user is the canonical account owner (created_by_user_id). */
  isHealthOwner?: boolean;
  /** True when the Health feature flag is enabled. */
  healthFeatureEnabled?: boolean;
  /** True when the account is on an eligible plan (comfort/family/payg, non-trial). */
  isHealthEligible?: boolean;
  /** Pending Health suggestion count for nav badge. */
  pendingSuggestionCount?: number;
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

  // Health is owner-only (R9) and feature-flag-gated (Section 7.1B).
  // Canonical owner = created_by_user_id, NOT membership role.
  // Applies equally to family-managed and self-managed owners (R7).
  const isHealthOwner = context?.isHealthOwner === true;
  const isHealthFlagOn = context?.healthFeatureEnabled === true;
  const isHealthEligible = context?.isHealthEligible === true;

  // Show Health nav only to canonical owners when the feature flag is on.
  // For ineligible owners (Care/trial), show as locked with no counts/badges (R4, R5).
  if (isHealthOwner && isHealthFlagOn) {
    const careGroup = items.find(
      (item): item is NavigationGroup => 'children' in item && item.label === 'Care',
    );

    careGroup?.children.push({
      label: 'Health',
      path: getPath('health'),
      Icon: ({ className }: { className: string }) => {
        return <HeartPulse className={className} />;
      },
      activeMatch: isHealthRouteActive,
      locked: !isHealthEligible,
      badge: isHealthEligible ? (context?.pendingSuggestionCount ?? 0) : undefined,
    });
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
const healthRoutePattern = createRoutePattern(getPath('health'));
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

function isHealthRouteActive(currentPath: string) {
  return healthRoutePattern.test(currentPath);
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
