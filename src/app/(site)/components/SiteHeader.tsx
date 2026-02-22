'use client';

import Logo from '~/core/ui/Logo';
import Container from '~/core/ui/Container';
import If from '~/core/ui/If';
import Button from '~/core/ui/Button';
import SiteNavigation from './SiteNavigation';
import useSignOut from '~/core/hooks/use-sign-out';
import useUserSession from '~/core/hooks/use-user-session';

import ProfileDropdown from '~/components/ProfileDropdown';

import configuration from '~/configuration';

function SiteHeader() {
  const signOut = useSignOut();
  const userSession = useUserSession();

  return (
    <>
      <div className="-mx-2 flex items-center justify-between px-4 py-3 border-b border-border/60 bg-sidebar lg:hidden">
        <Logo
          className="h-10"
          showWordmark
          wordmarkClassName="text-2xl font-semibold leading-none text-primary"
        />
        <div className="flex items-center gap-2">
          <If condition={userSession}>
            {(session) => (
              <ProfileDropdown
                userSession={session}
                signOutRequested={signOut}
              />
            )}
          </If>
          <SiteNavigation />
        </div>
      </div>

      <div className="max-lg:hidden">
        <Container>
          <div className="flex items-center gap-4 px-4 py-3 lg:px-1 lg:py-2.5">
            <div className="shrink-0">
              <Logo
                className="h-10"
                showWordmark
                wordmarkClassName="text-2xl font-semibold leading-none"
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
          </div>
        </Container>
      </div>
    </>
  );
}

function AuthButtons() {
  return (
    <div className={'hidden shrink-0 items-center space-x-2 lg:flex'}>
      <Button
        round
        variant={'ghost'}
        href={configuration.paths.signIn}
        className="h-9 shrink-0 whitespace-nowrap text-sm [&>*]:py-1"
      >
        <span>Sign In</span>
      </Button>

      <Button
        round
        href={configuration.paths.signUp}
        className="h-9 shrink-0 whitespace-nowrap animate-[pulse-glow_3s_ease-in-out_infinite] [&>*]:py-1"
      >
        <span>Start free trial</span>
      </Button>
    </div>
  );
}

export default SiteHeader;
