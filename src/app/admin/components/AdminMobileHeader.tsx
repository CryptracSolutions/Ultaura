'use client';

import { Bars3Icon } from '@heroicons/react/24/outline';
import Logo from '~/core/ui/Logo';
import ProfileDropdown from '~/components/ProfileDropdown';
import useUserSession from '~/core/hooks/use-user-session';
import useSignOut from '~/core/hooks/use-sign-out';

function AdminMobileHeader({ onMenuOpen }: { onMenuOpen: () => void }) {
  const userSession = useUserSession();
  const signOut = useSignOut();

  return (
    <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b border-border/60 bg-sidebar lg:hidden">
      <Logo
        href="/"
        label="Home Page"
        className="h-10"
        showWordmark
        wordmarkClassName="text-2xl font-semibold leading-none text-primary"
      />
      <div className="flex items-center gap-2">
        <ProfileDropdown
          displayName={false}
          userSession={userSession}
          signOutRequested={signOut}
          accountName="Admin"
        />
        <button
          onClick={onMenuOpen}
          className="p-2 hover:bg-muted rounded-md transition-colors"
          aria-label="Open menu"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}

export default AdminMobileHeader;
