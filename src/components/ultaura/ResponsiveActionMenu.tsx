'use client';

import { useState } from 'react';
import { MoreVertical, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '~/core/ui/Dropdown';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '~/core/ui/Dialog';
import Button from '~/core/ui/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';

export interface ActionItem {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
  separator?: boolean;
  subItems?: { label: string; onClick: () => void }[];
}

interface ResponsiveActionMenuProps {
  title?: string;
  actions: ActionItem[];
  disabled?: boolean;
  loading?: boolean;
}

export function ResponsiveActionMenu({
  title,
  actions,
  disabled,
  loading,
}: ResponsiveActionMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const isDisabled = disabled || loading;

  const handleAction = (action: ActionItem) => {
    if (action.disabled || !action.onClick) return;
    setIsMenuOpen(false);
    setIsSheetOpen(false);
    action.onClick();
  };

  return (
    <>
      <DropdownMenu
        open={isMenuOpen}
        onOpenChange={(open) => {
          if (
            open &&
            typeof window !== 'undefined' &&
            !window.matchMedia('(min-width: 640px)').matches
          ) {
            setIsSheetOpen(true);
          } else {
            setIsMenuOpen(open);
          }
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                disabled={isDisabled}
                className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                aria-label="Actions"
              >
                {loading ? (
                  <span className="w-5 h-5 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <MoreVertical className="w-5 h-5" />
                )}
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent sideOffset={20}>Menu</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-48">
          {actions.map((action, index) => (
            <div key={index}>
              {action.separator && index > 0 && <DropdownMenuSeparator />}
              {action.subItems ? (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger
                    disabled={action.disabled}
                    className={`gap-2 ${
                      action.variant === 'destructive'
                        ? 'text-destructive focus:bg-destructive/10 focus:text-destructive'
                        : ''
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 flex shrink-0 items-center justify-center">
                        {action.icon}
                      </span>
                      <span>{action.label}</span>
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      {action.subItems.map((subItem, subIndex) => (
                        <DropdownMenuItem
                          key={subIndex}
                          className="cursor-pointer"
                          onSelect={() => {
                            setIsMenuOpen(false);
                            subItem.onClick();
                          }}
                        >
                          {subItem.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              ) : (
                <DropdownMenuItem
                  onClick={() => handleAction(action)}
                  disabled={action.disabled}
                  className={
                    action.variant === 'destructive'
                      ? 'text-destructive focus:bg-destructive/10 focus:text-destructive'
                      : ''
                  }
                >
                  <span className="w-5 h-5 mr-2 flex items-center justify-center">
                    {action.icon}
                  </span>
                  {action.label}
                </DropdownMenuItem>
              )}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DialogContent
          className="z-[60] mobile-form-sheet sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
          overlayClassName="z-[60] bg-black/50 backdrop-blur-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold leading-snug break-words whitespace-pre-wrap">{title ?? 'Actions'}</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                Select an action below
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSheetOpen(false)}
              disabled={isDisabled}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex flex-col gap-1 pt-2">
            {actions.map((action, index) => {
              if (action.subItems) {
                return (
                  <div key={index}>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/50 rounded-md">
                      {action.label}
                    </div>
                    {action.subItems.map((subItem, subIndex) => (
                      <button
                        key={subIndex}
                        onClick={() => {
                          setIsSheetOpen(false);
                          subItem.onClick();
                        }}
                        className="flex w-full items-center h-[44px] pl-10 pr-4 text-left text-sm text-foreground hover:bg-muted transition-colors touch-manipulation rounded-md"
                      >
                        {subItem.label}
                      </button>
                    ))}
                  </div>
                );
              }

              return (
                <button
                  key={index}
                  onClick={() => handleAction(action)}
                  disabled={action.disabled}
                  className={`flex w-full items-center gap-3 h-[50px] px-4 rounded-xl transition-colors touch-manipulation disabled:opacity-50 ${
                    action.variant === 'destructive'
                      ? 'text-destructive hover:bg-destructive/10'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <span
                    className={`h-5 w-5 flex shrink-0 items-center justify-center ${
                      action.variant === 'destructive'
                        ? 'text-destructive'
                        : 'text-primary'
                    }`}
                  >
                    {action.icon}
                  </span>
                  <span className="text-sm font-medium">{action.label}</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ResponsiveActionMenu;
