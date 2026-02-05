'use client';

import { useState } from 'react';
import { MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/core/ui/Dropdown';
import { Dialog, DialogContent, DialogTitle } from '~/core/ui/Dialog';
import Button from '~/core/ui/Button';

export interface ActionItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
  separator?: boolean;
}

interface ResponsiveActionMenuProps {
  title?: string;
  actions: ActionItem[];
  disabled?: boolean;
}

export function ResponsiveActionMenu({
  title,
  actions,
  disabled,
}: ResponsiveActionMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleAction = (action: ActionItem) => {
    if (action.disabled) return;
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
          <Button variant="ghost" size="icon" disabled={disabled}>
            <MoreVertical className="w-5 h-5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {actions.map((action, index) => (
            <div key={index}>
              {action.separator && index > 0 && <DropdownMenuSeparator />}
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
          <div className="pb-2">
            {actions.map((action, index) => (
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
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ResponsiveActionMenu;
