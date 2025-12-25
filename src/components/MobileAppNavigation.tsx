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
  PhoneIcon,
  BellIcon,
  PhoneArrowUpRightIcon,
  LifebuoyIcon,
} from '@heroicons/react/24/outline';

import Trans from '~/core/ui/Trans';

import NAVIGATION_CONFIG from '../navigation.config';
import useCurrentOrganization from '~/lib/organizations/hooks/use-current-organization';
import useSignOut from '~/core/hooks/use-sign-out';

import { useHelpPanel } from '~/lib/contexts/HelpPanelContext';
import { MobileFeedbackModal } from '~/components/MobileFeedbackModal';
import Logo from '~/core/ui/Logo';

const MobileAppNavigation = () => {
  const currentOrganization = useCurrentOrganization();
  const { open: openHelp } = useHelpPanel();
  const [isVisible, setIsVisible] = useState(false);
  const [animationState, setAnimationState] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');
  const [feedbackOpen, setFeedbackOpen] = useState(false);

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
    closeMenu();
    setTimeout(() => openHelp(), 200);
  };

  const handleFeedbackClick = () => {
    closeMenu();
    setTimeout(() => setFeedbackOpen(true), 200);
  };

  // Extract navigation items and settings from config
  const navConfig = NAVIGATION_CONFIG();
  const mainNavItems = navConfig.items.filter(
    (item) => !('children' in item) && !('divider' in item)
  ) as Array<{ path: string; label: string; Icon: React.ElementType }>;

  const settingsGroup = navConfig.items.find(
    (item) => 'children' in item
  ) as { children: Array<{ path: string; label: string; Icon: React.ElementType }> } | undefined;

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
              className="h-9"
              label="Home"
              showWordmark
              wordmarkClassName="text-xl font-semibold leading-none text-primary"
            />
            <button
              onClick={closeMenu}
              className="p-2 hover:bg-muted rounded-md transition-colors"
              aria-label="Close menu"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Menu Content */}
          <div className="overflow-y-auto h-[calc(100vh-57px)]">
            {/* Menu Section */}
            <MenuSection label="Menu">
              {mainNavItems.map((item) => (
                <MenuLink
                  key={item.path}
                  Icon={item.Icon}
                  path={item.path}
                  label={item.label}
                  onClick={closeMenu}
                />
              ))}
            </MenuSection>

            {/* Settings Section */}
            {settingsGroup && (
              <MenuSection label="Settings">
                {settingsGroup.children.map((child) => (
                  <MenuLink
                    key={child.path}
                    Icon={child.Icon}
                    path={child.path}
                    label={child.label}
                    onClick={closeMenu}
                  />
                ))}
              </MenuSection>
            )}

            {/* Quick Actions Section */}
            <MenuSection label="Quick Actions">
              <MenuLink
                Icon={PhoneIcon}
                path="/dashboard/lines?action=add"
                label="Add Line"
                onClick={closeMenu}
              />
              <MenuLink
                Icon={BellIcon}
                path="/dashboard/reminders?action=add"
                label="Add Reminder"
                onClick={closeMenu}
              />
              <MenuLink
                Icon={PhoneArrowUpRightIcon}
                path="/dashboard/calls?action=add"
                label="Schedule Call"
                onClick={closeMenu}
              />
            </MenuSection>

            {/* Support Section */}
            <MenuSection label="Support">
              <MenuLink
                Icon={QuestionMarkCircleIcon}
                path="/docs"
                label="Documentation"
                onClick={closeMenu}
              />
              <MenuButton
                Icon={LifebuoyIcon}
                label="Help"
                onClick={handleHelpClick}
              />
              <MenuButton
                Icon={ChatBubbleLeftIcon}
                label="Feedback"
                onClick={handleFeedbackClick}
              />
            </MenuSection>

            {/* Account Section */}
            <MenuSection label="Account">
              <SignOutButton onSignOut={closeMenu} />
            </MenuSection>
          </div>
        </div>
      )}

      <MobileFeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
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
      className="flex w-full items-center space-x-4 h-14 px-4 hover:bg-muted transition-colors"
    >
      <Icon className="h-6 w-6 text-muted-foreground" />
      <span className="text-foreground">
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
      className="flex w-full items-center space-x-4 h-14 px-4 hover:bg-muted transition-colors"
    >
      <Icon className="h-6 w-6 text-muted-foreground" />
      <span className="text-foreground">{label}</span>
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
      className="flex w-full items-center space-x-4 h-14 px-4 hover:bg-muted transition-colors"
    >
      <ArrowLeftOnRectangleIcon className="h-6 w-6 text-muted-foreground" />
      <span className="text-foreground">
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
      <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}
