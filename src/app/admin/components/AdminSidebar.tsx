'use client';

import React, { useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';

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
  XMarkIcon,
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

function AdminSidebar({
  isOpen,
  onOpenChange,
}: {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const ctx = useContext(SidebarContext);
  const userSession = useUserSession();
  const signOut = useSignOut();

  return (
    <>
      <Sidebar collapsed={ctx.collapsed}>
        {/* Top zone */}
        <div className="flex w-full flex-col px-2 space-y-1.5 mt-2 mb-2">
          <div className="relative h-10 w-full">
            {/* Expanded */}
            <div
              className={[
                'absolute inset-0 flex items-center justify-between transition-opacity duration-200',
                ctx.collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100',
              ].join(' ')}
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
                  className={[
                    'group absolute inset-0 flex cursor-ew-resize items-center justify-center rounded-md border-0 bg-transparent p-0 transition-[opacity,background-color] duration-200 hover:bg-muted/60',
                    ctx.collapsed ? 'opacity-100' : 'opacity-0 pointer-events-none',
                  ].join(' ')}
                  aria-label="Open sidebar"
                  tabIndex={ctx.collapsed ? 0 : -1}
                >
                  <div className="relative flex h-10 w-full items-center justify-center">
                    <LogoImage className="h-9 transition-opacity duration-200 group-hover:opacity-0" />
                    <PanelLeft className="absolute text-white h-[1.1rem] w-[1.1rem] shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
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

      {/* Mobile overlay */}
      <AdminMobileOverlay
        isOpen={isOpen ?? false}
        onOpenChange={onOpenChange ?? (() => {})}
        userSession={userSession}
        signOut={signOut}
      />
    </>
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

function AdminMobileOverlay({
  isOpen,
  onOpenChange,
  userSession,
  signOut,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userSession: ReturnType<typeof useUserSession>;
  signOut: () => Promise<void>;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [animationState, setAnimationState] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');

  const closeMenu = useCallback(() => {
    setAnimationState('closing');
    setTimeout(() => {
      setIsVisible(false);
      setAnimationState('closed');
      onOpenChange(false);
    }, 300);
  }, [onOpenChange]);

  useEffect(() => {
    if (isOpen && animationState === 'closed') {
      setIsVisible(true);
      setAnimationState('opening');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimationState('open');
        });
      });
    } else if (!isOpen && (animationState === 'open' || animationState === 'opening')) {
      closeMenu();
    }
  }, [isOpen, animationState, closeMenu]);

  if (!isVisible) {
    return null;
  }

  const manageItems = [
    { path: '/admin/users', label: 'Users', Icon: UserIcon },
    { path: '/admin/organizations', label: 'Organizations', Icon: UserGroupIcon },
    { path: '/admin/billing', label: 'Billing', Icon: CreditCardIcon },
  ];

  const contentItems = [
    { path: NEWSLETTER_PATH, label: 'Subscribers', Icon: UsersIcon },
    { path: BROADCASTS_PATH, label: 'Broadcasts', Icon: MegaphoneIcon },
    { path: CHANGELOG_PATH, label: 'Changelog', Icon: DocumentTextIcon },
  ];

  const observeItems = [
    { path: '/admin/timeline', label: 'Timeline', Icon: ClockIcon },
    { path: '/admin/debug-logs', label: 'Debug Logs', Icon: BugAntIcon },
    { path: '/admin/diagnostics', label: 'Diagnostics', Icon: WrenchScrewdriverIcon },
    { path: '/admin/feedback', label: 'Feedback', Icon: ChatBubbleLeftRightIcon },
  ];

  return (
    <div
      className={[
        'fixed inset-0 z-50 bg-sidebar transition-transform duration-300 ease-out',
        animationState === 'open' ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <Logo
          href="/"
          className="h-10"
          label="Home"
          showWordmark
          wordmarkClassName="text-2xl font-semibold leading-none text-primary"
        />
        <button
          onClick={closeMenu}
          className="p-2 hover:bg-muted rounded-md transition-colors"
          aria-label="Close menu"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto h-[calc(100dvh-57px)]">
        <div className="py-2">
          <MobileLink path="/admin" label="Overview" Icon={HomeIcon} onClick={closeMenu} />
          <MobileLink path="/admin/search" label="Search" Icon={MagnifyingGlassIcon} onClick={closeMenu} />
        </div>

        <MobileSection label="Manage">
          {manageItems.map((item) => (
            <MobileLink key={item.path} path={item.path} label={item.label} Icon={item.Icon} onClick={closeMenu} />
          ))}
        </MobileSection>

        <MobileSection label="Content">
          {contentItems.map((item) => (
            <MobileLink key={item.path} path={item.path} label={item.label} Icon={item.Icon} onClick={closeMenu} />
          ))}
        </MobileSection>

        <MobileSection label="Observe">
          {observeItems.map((item) => (
            <MobileLink key={item.path} path={item.path} label={item.label} Icon={item.Icon} onClick={closeMenu} />
          ))}
        </MobileSection>

        <div className="py-2">
          <MobileLink path="/dashboard" label="Back to App" Icon={ArrowLeftIcon} onClick={closeMenu} />
        </div>
      </div>
    </div>
  );
}

function MobileLink({
  path,
  label,
  Icon,
  onClick,
}: {
  path: string;
  label: string;
  Icon: React.ElementType;
  onClick: () => void;
}) {
  return (
    <Link
      href={path}
      onClick={onClick}
      className="flex w-full items-center space-x-4 h-14 px-4 hover:bg-muted transition-colors touch-manipulation"
    >
      <Icon className="h-6 w-6 text-primary" />
      <span className="text-foreground">{label}</span>
    </Link>
  );
}

function MobileSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-2">
      <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}
