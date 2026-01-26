'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LineTabNav } from './LineTabNav';

interface LinePageHeaderProps {
  lineName: string;
  lineShortId: string;
  phoneE164: string;
  timezone: string;
  status: string;
  isVerified: boolean;
  actions?: React.ReactNode;
}

export function LinePageHeader({ lineName, lineShortId, actions }: LinePageHeaderProps) {
  return (
    <div className="mb-6 pt-3 sm:pt-0">
      {/* Back link */}
      <Link
        href="/dashboard/lines"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Lines
      </Link>

      {/* Line info row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{lineName}</h1>
        </div>
        {actions ? <div className="w-full sm:w-auto">{actions}</div> : null}
      </div>

      {/* Tab navigation */}
      <LineTabNav lineShortId={lineShortId} />
    </div>
  );
}
