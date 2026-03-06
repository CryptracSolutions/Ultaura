'use client';

import { useState } from 'react';
import { Info, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '~/core/ui/Dialog';
import { Popover, PopoverContent, PopoverTrigger } from '~/core/ui/Popover';
import Button from '~/core/ui/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';

export interface DetailItem {
  label: string;
  value: React.ReactNode;
}

interface ResponsiveDetailsButtonProps {
  title: string;
  details: DetailItem[];
  disabled?: boolean;
  label?: string;
}

export function ResponsiveDetailsButton({
  title,
  details,
  disabled,
  label = 'Reminder details',
}: ResponsiveDetailsButtonProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [suppressTooltip, setSuppressTooltip] = useState(false);

  const handleOpenChange = (open: boolean) => {
    setIsTooltipOpen(false);

    if (!open) {
      setSuppressTooltip(true);
    }

    if (
      open &&
      typeof window !== 'undefined' &&
      !window.matchMedia('(min-width: 640px)').matches
    ) {
      setIsSheetOpen(true);
      return;
    }

    setIsPopoverOpen(open);
  };

  return (
    <>
      <Popover open={isPopoverOpen} onOpenChange={handleOpenChange}>
        <Tooltip
          open={isTooltipOpen}
          onOpenChange={(open: boolean) => {
            if (!open) {
              setIsTooltipOpen(false);
              return;
            }

            if (suppressTooltip || isPopoverOpen || isSheetOpen) {
              return;
            }

            setIsTooltipOpen(true);
          }}
        >
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                disabled={disabled}
                className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                aria-label={label}
                onPointerDown={() => setIsTooltipOpen(false)}
                onPointerLeave={() => {
                  setIsTooltipOpen(false);
                  setSuppressTooltip(false);
                }}
                onBlur={() => setSuppressTooltip(false)}
              >
                <Info className="w-5 h-5" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent sideOffset={20}>{label}</TooltipContent>
        </Tooltip>
        <PopoverContent
          align="end"
          className="w-80 space-y-3 p-3 sm:w-96"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="space-y-3">
            {details.map((detail, index) => (
              <div
                key={index}
                className="grid grid-cols-[minmax(88px,max-content)_minmax(0,1fr)] items-start gap-x-4 gap-y-1 text-sm"
              >
                <span className="text-muted-foreground">{detail.label}</span>
                <span className="min-w-0 break-words text-right font-medium text-foreground">
                  {detail.value}
                </span>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DialogContent
          className="z-[60] mobile-form-sheet sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
          overlayClassName="z-[60] bg-black/50 backdrop-blur-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold leading-snug break-words whitespace-pre-wrap">
                {label}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground break-words whitespace-pre-wrap">
                {title}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSheetOpen(false)}
              disabled={disabled}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex flex-col gap-1 pt-4">
            {details.map((detail, index) => (
              <div
                key={index}
                className="flex items-start justify-between gap-4 rounded-xl bg-muted/50 px-4 py-3"
              >
                <span className="text-sm text-muted-foreground">
                  {detail.label}
                </span>
                <span className="min-w-0 text-right text-sm font-medium text-foreground break-words">
                  {detail.value}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ResponsiveDetailsButton;
