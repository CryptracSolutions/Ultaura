'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import NavigationMenu from '~/core/ui/Navigation/NavigationMenu';
import NavigationItem from '~/core/ui/Navigation/NavigationItem';
import type { LineStatus } from '~/lib/ultaura/types';

export interface LineSelectorLine {
  id: string;
  short_id: string;
  display_name: string;
  status: LineStatus;
  insights_enabled?: boolean;
}

export interface LineSelectorTabsProps {
  lines: LineSelectorLine[];
  currentLineShortId: string;
  section: 'lines' | 'insights';
}

const STATUS_LABELS: Record<LineStatus, string> = {
  active: '',
  paused: 'Paused',
  disabled: 'Disabled',
};

function buildLineLabel(line: LineSelectorLine) {
  const badges = [
    line.status !== 'active' ? STATUS_LABELS[line.status] : null,
    line.insights_enabled === false ? 'Off' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return `${line.display_name}${badges ? ` (${badges})` : ''}`;
}

export function LineSelectorTabs({ lines, currentLineShortId, section }: LineSelectorTabsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const buildLinePath = (shortId: string) => {
    const fallback = `/dashboard/${section}/${shortId}`;

    if (!pathname) {
      const query = searchParams?.toString();
      return query ? `${fallback}?${query}` : fallback;
    }

    const parts = pathname.split('/');
    const sectionIndex = parts.indexOf(section);

    if (sectionIndex === -1 || sectionIndex + 1 >= parts.length) {
      const query = searchParams?.toString();
      return query ? `${fallback}?${query}` : fallback;
    }

    const nextParts = [...parts];
    nextParts[sectionIndex + 1] = shortId;
    let nextPath = nextParts.join('/');

    if (!nextPath.startsWith('/')) {
      nextPath = `/${nextPath}`;
    }

    const query = searchParams?.toString();
    return query ? `${nextPath}?${query}` : nextPath;
  };

  return (
    <NavigationMenu pill scrollable>
      {lines.map((line) => (
        <NavigationItem
          key={line.id}
          active={line.short_id === currentLineShortId}
          className={line.short_id === currentLineShortId ? 'text-primary' : undefined}
          link={{
            path: buildLinePath(line.short_id),
            label: buildLineLabel(line),
          }}
        />
      ))}
    </NavigationMenu>
  );
}
