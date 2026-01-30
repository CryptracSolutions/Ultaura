'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Check, ChevronDown } from 'lucide-react';
import classNames from 'clsx';
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
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

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

  const currentLine = lines.find((line) => line.short_id === currentLineShortId) ?? lines[0];
  const currentLabel = currentLine ? buildLineLabel(currentLine) : 'Select a line';

  const buildBadges = (line: LineSelectorLine) => {
    const badges: string[] = [];
    if (line.status !== 'active') badges.push(STATUS_LABELS[line.status]);
    if (line.insights_enabled === false) badges.push('Insights Off');
    return badges;
  };

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (!details?.open) return;
      if (!details.contains(event.target as Node)) {
        details.open = false;
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  return (
    <details ref={detailsRef} className="group relative w-full sm:w-[16rem] sm:max-w-none">
      <summary
        aria-label="Select line"
        className={classNames(
          'flex w-full select-none items-center justify-between gap-3',
          'rounded-xl border border-border bg-card/70 px-3 py-2',
          'text-sm font-medium text-foreground shadow-sm backdrop-blur',
          'transition-colors hover:bg-card/90',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          '[&::-webkit-details-marker]:hidden'
        )}
      >
        <span className="min-w-0 flex-1 truncate">{currentLabel}</span>

        <span className="flex items-center gap-2">
          {currentLine ? (
            <span className="hidden sm:flex items-center gap-1.5">
              {buildBadges(currentLine).map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground"
                >
                  {badge}
                </span>
              ))}
            </span>
          ) : null}

          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
        </span>
      </summary>

      <div
        className={classNames(
          'absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-border',
          'bg-popover/95 shadow-xl backdrop-blur',
          'animate-in fade-in-0 zoom-in-95'
        )}
      >
        <ul className="max-h-72 overflow-auto py-1">
          {lines.map((line) => {
            const isActive = line.short_id === currentLineShortId;
            const label = buildLineLabel(line);
            const badges = buildBadges(line);

            return (
              <li key={line.id}>
                <Link
                  href={buildLinePath(line.short_id)}
                  onClick={(event) => {
                    if (!isActive) return;
                    event.preventDefault();
                    if (detailsRef.current) {
                      detailsRef.current.open = false;
                    }
                  }}
                  className={classNames(
                    'flex w-full items-center justify-between gap-3 px-3 py-2.5',
                    'text-sm transition-colors',
                    'hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none',
                    isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span
                    className={classNames(
                      'min-w-0 flex-1 truncate',
                      isActive ? 'font-semibold text-foreground' : 'font-medium text-foreground'
                    )}
                  >
                    {label}
                  </span>

                  <span className="flex items-center gap-2">
                    {badges.length ? (
                      <span className="hidden sm:flex items-center gap-1.5">
                        {badges.map((badge) => (
                          <span
                            key={badge}
                            className="rounded-full border border-border bg-background/30 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground"
                          >
                            {badge}
                          </span>
                        ))}
                      </span>
                    ) : null}

                    {isActive ? <Check className="h-4 w-4 text-primary" /> : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
