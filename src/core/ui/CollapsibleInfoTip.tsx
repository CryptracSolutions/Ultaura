'use client';

import { type ReactNode } from 'react';
import { Info } from 'lucide-react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '~/core/ui/Popover';

interface CollapsibleInfoTipProps {
  /** Unique key — retained for API compatibility */
  storageKey: string;
  /** Label shown in the popover header */
  collapsedLabel: string;
  /** The full disclaimer content (can include links, lists, etc.) */
  children: ReactNode;
}

export function CollapsibleInfoTip({
  collapsedLabel,
  children,
}: CollapsibleInfoTipProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={collapsedLabel}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/30 bg-primary/5 text-primary transition-colors hover:bg-primary/10"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 overflow-hidden rounded-xl border border-border/70 p-0 shadow-lg">
        <div className="border-b border-border/50 bg-primary/5 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{collapsedLabel}</p>
        </div>
        <div className="px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}
