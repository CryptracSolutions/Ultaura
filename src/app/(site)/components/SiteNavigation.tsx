'use client';

import { useState, useRef } from 'react';
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
  ChevronDownIcon,
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

const resourceLinks = [
  { label: 'FAQ', path: '/faq', Icon: QuestionMarkCircleIcon },
  { label: 'Contact', path: '/contact', Icon: EnvelopeIcon },
  { label: 'Documentation', path: '/docs', Icon: BookOpenIcon },
];

const desktopLinks = [
  { label: 'Demo', path: '/demo' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'Vision', path: '/vision' },
  { label: 'Blog', path: '/blog' },
];

const navItemClassName = [
  'font-semibold relative',
  "after:content-[''] after:absolute after:bottom-0 after:left-[10px] after:right-[10px] after:h-[1px] after:bg-primary",
  'after:[transform:scaleX(0)] after:[transform-origin:right_center]',
  'after:[transition:transform_0.3s_cubic-bezier(0.25,1,0.5,1)]',
  'hover:after:[transform:scaleX(1)] hover:after:[transform-origin:left_center]',
].join(' ');

function SiteNavigation() {
  return (
    <>
      <div className="hidden items-center space-x-0.5 lg:flex">
        <NavigationMenu scrollable>
          {desktopLinks.map((link) => (
            <NavigationMenuItem key={link.path} className={navItemClassName} link={link} />
          ))}
        </NavigationMenu>
        <ResourcesDropdown />
      </div>

      <div className="flex items-center lg:hidden">
        <MobileMenu />
      </div>
    </>
  );
}

function ResourcesDropdown() {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className={classNames(
          'flex items-center gap-1 px-4 py-2 text-sm font-semibold text-foreground/80 hover:text-foreground transition-colors',
        )}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Resources
        <ChevronDownIcon
          className={classNames('h-3.5 w-3.5 transition-transform duration-200', {
            'rotate-180': open,
          })}
        />
      </button>

      {open && (
        <div className="absolute top-full mt-1 rounded-xl border border-border/60 bg-sidebar/95 py-2 shadow-xl backdrop-blur z-50 min-w-[160px]">
          {resourceLinks.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-muted/50 transition-colors"
              onClick={() => setOpen(false)}
            >
              <item.Icon className="h-4 w-4 text-primary shrink-0" />
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

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
        className="p-2 hover:bg-muted rounded-md transition-colors"
        aria-label="Open menu"
      >
        <Bars3Icon className="h-6 w-6" />
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
