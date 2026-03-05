'use client';

import { EyeIcon, Bars3Icon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import Logo from '~/core/ui/Logo';
import ProfileDropdown from '~/components/ProfileDropdown';
import useUserSession from '~/core/hooks/use-user-session';
import useSignOut from '~/core/hooks/use-sign-out';
import useCurrentOrganization from '~/lib/organizations/hooks/use-current-organization';
import { Dialog, DialogContent, DialogTitle } from '~/core/ui/Dialog';
import { useViewerContext } from '~/lib/contexts/viewer';

const MobileDashboardHeader: React.FC<{
  onMenuOpen: () => void;
}> = ({ onMenuOpen }) => {
  const userSession = useUserSession();
  const signOut = useSignOut();
  const organization = useCurrentOrganization();
  const { isViewer } = useViewerContext();
  const [isViewOnlySheetOpen, setIsViewOnlySheetOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b border-border/60 bg-sidebar lg:hidden">
        <Logo
          href="/"
          label="Home Page"
          className="h-10"
          showWordmark
          wordmarkClassName="text-2xl font-semibold leading-none text-primary"
        />
        <div className="flex items-center gap-2">
          {isViewer && (
            <button
              onClick={() => setIsViewOnlySheetOpen(true)}
              className="rounded-md p-1.5 text-primary transition-colors hover:bg-primary/10"
              aria-label="View only access details"
            >
              <EyeIcon className="h-5 w-5" />
            </button>
          )}

          <ProfileDropdown
            displayName={false}
            userSession={userSession}
            signOutRequested={signOut}
            accountName={organization?.name}
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

      <Dialog open={isViewOnlySheetOpen} onOpenChange={setIsViewOnlySheetOpen}>
        <DialogContent
          className="z-[60] p-0"
          overlayClassName="z-[60]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogTitle className="px-5 pt-5 pb-2 text-base font-semibold">
            View only access
          </DialogTitle>
          <div className="px-5 pb-5 text-sm text-muted-foreground">
            You can view shared dashboard information, but changes to account settings and care data are restricted.
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MobileDashboardHeader;
