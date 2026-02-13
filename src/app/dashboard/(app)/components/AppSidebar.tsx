import React, { useContext } from 'react';
import Link from 'next/link';

import { PanelLeft } from 'lucide-react';

import AppSidebarNavigation from './AppSidebarNavigation';
import Sidebar, { SidebarContent } from '~/core/ui/Sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';

import Trans from '~/core/ui/Trans';
import SidebarContext from '~/lib/contexts/sidebar';
import ProfileDropdown from '~/components/ProfileDropdown';
import useUserSession from '~/core/hooks/use-user-session';
import useSignOut from '~/core/hooks/use-sign-out';

import useCurrentOrganization from '~/lib/organizations/hooks/use-current-organization';
import SubscriptionStatusBadge from './organizations/SubscriptionStatusBadge';

import configuration from '~/configuration';
import Logo from '~/core/ui/Logo';
import LogoImage from '~/core/ui/Logo/LogoImage';

const AppSidebar: React.FC = () => {
  const ctx = useContext(SidebarContext);

  return (
    <Sidebar collapsed={ctx.collapsed}>
      <SidebarContent className={'mt-2 mb-4'}>
        <div className="flex w-full items-center">
          {ctx.collapsed ? (
            <CollapsedLogoButton onClick={() => ctx.setCollapsed(false)} />
          ) : (
            <>
              <div className="flex-1 min-w-0">
                <Logo
                  href={'/'}
                  className="h-10"
                  label={'Dashboard'}
                  showWordmark={true}
                  wordmarkClassName="text-2xl font-semibold leading-none text-primary"
                />
              </div>
              <CollapsibleButton
                collapsed={false}
                onClick={ctx.setCollapsed}
              />
            </>
          )}
        </div>
      </SidebarContent>

      <SidebarContent className={`h-[calc(100%-160px)] overflow-y-auto`}>
        <AppSidebarNavigation />
      </SidebarContent>

      <div className={'absolute left-0 bottom-4 w-full'}>
        <SidebarContent>
          <ProfileDropdownContainer collapsed={ctx.collapsed} />
        </SidebarContent>
      </div>
    </Sidebar>
  );
};

export default AppSidebar;

function CollapsedLogoButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className="group flex w-full flex-1 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 transition-colors hover:bg-muted/60"
          aria-label="Open sidebar"
        >
          <div className="relative flex h-[42px] w-full items-center justify-center">
            <LogoImage
              className="h-[42px] transition-opacity duration-200 group-hover:opacity-0"
            />
            <PanelLeft
              className="absolute text-primary h-[1.1rem] w-[1.1rem] shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            />
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={20}>
        <Trans i18nKey="common:expandSidebar" />
      </TooltipContent>
    </Tooltip>
  );
}

function CollapsibleButton({
  collapsed,
  onClick,
}: React.PropsWithChildren<{
  collapsed: boolean;
  onClick: (collapsed: boolean) => void;
}>) {
  const iconClassName = 'text-primary h-[1.1rem] w-[1.1rem] shrink-0';

  return (
    <Tooltip>
      <TooltipTrigger
        className="bg-transparent cursor-pointer block p-1 rounded-md hover:bg-muted/60 transition-colors"
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

  return (
    <div className={props.collapsed ? '' : 'w-full'}>
      <StatusBadge />

      <ProfileDropdown
        displayName={!props.collapsed}
        className={'w-full'}
        userSession={userSession}
        signOutRequested={signOut}
        accountName={organization?.name}
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
