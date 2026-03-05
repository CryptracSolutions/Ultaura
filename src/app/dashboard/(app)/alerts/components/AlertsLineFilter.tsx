'use client';

import { useEffect, useRef } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import classNames from 'clsx';

interface AlertsLineFilterProps {
  lines: Array<{ id: string; display_name: string }>;
  value: string;
  onValueChange: (value: string) => void;
}

export function AlertsLineFilter({ lines, value, onValueChange }: AlertsLineFilterProps) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

  const currentLine = value === 'all' ? null : lines.find((l) => l.id === value);
  const currentLabel = currentLine ? currentLine.display_name : 'All lines';

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

  const selectLine = (lineId: string) => {
    onValueChange(lineId);
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  };

  return (
    <details ref={detailsRef} className="group relative w-full sm:w-[16rem] sm:max-w-none">
      <summary
        aria-label="Filter by line"
        className={classNames(
          'flex w-full select-none items-center justify-between gap-3',
          'rounded-xl border border-border bg-card/70 px-3 py-1 min-h-[32px]',
          'text-sm font-medium text-foreground shadow-sm backdrop-blur',
          'transition-colors hover:bg-card/90',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          '[&::-webkit-details-marker]:hidden',
        )}
      >
        <span className="min-w-0 flex-1 truncate">{currentLabel}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
      </summary>

      <div
        className={classNames(
          'absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-border',
          'bg-popover/95 shadow-xl backdrop-blur',
          'animate-in fade-in-0 zoom-in-95',
        )}
      >
        <ul className="max-h-72 overflow-auto py-1">
          <li>
            <button
              type="button"
              onClick={() => selectLine('all')}
              className={classNames(
                'flex w-full items-center justify-between gap-3 px-3 py-2.5',
                'text-sm transition-colors',
                'hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none',
                value === 'all'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span
                className={classNames(
                  'min-w-0 flex-1 truncate text-left text-foreground',
                  value === 'all' ? 'font-semibold' : 'font-medium',
                )}
              >
                All lines
              </span>
              {value === 'all' ? <Check className="h-4 w-4 text-primary" /> : null}
            </button>
          </li>

          {lines.map((line) => {
            const isActive = line.id === value;
            return (
              <li key={line.id}>
                <button
                  type="button"
                  onClick={() => selectLine(line.id)}
                  className={classNames(
                    'flex w-full items-center justify-between gap-3 px-3 py-2.5',
                    'text-sm transition-colors',
                    'hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none',
                    isActive
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span
                    className={classNames(
                      'min-w-0 flex-1 truncate text-left text-foreground',
                      isActive ? 'font-semibold' : 'font-medium',
                    )}
                  >
                    {line.display_name}
                  </span>
                  {isActive ? <Check className="h-4 w-4 text-primary" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
