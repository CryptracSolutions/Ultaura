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
    <div className="-mt-2 mb-5 space-y-3">
      <div className="flex flex-col gap-[14.4px] sm:flex-row sm:items-center sm:justify-between">
        {actions ? (
          <div className="w-full sm:w-auto">{actions}</div>
        ) : actionsSlotId ? (
          <div id={actionsSlotId} className="w-full sm:w-auto" />
        ) : null}
      </div>

      {lines.length > 1 ? (
        <div className="w-full sm:w-[16rem] rounded-xl ring-2 ring-primary">
          <LineSelectorTabs
            lines={lines}
            currentLineShortId={currentLineShortId}
            section="lines"
          />
        </div>
      ) : null}

      {showTabs ? <LineTabNav lineShortId={currentLineShortId} /> : null}
    </div>
  );
}
