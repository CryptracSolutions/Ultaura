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
  EnvelopeIcon,
  ArrowRightOnRectangleIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';

import NavigationMenuItem from '~/core/ui/Navigation/NavigationItem';
import NavigationMenu from '~/core/ui/Navigation/NavigationMenu';
import useUserSession from '~/core/hooks/use-user-session';
import Logo from '~/core/ui/Logo';

const navLinks = [
  { label: 'Demo', path: '/demo', Icon: PlayCircleIcon },
  { label: 'Pricing', path: '/pricing', Icon: CurrencyDollarIcon },
  { label: 'Vision', path: '/vision', Icon: InformationCircleIcon },
  { label: 'Blog', path: '/blog', Icon: NewspaperIcon },
  { label: 'FAQ', path: '/faq', Icon: QuestionMarkCircleIcon },
  { label: 'Contact', path: '/contact', Icon: EnvelopeIcon },
  { label: 'Documentation', path: '/docs', Icon: BookOpenIcon },
];

const authLinks = [
  { label: 'Sign In', path: '/auth/sign-in', Icon: ArrowRightOnRectangleIcon },
  { label: 'Sign Up', path: '/auth/sign-up', Icon: UserPlusIcon },
];

// Legacy links object for desktop navigation
const links = {
  Demo: { label: 'Demo', path: '/demo' },
  Pricing: { label: 'Pricing', path: '/pricing' },
  Vision: { label: 'Vision', path: '/vision' },
  Blog: { label: 'Blog', path: '/blog' },
  FAQ: { label: 'FAQ', path: '/faq' },
  Contact: { label: 'Contact', path: '/contact' },
  Docs: { label: 'Documentation', path: '/docs' },
};

const SiteNavigation = () => {
  const className = [
    'font-semibold relative',
    "after:content-[''] after:absolute after:bottom-0 after:left-[10px] after:right-[10px] after:h-[1px] after:bg-primary",
    'after:[transform:scaleX(0)] after:[transform-origin:right_center]',
    'after:[transition:transform_0.3s_cubic-bezier(0.25,1,0.5,1)]',
    'hover:after:[transform:scaleX(1)] hover:after:[transform-origin:left_center]',
  ].join(' ');

  return (
    <>
      <div className={'hidden items-center space-x-0.5 lg:flex'}>
        <NavigationMenu scrollable>
          <NavigationMenuItem className={className} link={links.Demo} />
          <NavigationMenuItem className={className} link={links.Pricing} />
          <NavigationMenuItem className={className} link={links.Vision} />
          <NavigationMenuItem className={className} link={links.Blog} />
          <NavigationMenuItem className={className} link={links.FAQ} />
          <NavigationMenuItem className={className} link={links.Contact} />
          <NavigationMenuItem className={className} link={links.Docs} />
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
            'fixed inset-0 z-50 bg-sidebar transition-transform duration-300 ease-out',
            {
              'translate-x-0': animationState === 'open',
              '-translate-x-full': animationState === 'opening' || animationState === 'closing',
            }
          )}
        >
          {/* Header with Close Button */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <Logo
              href="/"
              className="h-10"
              label="Home"
              showWordmark
              wordmarkClassName="text-2xl font-semibold leading-none text-primary"
              onClick={closeMenu}
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
          <div className="overflow-y-auto h-[calc(100dvh-57px)]">
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
