'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { InsightsTabNav } from './InsightsTabNav';
import { InsightsLineTabs } from '../../components/InsightsLineTabs';
import type { LineStatus } from '~/lib/ultaura/types';

interface LineOption {
  id: string;
  short_id: string;
  display_name: string;
  status: LineStatus;
  insights_enabled: boolean;
}

interface InsightsPageHeaderProps {
  lines: LineOption[];
  currentLineShortId: string;
}

export function InsightsPageHeader({
  lines,
  currentLineShortId,
}: InsightsPageHeaderProps) {
  return (
    <div className="mb-6">
      {/* Back link */}
      <Link
        href="/dashboard/insights"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Insights
      </Link>

      {/* Line selector tabs (when multiple lines) */}
      {lines.length > 1 && (
        <div className="mb-6">
          <InsightsLineTabs lines={lines} currentLineShortId={currentLineShortId} />
        </div>
      )}

      {/* Section tab navigation */}
      <InsightsTabNav lineShortId={currentLineShortId} />
    </div>
  );
}
