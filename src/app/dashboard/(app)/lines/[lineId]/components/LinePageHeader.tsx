'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LineTabNav } from './LineTabNav';
import MobileAppNavigation from '~/components/MobileAppNavigation';

interface LinePageHeaderProps {
  lineName: string;
  lineShortId: string;
  phoneE164: string;
  timezone: string;
  status: string;
  isVerified: boolean;
  actions?: React.ReactNode;
  showTabs?: boolean;
}

export function LinePageHeader({
  lineName,
  lineShortId,
  actions,
  showTabs = true,
}: LinePageHeaderProps) {
  return (
    <div className="mb-6 pt-3 sm:pt-0 md:pt-3">
      {/* Title row with mobile nav */}
      <div className="flex items-center space-x-2 mb-2">
        <div className="lg:hidden">
          <MobileAppNavigation />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{lineName}</h1>
      </div>

      {/* Back link */}
      <Link
        href="/dashboard/lines"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Lines
      </Link>

      {/* Action buttons */}
      {actions ? <div className="w-full sm:w-auto mb-4">{actions}</div> : null}

      {/* Tab navigation */}
      {showTabs ? <LineTabNav lineShortId={lineShortId} /> : null}
    </div>
  );
}
