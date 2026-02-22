'use client';

import { Bars3Icon } from '@heroicons/react/24/outline';

function AdminMobileHeader({ onMenuOpen }: { onMenuOpen: () => void }) {
  return (
    <div className="sticky top-0 z-40 flex items-center px-4 py-3 border-b border-border/60 bg-sidebar lg:hidden">
      <button
        onClick={onMenuOpen}
        className="p-2 hover:bg-muted rounded-md transition-colors"
        aria-label="Open menu"
      >
        <Bars3Icon className="h-6 w-6" />
      </button>
      <span className="ml-3 text-sm font-semibold text-foreground">Admin</span>
    </div>
  );
}

export default AdminMobileHeader;
