'use client';

import { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '~/core/ui/Dialog';
import {
  modalDestructiveButtonClass,
  modalIconButtonClass,
  modalPrimaryButtonClass,
  modalSecondaryButtonClass,
} from '~/core/ui/modal-button-classes';

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'default';
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = useCallback(async () => {
    setIsLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Error handling is done by the caller (e.g., toast.error)
      // Keep dialog open on error
    } finally {
      setIsLoading(false);
    }
  }, [onConfirm, onOpenChange]);

  const handleCancel = useCallback(() => {
    if (!isLoading) {
      onCancel?.();
      onOpenChange(false);
    }
  }, [isLoading, onCancel, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={isLoading ? undefined : onOpenChange}>
      <DialogContent
        className="sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
        overlayClassName="bg-black/50 backdrop-blur-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <DialogTitle className="truncate">{title}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {description}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isLoading}
            className={modalIconButtonClass + ' disabled:opacity-50'}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isLoading}
            className={modalSecondaryButtonClass}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className={
              variant === 'destructive'
                ? modalDestructiveButtonClass
                : modalPrimaryButtonClass
            }
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                {confirmLabel}
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmationDialog;
