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
  const actionsContent = actions ? (
    <div className="w-full sm:ml-auto sm:w-auto">{actions}</div>
  ) : actionsSlotId ? (
    <div id={actionsSlotId} className="w-full sm:ml-auto sm:w-auto" />
  ) : null;

  return (
    <div className="-mt-2 mb-5 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-start">
        {lines.length > 1 ? (
          <div className="w-full sm:w-[16rem] rounded-xl ring-2 ring-primary shrink-0">
            <LineSelectorTabs
              lines={lines}
              currentLineShortId={currentLineShortId}
              section="lines"
            />
          </div>
        ) : null}
        {actionsContent}
      </div>

      {showTabs ? <LineTabNav lineShortId={currentLineShortId} /> : null}
    </div>
  );
}
