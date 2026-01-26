'use client';

import NavigationMenu from '~/core/ui/Navigation/NavigationMenu';
import NavigationItem from '~/core/ui/Navigation/NavigationItem';
import type { LineStatus } from '~/lib/ultaura/types';

interface LineOption {
  id: string;
  short_id: string;
  display_name: string;
  status: LineStatus;
  insights_enabled: boolean;
}

interface InsightsLineTabsProps {
  lines: LineOption[];
  currentLineShortId: string;
}

const STATUS_LABELS: Record<LineStatus, string> = {
  active: '',
  paused: 'Paused',
  disabled: 'Disabled',
};

export function InsightsLineTabs({ lines, currentLineShortId }: InsightsLineTabsProps) {
  const renderLineLabel = (line: LineOption) => {
    const badges = [
      line.status !== 'active' ? STATUS_LABELS[line.status] : null,
      !line.insights_enabled ? 'Off' : null,
    ]
      .filter(Boolean)
      .join(', ');

    return `${line.display_name}${badges ? ` (${badges})` : ''}`;
  };

  return (
    <NavigationMenu bordered scrollable>
      {lines.map((line) => (
        <NavigationItem
          key={line.id}
          active={line.short_id === currentLineShortId}
          link={{
            path: `/dashboard/insights/${line.short_id}`,
            label: renderLineLabel(line),
          }}
        />
      ))}
    </NavigationMenu>
  );
}
