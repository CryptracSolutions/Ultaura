'use client';

import { LineTabNav } from './LineTabNav';
import { LineSelectorTabs, type LineSelectorLine } from '~/components/ultaura/LineSelectorTabs';

interface LinePageHeaderProps {
  lines: LineSelectorLine[];
  currentLineShortId: string;
  actions?: React.ReactNode;
  showTabs?: boolean;
  actionsSlotId?: string;
}

export function LinePageHeader({
  lines,
  currentLineShortId,
  actions,
  showTabs = true,
  actionsSlotId,
}: LinePageHeaderProps) {
  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-col gap-[14.4px] sm:flex-row sm:items-center sm:justify-between">
        {actions ? (
          <div className="w-full sm:w-auto">{actions}</div>
        ) : actionsSlotId ? (
          <div id={actionsSlotId} className="w-full sm:w-auto" />
        ) : null}

        {lines.length > 1 ? (
          <LineSelectorTabs
            lines={lines}
            currentLineShortId={currentLineShortId}
            section="lines"
          />
        ) : null}
      </div>

      {showTabs ? <LineTabNav lineShortId={currentLineShortId} /> : null}
    </div>
  );
}
