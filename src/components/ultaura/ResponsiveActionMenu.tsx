'use client';

import { useState } from 'react';
import { MoreVertical } from 'lucide-react';
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
        <DropdownMenuTrigger asChild>
          <button
            disabled={isDisabled}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            aria-label="Actions"
          >
            {loading ? (
              <span className="w-5 h-5 block animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <MoreVertical className="w-5 h-5" />
            )}
          </button>
        </DropdownMenuTrigger>
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
                    <span className="w-5 h-5 mr-2 flex items-center justify-center">
                      {action.icon}
                    </span>
                    {action.label}
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
          className="z-[60] p-0"
          overlayClassName="z-[60]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {title && (
            <DialogTitle className="px-5 pt-5 pb-2 text-base font-semibold">
              {title}
            </DialogTitle>
          )}
          {!title && <DialogTitle className="sr-only">Actions</DialogTitle>}
          <DialogDescription className="sr-only">Available actions</DialogDescription>
          <div className="pb-2">
            {actions.map((action, index) => {
              if (action.subItems) {
                return (
                  <div key={index}>
                    <div className="px-[14px] py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/50">
                      {action.label}
                    </div>
                    {action.subItems.map((subItem, subIndex) => (
                      <button
                        key={subIndex}
                        onClick={() => {
                          setIsSheetOpen(false);
                          subItem.onClick();
                        }}
                        className="flex w-full items-center h-[44px] pl-[50px] pr-[14px] text-left text-foreground hover:bg-muted transition-colors touch-manipulation"
                      >
                        <span className="text-[14.5px]">{subItem.label}</span>
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
                  className={`flex w-full items-center space-x-[14px] h-[50px] px-[14px] hover:bg-muted transition-colors touch-manipulation disabled:opacity-50 ${
                    action.variant === 'destructive' ? 'text-destructive' : ''
                  }`}
                >
                  <span
                    className={`h-[22px] w-[22px] flex items-center justify-center ${
                      action.variant === 'destructive'
                        ? 'text-destructive'
                        : 'text-primary'
                    }`}
                  >
                    {action.icon}
                  </span>
                  <span className="text-[14.5px]">{action.label}</span>
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
