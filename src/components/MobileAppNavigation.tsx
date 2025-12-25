'use client';

import { useState } from 'react';
import Link from 'next/link';

import {
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  QuestionMarkCircleIcon,
  ChatBubbleLeftIcon,
  PhoneIcon,
  BellIcon,
  PhoneArrowUpRightIcon,
  LifebuoyIcon,
} from '@heroicons/react/24/outline';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '~/core/ui/Dropdown';

import Trans from '~/core/ui/Trans';

import NAVIGATION_CONFIG from '../navigation.config';
import useCurrentOrganization from '~/lib/organizations/hooks/use-current-organization';
import useSignOut from '~/core/hooks/use-sign-out';

import { useHelpPanel } from '~/lib/contexts/HelpPanelContext';
import { MobileFeedbackModal } from '~/components/MobileFeedbackModal';

const MobileAppNavigation = () => {
  const currentOrganization = useCurrentOrganization();
  const { open: openHelp } = useHelpPanel();
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  if (!currentOrganization?.uuid) {
    return null;
  }

  const handleHelpClick = () => {
    setMenuOpen(false);
    openHelp();
  };

  const handleFeedbackClick = () => {
    setMenuOpen(false);
    setFeedbackOpen(true);
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
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger>
          <Bars3Icon className={'h-9'} />
        </DropdownMenuTrigger>

        <DropdownMenuContent sideOffset={10} className={'rounded-none w-screen max-h-[calc(100vh-60px)] overflow-y-auto'}>
          {/* Menu Section */}
          <MenuSection label="Menu">
            {mainNavItems.map((item) => (
              <DropdownLink
                key={item.path}
                Icon={item.Icon}
                path={item.path}
                label={item.label}
              />
            ))}
          </MenuSection>

          {/* Settings Section */}
          {settingsGroup && (
            <MenuSection label="Settings">
              {settingsGroup.children.map((child) => (
                <DropdownLink
                  key={child.path}
                  Icon={child.Icon}
                  path={child.path}
                  label={child.label}
                />
              ))}
            </MenuSection>
          )}

          {/* Quick Actions Section */}
          <MenuSection label="Quick Actions">
            <DropdownMenuItem asChild>
              <Link
                href="/dashboard/lines?action=add"
                className="flex w-full items-center space-x-4 h-12"
              >
                <PhoneIcon className="h-6" />
                <span>Add Line</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                href="/dashboard/reminders?action=add"
                className="flex w-full items-center space-x-4 h-12"
              >
                <BellIcon className="h-6" />
                <span>Add Reminder</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                href="/dashboard/calls?action=add"
                className="flex w-full items-center space-x-4 h-12"
              >
                <PhoneArrowUpRightIcon className="h-6" />
                <span>Schedule Call</span>
              </Link>
            </DropdownMenuItem>
          </MenuSection>

          {/* Support Section */}
          <MenuSection label="Support">
            <DropdownMenuItem asChild>
              <Link
                href="/docs"
                className="flex w-full items-center space-x-4 h-12"
              >
                <QuestionMarkCircleIcon className="h-6" />
                <span>Documentation</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem
              className="flex w-full items-center space-x-4 h-12 cursor-pointer"
              onSelect={handleHelpClick}
            >
              <LifebuoyIcon className="h-6" />
              <span>Help</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              className="flex w-full items-center space-x-4 h-12 cursor-pointer"
              onSelect={handleFeedbackClick}
            >
              <ChatBubbleLeftIcon className="h-6" />
              <span>Feedback</span>
            </DropdownMenuItem>
          </MenuSection>

          {/* Account Section */}
          <MenuSection label="Account">
            <SignOutDropdownItem />
          </MenuSection>
        </DropdownMenuContent>
      </DropdownMenu>

    <MobileFeedbackModal
      isOpen={feedbackOpen}
      onClose={() => setFeedbackOpen(false)}
    />
  </>
  );
};

export default MobileAppNavigation;

function DropdownLink(
  props: React.PropsWithChildren<{
    path: string;
    label: string;
    Icon: React.ElementType;
  }>,
) {
  return (
    <DropdownMenuItem asChild key={props.path}>
      <Link
        href={props.path}
        className={'flex w-full items-center space-x-4 h-12'}
      >
        <props.Icon className={'h-6'} />

        <span>
          <Trans i18nKey={props.label} defaults={props.label} />
        </span>
      </Link>
    </DropdownMenuItem>
  );
}

function SignOutDropdownItem() {
  const signOut = useSignOut();

  return (
    <DropdownMenuItem
      className={'flex w-full items-center space-x-4 h-12'}
      onClick={signOut}
    >
      <ArrowLeftOnRectangleIcon className={'h-6'} />

      <span>
        <Trans i18nKey={'common:signOut'} defaults={'Sign out'} />
      </span>
    </DropdownMenuItem>
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
    <div className="py-1">
      <DropdownMenuLabel className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </DropdownMenuLabel>
      {children}
    </div>
  );
}
