'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import Link from 'next/link';
import classNames from 'clsx';

import {
  ArrowLeftIcon,
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
} from '@heroicons/react/24/outline';

import Logo from '~/core/ui/Logo';

const NEWSLETTER_PATH = '/admin/newsletter';
const BROADCASTS_PATH = '/admin/newsletter/broadcasts';
const CHANGELOG_PATH = '/admin/changelog';

function AdminMobileNavigation({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
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
      className={classNames(
        'fixed inset-0 z-50 bg-sidebar transition-transform duration-300 ease-out',
        {
          'translate-x-0': animationState === 'open',
          '-translate-x-full': animationState === 'opening' || animationState === 'closing',
        }
      )}
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
          <MenuLink path="/admin" label="Overview" Icon={HomeIcon} onClick={closeMenu} />
          <MenuLink path="/admin/search" label="Search" Icon={MagnifyingGlassIcon} onClick={closeMenu} />
        </div>

        <MenuSection label="Manage">
          {manageItems.map((item) => (
            <MenuLink key={item.path} path={item.path} label={item.label} Icon={item.Icon} onClick={closeMenu} />
          ))}
        </MenuSection>

        <MenuSection label="Content">
          {contentItems.map((item) => (
            <MenuLink key={item.path} path={item.path} label={item.label} Icon={item.Icon} onClick={closeMenu} />
          ))}
        </MenuSection>

        <MenuSection label="Observe">
          {observeItems.map((item) => (
            <MenuLink key={item.path} path={item.path} label={item.label} Icon={item.Icon} onClick={closeMenu} />
          ))}
        </MenuSection>

        <div className="py-2">
          <MenuLink path="/dashboard" label="Back to App" Icon={ArrowLeftIcon} onClick={closeMenu} />
        </div>
      </div>
    </div>
  );
}

export default AdminMobileNavigation;

function MenuLink({
  path,
  label,
  Icon,
  onClick,
}: {
  path: string;
  label: string;
  Icon: ElementType;
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

function MenuSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
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
