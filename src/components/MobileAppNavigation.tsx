'use client';

import { useState } from 'react';
import Link from 'next/link';
import classNames from 'clsx';

import {
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  QuestionMarkCircleIcon,
  ChatBubbleLeftIcon,
  PlusIcon,
  PhoneIcon,
  BellIcon,
  PhoneArrowUpRightIcon,
  CalendarIcon,
  LifebuoyIcon,
  MagnifyingGlassIcon,
  UserIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';

import Trans from '~/core/ui/Trans';

import NAVIGATION_CONFIG from '../navigation.config';
import configuration from '~/configuration';
import useCurrentOrganization from '~/lib/organizations/hooks/use-current-organization';
import useSignOut from '~/core/hooks/use-sign-out';
import useUltauraAccount from '~/lib/ultaura/hooks/use-ultaura-account';
import { useManualCall } from '~/lib/contexts/ManualCallContext';
import { useAddReminder } from '~/lib/contexts/AddReminderContext';
import { useAddSchedule } from '~/lib/contexts/AddScheduleContext';
import { useAddLine } from '~/lib/contexts/AddLineContext';

import { useHelpPanel } from '~/lib/contexts/HelpPanelContext';
import { MobileFeedbackModal } from '~/components/MobileFeedbackModal';
import Logo from '~/core/ui/Logo';
import { useSearch } from '~/lib/contexts/SearchContext';
import { Dialog, DialogContent, DialogTitle } from '~/core/ui/Dialog';

const MobileAppNavigation = () => {
  const currentOrganization = useCurrentOrganization();
  const { data: ultauraAccount } = useUltauraAccount();
  const { openManualCall } = useManualCall();
  const { openAddReminder } = useAddReminder();
  const { openAddSchedule } = useAddSchedule();
  const { openAddLine } = useAddLine();
  const { open: openHelp } = useHelpPanel();
  const { openMobile, isMobileOpen } = useSearch();
  const [isVisible, setIsVisible] = useState(false);
  const [animationState, setAnimationState] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  const openMenu = () => {
    setIsVisible(true);
    setAnimationState('opening');
    // Small delay to ensure DOM renders before animation starts
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimationState('open');
      });
    });
  };

  const closeMenu = () => {
    setAnimationState('closing');
    // Wait for animation to complete before hiding
    setTimeout(() => {
      setIsVisible(false);
      setAnimationState('closed');
    }, 300);
  };

  if (!currentOrganization?.uuid) {
    return null;
  }

  const handleHelpClick = () => {
    openHelp();
  };

  const handleFeedbackClick = () => {
    closeMenu();
    setTimeout(() => setFeedbackOpen(true), 200);
  };

  const handleQuickAction = (action: () => void) => {
    setQuickActionsOpen(false);
    closeMenu();
    setTimeout(() => action(), 200);
  };

  // Extract navigation items and settings from config
  const userType =
    ultauraAccount?.user_type === 'self' || ultauraAccount?.user_type === 'family_managed'
      ? ultauraAccount.user_type
      : undefined;
  const navConfig = NAVIGATION_CONFIG(
    ultauraAccount
      ? { userType, accountId: ultauraAccount.id }
      : undefined
  );
  const navGroups = navConfig.items.filter(
    (item) => 'children' in item
  ) as Array<{ label: string; children: Array<{ path: string; label: string; Icon: React.ElementType }> }>;

  return (
    <>
      {/* Hamburger Trigger */}
      <button
        onClick={openMenu}
        className="p-1 -ml-1"
        aria-label="Open menu"
      >
        <Bars3Icon className="h-8 w-8" />
      </button>

      {/* Full Screen Menu */}
      {isVisible && (
        <div
          className={classNames(
            'fixed inset-0 z-50 bg-background transition-transform duration-300 ease-out',
            {
              'translate-x-0': animationState === 'open',
              '-translate-x-full': animationState === 'opening' || animationState === 'closing',
            }
          )}
        >
          {/* Header with Close Button */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <Logo
              href="/"
              className="h-8"
              label="Home"
              showWordmark
              wordmarkClassName="text-xl font-semibold leading-none text-primary"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuickActionsOpen(true)}
                className="p-1.5 hover:bg-muted rounded-md transition-colors"
                aria-label="Quick Actions"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
              <button
                onClick={openMobile}
                className="p-1.5 hover:bg-muted rounded-md transition-colors"
                aria-label="Search"
                aria-haspopup="dialog"
                aria-expanded={isMobileOpen}
              >
                <MagnifyingGlassIcon className="h-5 w-5" />
              </button>
              <button
                onClick={closeMenu}
                className="p-1.5 hover:bg-muted rounded-md transition-colors"
                aria-label="Close menu"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Menu Content */}
          <div className="overflow-y-auto h-[calc(100vh-57px)]">
            {/* Navigation Groups */}
            {navGroups.map((group) => (
              <MenuSection key={group.label} label={group.label}>
                {group.children.map((child) => (
                  <MenuLink
                    key={child.path}
                    Icon={child.Icon}
                    path={child.path}
                    label={child.label}
                    onClick={closeMenu}
                  />
                ))}
              </MenuSection>
            ))}

            {/* Support Section */}
            <MenuSection label="Support">
              <MenuButton
                Icon={LifebuoyIcon}
                label="Help"
                onClick={handleHelpClick}
              />
              <MenuLink
                Icon={QuestionMarkCircleIcon}
                path="/docs"
                label="Documentation"
                onClick={closeMenu}
              />
              <MenuButton
                Icon={ChatBubbleLeftIcon}
                label="Feedback"
                onClick={handleFeedbackClick}
              />
            </MenuSection>

            {/* Account Section */}
            <MenuSection label="Account">
              <MenuLink
                Icon={UserIcon}
                path={`${configuration.paths.appPrefix}/${configuration.paths.settings.profile}`}
                label="common:profileSettingsTabLabel"
                onClick={closeMenu}
              />
              <MenuLink
                Icon={CreditCardIcon}
                path={`${configuration.paths.appPrefix}/${configuration.paths.settings.subscription}`}
                label="common:subscriptionSettingsTabLabel"
                onClick={closeMenu}
              />
              <SignOutButton onSignOut={closeMenu} />
            </MenuSection>
          </div>
        </div>
      )}

      <MobileFeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />

      <Dialog open={quickActionsOpen} onOpenChange={setQuickActionsOpen}>
        <DialogContent className="z-[60] p-0" overlayClassName="z-[60]" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogTitle className="px-5 pt-5 pb-2 text-base font-semibold">
            Quick Actions
          </DialogTitle>
          <div className="pb-2">
            <MenuButton
              Icon={BellIcon}
              label="Set Reminder"
              onClick={() => handleQuickAction(openAddReminder)}
            />
            <MenuButton
              Icon={CalendarIcon}
              label="Schedule Call"
              onClick={() => handleQuickAction(openAddSchedule)}
            />
            {userType === 'family_managed' && (
              <MenuButton
                Icon={PhoneArrowUpRightIcon}
                label="Place Call"
                onClick={() => handleQuickAction(openManualCall)}
              />
            )}
            <MenuButton
              Icon={PhoneIcon}
              label="Add Line"
              onClick={() => handleQuickAction(openAddLine)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MobileAppNavigation;

function MenuLink({
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
      className="flex w-full items-center space-x-[14px] h-[50px] px-[14px] hover:bg-muted transition-colors"
    >
      <Icon className="h-[22px] w-[22px] text-primary" />
      <span className="text-[14.5px] text-foreground">
        <Trans i18nKey={label} defaults={label} />
      </span>
    </Link>
  );
}

function MenuButton({
  label,
  Icon,
  onClick,
}: {
  label: string;
  Icon: React.ElementType;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center space-x-[14px] h-[50px] px-[14px] hover:bg-muted transition-colors"
    >
      <Icon className="h-[22px] w-[22px] text-primary" />
      <span className="text-[14.5px] text-foreground">{label}</span>
    </button>
  );
}

function SignOutButton({ onSignOut }: { onSignOut: () => void }) {
  const signOut = useSignOut();

  const handleSignOut = () => {
    onSignOut();
    signOut();
  };

  return (
    <button
      onClick={handleSignOut}
      className="flex w-full items-center space-x-[14px] h-[50px] px-[14px] hover:bg-muted transition-colors"
    >
      <ArrowLeftOnRectangleIcon className="h-[22px] w-[22px] text-primary" />
      <span className="text-[14.5px] text-foreground">
        <Trans i18nKey="common:signOut" defaults="Sign out" />
      </span>
    </button>
  );
}

function MenuSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-2">
      <div className="px-[14px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}
