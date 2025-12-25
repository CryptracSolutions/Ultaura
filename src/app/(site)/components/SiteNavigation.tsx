'use client';

import { useState } from 'react';
import Link from 'next/link';
import classNames from 'clsx';

import {
  Bars3Icon,
  XMarkIcon,
  NewspaperIcon,
  BookOpenIcon,
  PlayCircleIcon,
  CurrencyDollarIcon,
  InformationCircleIcon,
  QuestionMarkCircleIcon,
  ArrowRightOnRectangleIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';

import NavigationMenuItem from '~/core/ui/Navigation/NavigationItem';
import NavigationMenu from '~/core/ui/Navigation/NavigationMenu';
import useUserSession from '~/core/hooks/use-user-session';
import Logo from '~/core/ui/Logo';

const navLinks = [
  { label: 'Blog', path: '/blog', Icon: NewspaperIcon },
  { label: 'Documentation', path: '/docs', Icon: BookOpenIcon },
  { label: 'Demo', path: '/demo', Icon: PlayCircleIcon },
  { label: 'Pricing', path: '/pricing', Icon: CurrencyDollarIcon },
  { label: 'About', path: '/about', Icon: InformationCircleIcon },
  { label: 'FAQ', path: '/faq', Icon: QuestionMarkCircleIcon },
];

const authLinks = [
  { label: 'Sign In', path: '/auth/sign-in', Icon: ArrowRightOnRectangleIcon },
  { label: 'Sign Up', path: '/auth/sign-up', Icon: UserPlusIcon },
];

// Legacy links object for desktop navigation
const links = {
  Blog: { label: 'Blog', path: '/blog' },
  Docs: { label: 'Documentation', path: '/docs' },
  Demo: { label: 'Demo', path: '/demo' },
  Pricing: { label: 'Pricing', path: '/pricing' },
  About: { label: 'About', path: '/about' },
  FAQ: { label: 'FAQ', path: '/faq' },
};

const SiteNavigation = () => {
  const className = 'font-semibold';

  return (
    <>
      <div className={'hidden items-center space-x-0.5 lg:flex'}>
        <NavigationMenu>
          <NavigationMenuItem className={className} link={links.Blog} />
          <NavigationMenuItem className={className} link={links.Docs} />
          <NavigationMenuItem className={className} link={links.Demo} />
          <NavigationMenuItem className={className} link={links.Pricing} />
          <NavigationMenuItem className={className} link={links.About} />
          <NavigationMenuItem className={className} link={links.FAQ} />
        </NavigationMenu>
      </div>

      <div className={'flex items-center lg:hidden'}>
        <MobileMenu />
      </div>
    </>
  );
};

function MobileMenu() {
  const userSession = useUserSession();
  const [isVisible, setIsVisible] = useState(false);
  const [animationState, setAnimationState] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');

  const openMenu = () => {
    setIsVisible(true);
    setAnimationState('opening');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimationState('open');
      });
    });
  };

  const closeMenu = () => {
    setAnimationState('closing');
    setTimeout(() => {
      setIsVisible(false);
      setAnimationState('closed');
    }, 300);
  };

  return (
    <>
      {/* Hamburger Trigger */}
      <button
        onClick={openMenu}
        className="p-1"
        aria-label="Open menu"
      >
        <Bars3Icon className="h-9 w-9" />
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

          {/* Menu Content */}
          <div className="overflow-y-auto h-[calc(100vh-57px)]">
            {/* Navigate Section */}
            <MenuSection label="Navigate">
              {navLinks.map((item) => (
                <MenuLink
                  key={item.path}
                  Icon={item.Icon}
                  path={item.path}
                  label={item.label}
                  onClick={closeMenu}
                />
              ))}
            </MenuSection>

            {/* Account Section - only show if not signed in */}
            {!userSession && (
              <div className="px-4 py-6 space-y-3 border-t border-border mt-4">
                <Link
                  href="/auth/sign-up"
                  onClick={closeMenu}
                  className="flex w-full items-center justify-center gap-2 h-14 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg hover:bg-primary/90 transition-colors"
                >
                  <UserPlusIcon className="h-5 w-5" />
                  Sign Up
                </Link>
                <Link
                  href="/auth/sign-in"
                  onClick={closeMenu}
                  className="flex w-full items-center justify-center gap-2 h-14 px-4 rounded-xl border-2 border-border text-foreground font-semibold text-lg hover:bg-muted transition-colors"
                >
                  <ArrowRightOnRectangleIcon className="h-5 w-5" />
                  Sign In
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

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
      <span className="text-foreground">{label}</span>
    </Link>
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

export default SiteNavigation;
