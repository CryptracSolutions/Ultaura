'use client';

import { EyeIcon } from '@heroicons/react/24/outline';
import { usePathname } from 'next/navigation';

import { useViewerContext } from '~/lib/contexts/viewer';

function ViewerModeBanner() {
  const { isViewer } = useViewerContext();
  const pathname = usePathname();

  if (!isViewer || pathname?.startsWith('/dashboard/settings/profile')) {
    return null;
  }

  return (
    <div className="mx-container mt-2 hidden lg:block">
      <div className="inline-flex items-center gap-1.5 rounded-md border border-primary px-2.5 py-1 text-xs font-medium text-primary">
        <EyeIcon className="h-3.5 w-3.5 shrink-0" />
        <span>View only access</span>
      </div>
    </div>
  );
}

export default ViewerModeBanner;
