'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

import React, { useMemo, useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

import {
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenu,
} from '~/core/ui/Dropdown';

import Trans from '~/core/ui/Trans';
import Button from '~/core/ui/Button';

const TRIGGER_BUTTON_CLASS_NAME =
  'select-none rounded-xl border border-border bg-card/70 px-3 py-2 ' +
  'text-sm font-medium text-foreground shadow-sm backdrop-blur ' +
  'transition-colors hover:bg-card/90 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const DROPDOWN_CONTENT_CLASS_NAME =
  'divide-y divide-border w-screen ' +
  'rounded-xl border border-border bg-popover/95 shadow-xl backdrop-blur ' +
  'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
  'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 ' +
  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95';

const MobileNavigationDropdown: React.FC<{
  links: Array<{
    path: string;
    label: string;
}>;
  currentLabel?: string;
  ariaLabel?: string;
  onNavigate?: (
    event: React.MouseEvent<HTMLAnchorElement>,
    link: { path: string; label: string }
  ) => void;
}> = ({ links, currentLabel, ariaLabel, onNavigate }) => {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const currentPathName = useMemo(() => {
    if (currentLabel) {
      return currentLabel;
    }

    return (
      Object.values(links).find((link) => link.path === path)?.label ??
      links[0]?.label
    );
  }, [currentLabel, links, path]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="custom"
          size="custom"
          block
          type="button"
          aria-label={ariaLabel}
          className={TRIGGER_BUTTON_CLASS_NAME}
        >
          <span className="flex w-full items-center justify-between gap-3">
            <span className="text-foreground">
              <Trans i18nKey={currentPathName} defaults={currentPathName} />
            </span>

            <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className={DROPDOWN_CONTENT_CLASS_NAME}>
        {Object.values(links).map((link) => {
          return (
            <DropdownMenuItem asChild key={link.path}>
              <Link
                className={'flex h-12 w-full items-center'}
                href={link.path}
                onClick={(event) => {
                  onNavigate?.(event, link);
                  setOpen(false);
                }}
              >
                <Trans i18nKey={link.label} defaults={link.label} />
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default MobileNavigationDropdown;
