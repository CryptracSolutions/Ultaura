import React, { useContext } from 'react';
import Link from 'next/link';

import { PanelLeft } from 'lucide-react';

import AppSidebarNavigation from './AppSidebarNavigation';
import Sidebar from '~/core/ui/Sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';

import Trans from '~/core/ui/Trans';
import SidebarContext from '~/lib/contexts/sidebar';
import ProfileDropdown from '~/components/ProfileDropdown';
import useUserSession from '~/core/hooks/use-user-session';
import useSignOut from '~/core/hooks/use-sign-out';

import useCurrentOrganization from '~/lib/organizations/hooks/use-current-organization';
import SubscriptionStatusBadge from './organizations/SubscriptionStatusBadge';
import useUltauraAccount from '~/lib/ultaura/hooks/use-ultaura-account';
import { PLANS } from '~/lib/ultaura/constants';

import { cn } from '~/core/generic/shadcn-utils';
import configuration from '~/configuration';
import Logo from '~/core/ui/Logo';
import LogoImage from '~/core/ui/Logo/LogoImage';

const AppSidebar: React.FC = () => {
  const ctx = useContext(SidebarContext);

  return (
    <Sidebar collapsed={ctx.collapsed}>
      <div className="flex w-full flex-col px-2 space-y-1.5 mt-2 mb-2">
        <div className="relative h-10 w-full">
          {/* Expanded — fades out when collapsing */}
          <div className={cn(
            'absolute inset-0 flex items-center justify-between transition-opacity duration-200',
            ctx.collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100',
          )}>
            <Logo
              href={'/'}
              className="h-9 ml-2"
              label={'Dashboard'}
              showWordmark={false}
            />
            <CollapsibleButton collapsed={false} onClick={ctx.setCollapsed} />
          </div>

          {/* Collapsed — fades in when collapsing, logo swaps to expand icon on hover */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => ctx.setCollapsed(false)}
                className={cn(
                  'group absolute inset-0 flex cursor-ew-resize items-center justify-center rounded-md border-0 bg-transparent p-0 transition-[opacity,background-color] duration-200 hover:bg-muted/60',
                  ctx.collapsed ? 'opacity-100' : 'opacity-0 pointer-events-none',
                )}
                aria-label="Open sidebar"
                tabIndex={ctx.collapsed ? 0 : -1}
              >
                <div className="relative flex h-10 w-full items-center justify-center">
                  <LogoImage className="h-9 transition-opacity duration-200 group-hover:opacity-0" />
                  <PanelLeft className="absolute text-foreground dark:text-white h-[1.1rem] w-[1.1rem] shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={20}>
              <Trans i18nKey="common:expandSidebar" />
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex w-full flex-col px-2 space-y-[2px] h-[calc(100%-160px)] overflow-y-auto">
        <AppSidebarNavigation />
      </div>

      <div className={'absolute left-0 bottom-2 w-full'}>
        <hr className="border-border mb-2" />
        <div className="w-full px-2">
          <ProfileDropdownContainer collapsed={ctx.collapsed} />
        </div>
      </div>
    </Sidebar>
  );
};

export default AppSidebar;


function CollapsibleButton({
  collapsed,
  onClick,
}: React.PropsWithChildren<{
  collapsed: boolean;
  onClick: (collapsed: boolean) => void;
}>) {
  const iconClassName = 'text-foreground dark:text-white h-[1.1rem] w-[1.1rem] shrink-0';

  return (
    <Tooltip>
      <TooltipTrigger
        className="bg-transparent cursor-ew-resize block p-1 rounded-md hover:bg-muted/60 transition-colors"
        aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'}
        onClick={() => onClick(!collapsed)}
      >
        <PanelLeft className={iconClassName} />
      </TooltipTrigger>

      <TooltipContent sideOffset={20}>
        <Trans
          i18nKey={
            collapsed ? 'common:expandSidebar' : 'common:collapseSidebar'
          }
        />
      </TooltipContent>
    </Tooltip>
  );
}

function ProfileDropdownContainer(props: { collapsed: boolean }) {
  const userSession = useUserSession();
  const signOut = useSignOut();
  const organization = useCurrentOrganization();
  const account = useUltauraAccount();

  const effectivePlanId = account.data?.status === 'trial'
    ? (account.data?.trial_plan_id ?? account.data?.plan_id)
    : account.data?.plan_id;
  const planLabel = effectivePlanId
    ? PLANS[effectivePlanId as keyof typeof PLANS]?.displayName
    : undefined;

  return (
    <div className={props.collapsed ? '' : 'w-full'}>
      <StatusBadge />

      <ProfileDropdown
        displayName={!props.collapsed}
        className={'w-full'}
        userSession={userSession}
        signOutRequested={signOut}
        accountName={organization?.name}
        planLabel={planLabel}
      />
    </div>
  );
}

function StatusBadge() {
  const organization = useCurrentOrganization();
  const subscription = organization?.subscription?.data;

  const isActive = ['active', 'trialing'].includes(
    subscription?.status ?? 'free',
  );

  // if the organization has an active subscription
  // we do not show the subscription status badge
  if (isActive || !subscription) {
    return null;
  }

  const appPrefix = configuration.paths.appPrefix;
  const href = `/${appPrefix}/settings/subscription`;

  // in all other cases we show the subscription status badge
  // which will show the subscription status and a link to the subscription page
  return (
    <Link href={href}>
      <SubscriptionStatusBadge subscription={subscription} />
    </Link>
  );
}
