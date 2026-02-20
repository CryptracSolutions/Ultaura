'use client';

import { useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';

interface InfoTipProps {
  content: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  contentClassName?: string;
}

export function InfoTip({ content, side = 'top', contentClassName }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const isTouchRef = useRef(false);

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex cursor-default rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="More information"
          onTouchStart={() => {
            isTouchRef.current = true;
          }}
          onClick={() => {
            if (isTouchRef.current) {
              setOpen((prev) => !prev);
              isTouchRef.current = false;
            }
          }}
        >
          <Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className={contentClassName ?? 'max-w-[260px] text-left'}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
