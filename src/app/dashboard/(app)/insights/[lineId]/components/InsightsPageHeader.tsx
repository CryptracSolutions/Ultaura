
'use client';

import { LineSelectorTabs } from '~/components/ultaura/LineSelectorTabs';
import type { LineStatus } from '~/lib/ultaura/types';
import { InsightsTabNav } from './InsightsTabNav';

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
      {/* Line selector tabs (when multiple lines) */}
      {lines.length > 1 && (
        <div className="mb-3 w-full sm:w-[16rem] rounded-xl ring-1 ring-primary">
          <LineSelectorTabs
            lines={lines}
            currentLineShortId={currentLineShortId}
            section="insights"
          />
        </div>
      )}

      {/* Section tab navigation */}
      <InsightsTabNav lineShortId={currentLineShortId} />
    </div>
  );
}
