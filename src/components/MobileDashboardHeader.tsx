'use client';

import { Bars3Icon } from '@heroicons/react/24/outline';
import Logo from '~/core/ui/Logo';
import ProfileDropdown from '~/components/ProfileDropdown';
import useUserSession from '~/core/hooks/use-user-session';
import useSignOut from '~/core/hooks/use-sign-out';
import useCurrentOrganization from '~/lib/organizations/hooks/use-current-organization';

const MobileDashboardHeader: React.FC<{
  onMenuOpen: () => void;
}> = ({ onMenuOpen }) => {
  const userSession = useUserSession();
  const signOut = useSignOut();
  const organization = useCurrentOrganization();

  return (
    <div className="sticky top-0 z-40 bg-background lg:hidden px-container">
      <div className="flex items-center justify-between gap-4 pt-3 pb-1.5 px-1">
        <div className="shrink-0">
          <Logo
            className="h-10"
            showWordmark
            wordmarkClassName="text-2xl font-semibold leading-none"
          />
        </div>

        <div className="flex shrink-0 items-center justify-end space-x-4">
          <ProfileDropdown
            displayName={false}
            userSession={userSession}
            signOutRequested={signOut}
            accountName={organization?.name}
          />

          <button
            onClick={onMenuOpen}
            className="p-1"
            aria-label="Open menu"
          >
            <Bars3Icon className="h-9 w-9" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileDashboardHeader;
