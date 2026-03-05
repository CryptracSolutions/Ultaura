'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import classNames from 'clsx';

import {
  ArrowLeftOnRectangleIcon,
  Squares2X2Icon,
  BuildingLibraryIcon,
  UserIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '~/core/ui/Dropdown';
import { Dialog, DialogContent, DialogTitle } from '~/core/ui/Dialog';
import Trans from '~/core/ui/Trans';

import configuration from '~/configuration';
import ProfileAvatar from '~/components/ProfileAvatar';
import type UserSession from '~/core/session/types/user-session';

import If from '~/core/ui/If';
import GlobalRole from '~/core/session/types/global-role';
import useUser from '~/core/hooks/use-user';
import MembershipRole from '~/lib/organizations/types/membership-role';

const ProfileDropdown: React.FCC<{
  userSession: Maybe<UserSession>;
  signOutRequested: () => unknown;
  displayName?: boolean;
  className?: string;
  accountName?: string;
  planLabel?: string;
}> = ({ userSession, signOutRequested, displayName, className, accountName, planLabel }) => {
  const { data: user } = useUser();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const signedInAsLabel = useMemo(() => {
    const email = userSession?.auth?.user.email || undefined;
    const phone = userSession?.auth?.user.phone || undefined;

    return email ?? phone;
  }, [userSession]);

  const displayLabel = userSession?.data?.displayName || accountName;

  const isSuperAdmin = useMemo(() => {
    return user?.app_metadata.role === GlobalRole.SuperAdmin;
  }, [user]);
  const isViewer = Number(userSession?.role) === Number(MembershipRole.Viewer);

  const handleSignOut = () => {
    setIsSheetOpen(false);
    signOutRequested();
  };

  return (
    <>
      <DropdownMenu
        open={isMenuOpen}
        onOpenChange={(open) => {
          if (
            open &&
            typeof window !== 'undefined' &&
            !window.matchMedia('(min-width: 640px)').matches
          ) {
            setIsSheetOpen(true);
          } else {
            setIsMenuOpen(open);
          }
        }}
      >
        <DropdownMenuTrigger
          aria-label="Open your profile menu"
          data-cy={'profile-dropdown-trigger'}
          className={classNames(
            'flex cursor-pointer focus:outline-none items-center transition-colors hover:bg-primary/10',
            className,
            {
              ['items-center space-x-2.5 rounded-lg p-2']: displayName,
              ['rounded-md p-1']: !displayName,
            },
          )}
        >
          <ProfileAvatar user={userSession} />

          <If condition={displayName}>
            <div className={'flex flex-col text-center w-full truncate'}>
              <span className={'text-sm truncate'}>{displayLabel}</span>
              {planLabel && (
                <span className={'text-xs text-muted-foreground truncate'}>{planLabel}</span>
              )}
            </div>
          </If>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          className={displayName ? '!min-w-0' : '!min-w-[15rem]'}
          align={'center'}
          sideOffset={8}
          style={displayName ? { width: 'var(--radix-dropdown-menu-trigger-width)' } : undefined}
        >
          <DropdownMenuItem className={'!h-10 rounded-none'}>
            <div
              className={'flex flex-col justify-start truncate text-left text-xs'}
            >
              <div className={'text-gray-500'}>
                <Trans i18nKey={'common:signedInAs'} />
              </div>

              <div>
                <span className={'block truncate'}>{signedInAsLabel}</span>
              </div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link
              className={'flex h-full w-full items-center space-x-2'}
              href={configuration.paths.appHome}
            >
              <Squares2X2Icon className={'h-5'} />
              <span>
                <Trans i18nKey={'common:homeTabLabel'} defaults={'Home'} />
              </span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link
              className={'flex h-full w-full items-center space-x-2'}
              href={`${configuration.paths.appPrefix}/${configuration.paths.settings.profile}`}
            >
              <UserIcon className={'h-5'} />
              <span>
                <Trans i18nKey={'common:profileSettingsTabLabel'} />
              </span>
            </Link>
          </DropdownMenuItem>

          {!isViewer ? (
            <DropdownMenuItem asChild>
              <Link
                className={'flex h-full w-full items-center space-x-2'}
                href={`${configuration.paths.appPrefix}/${configuration.paths.settings.subscription}`}
              >
                <CreditCardIcon className={'h-5'} />
                <span>
                  <Trans i18nKey={'common:subscriptionSettingsTabLabel'} />
                </span>
              </Link>
            </DropdownMenuItem>
          ) : null}

          <If condition={isSuperAdmin}>
            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link
                className={'flex h-full w-full items-center space-x-2'}
                href={'/admin'}
              >
                <BuildingLibraryIcon className={'h-5'} />
                <span>Admin</span>
              </Link>
            </DropdownMenuItem>
          </If>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            role={'button'}
            className={'cursor-pointer'}
            onClick={signOutRequested}
          >
            <span className={'flex w-full items-center space-x-2'}>
              <ArrowLeftOnRectangleIcon className={'h-5'} />

              <span>
                <Trans i18nKey={'auth:signOut'} />
              </span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Mobile Bottom Sheet */}
      <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DialogContent
          className="z-[60] p-0"
          overlayClassName="z-[60]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogTitle className="px-5 pt-5 pb-2 text-base font-semibold">
            {displayLabel || 'Account'}
          </DialogTitle>
          <div className="pb-2">
            {/* Signed in as */}
            <div className="flex w-full items-center h-[50px] px-5">
              <div className="text-xs text-muted-foreground">
                Signed in as {signedInAsLabel}
              </div>
            </div>

            <Link
              href={configuration.paths.appHome}
              onClick={() => setIsSheetOpen(false)}
              className="flex w-full items-center space-x-4 h-14 px-4 hover:bg-muted transition-colors touch-manipulation"
            >
              <Squares2X2Icon className="h-6 w-6 text-primary" />
              <span className="text-foreground">Home</span>
            </Link>

            <Link
              href={`${configuration.paths.appPrefix}/${configuration.paths.settings.profile}`}
              onClick={() => setIsSheetOpen(false)}
              className="flex w-full items-center space-x-4 h-14 px-4 hover:bg-muted transition-colors touch-manipulation"
            >
              <UserIcon className="h-6 w-6 text-primary" />
              <span className="text-foreground">Profile</span>
            </Link>

            {!isViewer ? (
              <Link
                href={`${configuration.paths.appPrefix}/${configuration.paths.settings.subscription}`}
                onClick={() => setIsSheetOpen(false)}
                className="flex w-full items-center space-x-4 h-14 px-4 hover:bg-muted transition-colors touch-manipulation"
              >
                <CreditCardIcon className="h-6 w-6 text-primary" />
                <span className="text-foreground">Subscription</span>
              </Link>
            ) : null}

            {isSuperAdmin && (
              <Link
                href="/admin"
                onClick={() => setIsSheetOpen(false)}
                className="flex w-full items-center space-x-4 h-14 px-4 hover:bg-muted transition-colors touch-manipulation"
              >
                <BuildingLibraryIcon className="h-6 w-6 text-primary" />
                <span className="text-foreground">Admin</span>
              </Link>
            )}

            <button
              onClick={handleSignOut}
              className="flex w-full items-center space-x-4 h-14 px-4 hover:bg-muted transition-colors touch-manipulation"
            >
              <ArrowLeftOnRectangleIcon className="h-6 w-6 text-primary" />
              <span className="text-foreground">Sign Out</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProfileDropdown;
