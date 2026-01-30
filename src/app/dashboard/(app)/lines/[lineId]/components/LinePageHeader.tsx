'use client';

import { LineTabNav } from './LineTabNav';
import { LineSelectorTabs, type LineSelectorLine } from '~/components/ultaura/LineSelectorTabs';

interface LinePageHeaderProps {
  lines: LineSelectorLine[];
  currentLineShortId: string;
  actions?: React.ReactNode;
  showTabs?: boolean;
}

export function LinePageHeader({
  lines,
  currentLineShortId,
  actions,
  showTabs = true,
}: LinePageHeaderProps) {
  return (
    <div className="mb-5 space-y-3">
      {actions ? <div className="w-full sm:w-auto">{actions}</div> : null}

      {lines.length > 1 ? (
        <LineSelectorTabs
          lines={lines}
          currentLineShortId={currentLineShortId}
          section="lines"
        />
      ) : null}

      {showTabs ? <LineTabNav lineShortId={currentLineShortId} /> : null}
    </div>
  );
}
