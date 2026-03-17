'use client';

import { Info } from 'lucide-react';
import Link from 'next/link';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '~/core/ui/Popover';

export function HealthDisclaimer() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>Health disclaimer</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 overflow-hidden rounded-xl border border-border/70 p-0 shadow-lg">
        <div className="border-b border-border/50 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
              <Info className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">Health disclaimer</p>
          </div>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Ultaura is not a doctor or medical professional. Health information
            stored here is for personal reference and, with your permission, to
            help Ultaura provide more informed companionship. Ultaura may make
            mistakes. Always consult qualified healthcare providers for medical
            advice, diagnosis, or treatment.
          </p>
          <Link
            href="/docs/health"
            className="mt-2.5 inline-flex text-sm font-medium text-primary underline underline-offset-2 hover:no-underline"
          >
            Learn more →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
