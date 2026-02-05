'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import classNames from 'clsx';

import {
  ArrowLeftOnRectangleIcon,
  Squares2X2Icon,
  BuildingLibraryIcon,
  EllipsisVerticalIcon,
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

const ProfileDropdown: React.FCC<{
  userSession: Maybe<UserSession>;
  signOutRequested: () => unknown;
  displayName?: boolean;
  className?: string;
  accountName?: string;
}> = ({ userSession, signOutRequested, displayName, className, accountName }) => {
  const { data: user } = useUser();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const signedInAsLabel = useMemo(() => {
    const email = userSession?.auth?.user.email || undefined;
    const phone = userSession?.auth?.user.phone || undefined;

    return email ?? phone;
  }, [userSession]);

  const displayLabel = userSession?.data?.displayName || accountName;

  const isSuperAdmin = useMemo(() => {
    return user?.app_metadata.role === GlobalRole.SuperAdmin;
  }, [user]);

  const handleSignOut = () => {
    setIsSheetOpen(false);
    signOutRequested();
  };

  return (
    <>
      <DropdownMenu
        onOpenChange={(open) => {
          if (
            open &&
            typeof window !== 'undefined' &&
            !window.matchMedia('(min-width: 640px)').matches
          ) {
            setIsSheetOpen(true);
          }
        }}
      >
        <DropdownMenuTrigger
          aria-label="Open your profile menu"
          data-cy={'profile-dropdown-trigger'}
          className={classNames(
            'flex cursor-pointer focus:outline-none group items-center',
            className,
            {
              ['items-center space-x-2.5 rounded-lg border border-primary' +
              ' p-2 transition-colors transition-shadow' +
              ' shadow-[0_0_0_1px_oklch(0.696_0.119_180.426)]' +
              ' dark:shadow-[0_0_0_1px_oklch(0.75_0.12_180.426)]']: displayName,
            },
          )}
        >
          <ProfileAvatar user={userSession} />

          <If condition={displayName}>
            <div className={'flex flex-col text-center w-full truncate'}>
              <span className={'text-sm truncate'}>{displayLabel}</span>

              <span
                className={'text-xs text-gray-500 dark:text-gray-400 truncate'}
              >
                {signedInAsLabel}
              </span>
            </div>

            <EllipsisVerticalIcon
              className={'h-8 hidden text-gray-500 group-hover:flex'}
            />
          </If>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          className={'!min-w-[15rem]'}
          collisionPadding={{ right: 20, left: 20 }}
          sideOffset={20}
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
              className="flex w-full items-center space-x-[14px] h-[50px] px-[14px] hover:bg-muted transition-colors touch-manipulation"
            >
              <Squares2X2Icon className="h-[22px] w-[22px] text-primary" />
              <span className="text-[14.5px] text-foreground">Home</span>
            </Link>

            <Link
              href={`${configuration.paths.appPrefix}/${configuration.paths.settings.profile}`}
              onClick={() => setIsSheetOpen(false)}
              className="flex w-full items-center space-x-[14px] h-[50px] px-[14px] hover:bg-muted transition-colors touch-manipulation"
            >
              <UserIcon className="h-[22px] w-[22px] text-primary" />
              <span className="text-[14.5px] text-foreground">Profile Settings</span>
            </Link>

            <Link
              href={`${configuration.paths.appPrefix}/${configuration.paths.settings.subscription}`}
              onClick={() => setIsSheetOpen(false)}
              className="flex w-full items-center space-x-[14px] h-[50px] px-[14px] hover:bg-muted transition-colors touch-manipulation"
            >
              <CreditCardIcon className="h-[22px] w-[22px] text-primary" />
              <span className="text-[14.5px] text-foreground">Subscription Settings</span>
            </Link>

            {isSuperAdmin && (
              <Link
                href="/admin"
                onClick={() => setIsSheetOpen(false)}
                className="flex w-full items-center space-x-[14px] h-[50px] px-[14px] hover:bg-muted transition-colors touch-manipulation"
              >
                <BuildingLibraryIcon className="h-[22px] w-[22px] text-primary" />
                <span className="text-[14.5px] text-foreground">Admin</span>
              </Link>
            )}

            <button
              onClick={handleSignOut}
              className="flex w-full items-center space-x-[14px] h-[50px] px-[14px] hover:bg-muted transition-colors touch-manipulation"
            >
              <ArrowLeftOnRectangleIcon className="h-[22px] w-[22px] text-primary" />
              <span className="text-[14.5px] text-foreground">Sign Out</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProfileDropdown;
