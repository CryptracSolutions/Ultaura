'use client';

import { ChevronRightIcon } from '@heroicons/react/24/outline';

import Logo from '~/core/ui/Logo';
import Container from '~/core/ui/Container';
import If from '~/core/ui/If';
import Button from '~/core/ui/Button';
import SiteNavigation from './SiteNavigation';
import useSignOut from '~/core/hooks/use-sign-out';
import useUserSession from '~/core/hooks/use-user-session';

import ProfileDropdown from '~/components/ProfileDropdown';

import configuration from '~/configuration';

const SiteHeader = () => {
  const signOut = useSignOut();
  const userSession = useUserSession();

  return (
    <Container>
      <div className="flex py-2.5 px-1 items-center gap-4">
        <div className={'shrink-0'}>
          <Logo
            className={'h-10'}
            showWordmark
            wordmarkClassName={'text-2xl font-semibold leading-none'}
          />
        </div>

        <div className="ml-6 hidden min-w-0 flex-1 items-center rounded-2xl border border-border/70 bg-sidebar/95 pl-4 pr-0 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-sidebar/85 lg:flex lg:w-[75%] lg:flex-none lg:origin-left lg:scale-[1.2]">
          <SiteNavigation />

          <div className="ml-auto">
            <If condition={userSession} fallback={<AuthButtons />}>
              {(session) => (
                <ProfileDropdown
                  userSession={session}
                  signOutRequested={signOut}
                />
              )}
            </If>
          </div>
        </div>

        <div className={'ml-auto flex lg:hidden'}>
            <SiteNavigation />
        </div>
      </div>
    </Container>
  );
};

function AuthButtons() {
  return (
    <div className={'hidden shrink-0 items-center space-x-2 lg:flex'}>
      <Button
        round
        variant={'ghost'}
        href={configuration.paths.signIn}
        className="h-9 shrink-0 whitespace-nowrap [&>*]:py-1"
      >
        <span>Sign In</span>
      </Button>

      <Button
        round
        href={configuration.paths.signUp}
        className="h-9 shrink-0 whitespace-nowrap [&>*]:py-1"
      >
        <span className={'flex items-center space-x-2'}>
          <span>Sign Up</span>
          <ChevronRightIcon className={'h-4'} />
        </span>
      </Button>
    </div>
  );
}

export default SiteHeader;
