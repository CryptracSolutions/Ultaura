'use client';

import { useContext } from 'react';

import {
  BugAntIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  CreditCardIcon,
  DocumentTextIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  MegaphoneIcon,
  UserGroupIcon,
  UserIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import { PanelLeft } from 'lucide-react';

import Sidebar, {
  SidebarGroup,
  SidebarItem,
} from '~/core/ui/Sidebar';
import Logo from '~/core/ui/Logo';
import LogoImage from '~/core/ui/Logo/LogoImage';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';
import ProfileDropdown from '~/components/ProfileDropdown';
import classNames from 'clsx';
import SidebarContext from '~/lib/contexts/sidebar';
import Button from '~/core/ui/Button';
import useUserSession from '~/core/hooks/use-user-session';
import useSignOut from '~/core/hooks/use-sign-out';

const NEWSLETTER_PATH = '/admin/newsletter';
const BROADCASTS_PATH = '/admin/newsletter/broadcasts';
const CHANGELOG_PATH = '/admin/changelog';

function isNewsletterSubscribersRoute(currentPath: string) {
  return (
    currentPath === NEWSLETTER_PATH ||
    currentPath === `${NEWSLETTER_PATH}/`
  );
}

function isNewsletterBroadcastsRoute(currentPath: string) {
  return (
    currentPath === BROADCASTS_PATH ||
    currentPath.startsWith(`${BROADCASTS_PATH}/`)
  );
}

function isChangelogRoute(currentPath: string) {
  return (
    currentPath === CHANGELOG_PATH ||
    currentPath.startsWith(`${CHANGELOG_PATH}/`)
  );
}

function AdminSidebar() {
  const ctx = useContext(SidebarContext);
  const userSession = useUserSession();
  const signOut = useSignOut();

  return (
    <Sidebar collapsed={ctx.collapsed}>
        {/* Top zone */}
        <div className="flex w-full flex-col px-2 space-y-1.5 mt-2 mb-2">
          <div className="relative h-10 w-full">
            {/* Expanded */}
            <div
              className={classNames(
                'absolute inset-0 flex items-center justify-between transition-opacity duration-200',
                ctx.collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100',
              )}
            >
              <Logo href="/" className="h-9 ml-2" label="Home" showWordmark={false} />
              <CollapsibleButton collapsed={false} onClick={ctx.setCollapsed} />
            </div>

            {/* Collapsed — logo swaps to PanelLeft on hover */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => ctx.setCollapsed(false)}
                  className={classNames(
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
                Expand sidebar
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Middle zone: navigation (flex-1 fills remaining space, scrollable) */}
        <div className="flex w-full flex-1 min-h-0 flex-col px-2 pb-4 space-y-[2px] overflow-y-auto">
          <SidebarItem end path={'/admin'} Icon={HomeIcon}>
            Overview
          </SidebarItem>

          <SidebarItem path={'/admin/search'} Icon={MagnifyingGlassIcon}>
            Search
          </SidebarItem>

          <SidebarGroup label={'Manage'} collapsible={false}>
            <SidebarItem path={'/admin/users'} Icon={UserIcon}>
              Users
            </SidebarItem>

            <SidebarItem path={'/admin/organizations'} Icon={UserGroupIcon}>
              Organizations
            </SidebarItem>

            <SidebarItem path={'/admin/billing'} Icon={CreditCardIcon}>
              Billing
            </SidebarItem>
          </SidebarGroup>

          <SidebarGroup label={'Content'} collapsible={false}>
            <SidebarItem
              path={NEWSLETTER_PATH}
              activeMatch={isNewsletterSubscribersRoute}
              Icon={UsersIcon}
            >
              Subscribers
            </SidebarItem>

            <SidebarItem
              path={BROADCASTS_PATH}
              activeMatch={isNewsletterBroadcastsRoute}
              Icon={MegaphoneIcon}
            >
              Broadcasts
            </SidebarItem>

            <SidebarItem
              path={CHANGELOG_PATH}
              activeMatch={isChangelogRoute}
              Icon={DocumentTextIcon}
            >
              Changelog
            </SidebarItem>
          </SidebarGroup>

          <SidebarGroup label={'Observe'} collapsible={false}>
            <SidebarItem path={'/admin/timeline'} Icon={ClockIcon}>
              Timeline
            </SidebarItem>

            <SidebarItem path={'/admin/debug-logs'} Icon={BugAntIcon}>
              Debug Logs
            </SidebarItem>

            <SidebarItem path={'/admin/diagnostics'} Icon={WrenchScrewdriverIcon}>
              Diagnostics
            </SidebarItem>

            <SidebarItem path={'/admin/feedback'} Icon={ChatBubbleLeftRightIcon}>
              Feedback
            </SidebarItem>
          </SidebarGroup>
        </div>

        {/* Bottom zone (natural flex placement, no absolute) */}
        <div className="w-full pb-2">
          <hr className="border-border mb-2" />
          <div className="w-full px-2">
            {!ctx.collapsed && (
              <div className="mb-1">
                <Button variant="ghost" href="/dashboard" className="w-full justify-start text-muted-foreground hover:text-foreground">
                  <ArrowLeftIcon className="h-4 w-4" />
                  <span>Back to App</span>
                </Button>
              </div>
            )}
            <div className={ctx.collapsed ? '' : 'w-full'}>
              <ProfileDropdown
                displayName={!ctx.collapsed}
                className="w-full"
                userSession={userSession}
                signOutRequested={signOut}
                accountName="Admin"
              />
            </div>
          </div>
        </div>
    </Sidebar>
  );
}

export default AdminSidebar;

function CollapsibleButton({
  collapsed,
  onClick,
}: {
  collapsed: boolean;
  onClick: (collapsed: boolean) => void;
}) {
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
        {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      </TooltipContent>
    </Tooltip>
  );
}
