'use client';

import { useState, useEffect } from 'react';
import { X, ChevronLeft, Phone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  focusDialogAutofocusTarget,
  gateDialogAutoFocus,
} from '~/core/ui/Dialog';
import Button from '~/core/ui/Button';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { CreateScheduleForm } from './CreateScheduleForm';

export interface LineForScheduleModal {
  id: string;
  accountId: string;
  displayName: string;
  timezone: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  phoneE164: string;
}

export interface AddScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: LineForScheduleModal[];
  preselectedLineId?: string | null;
}

function formatPhone(e164: string): string {
  const match = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : e164;
}

export function AddScheduleModal({
  open,
  onOpenChange,
  lines,
  preselectedLineId,
}: AddScheduleModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedLine, setSelectedLine] = useState<LineForScheduleModal | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [formDirty, setFormDirty] = useState(false);

  // Auto-select if only one line or preselectedLineId provided
  useEffect(() => {
    if (open) {
      if (preselectedLineId) {
        const line = lines.find(l => l.id === preselectedLineId);
        if (line) {
          setSelectedLine(line);
          setStep(2);
          return;
        }
      }
      if (lines.length === 1) {
        setSelectedLine(lines[0]);
        setStep(2);
      }
    }
  }, [open, lines, preselectedLineId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setStep(lines.length === 1 ? 2 : 1);
      setSelectedLine(lines.length === 1 ? lines[0] : null);
      setFormDirty(false);
    }
  }, [open, lines]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSelectLine = (line: LineForScheduleModal) => {
    setSelectedLine(line);
    setStep(2);
  };

  const handleBack = () => {
    if (formDirty) {
      setShowDiscardConfirm(true);
    } else {
      setStep(1);
      setSelectedLine(null);
    }
  };

  const handleConfirmDiscard = () => {
    setStep(1);
    setSelectedLine(null);
    setFormDirty(false);
  };

  const handleSuccess = () => {
    handleClose();
  };

  const showLinePicker = lines.length > 1;

  return (
    <>
      <Dialog open={open} onOpenChange={(openState) => { if (!openState) handleClose(); }}>
        <DialogContent
          className="mobile-form-sheet sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
          overlayClassName="bg-black/50 backdrop-blur-none"
          onOpenAutoFocus={(event) => {
            gateDialogAutoFocus(event, focusDialogAutofocusTarget);
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {step === 2 && showLinePicker && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="min-h-[44px] min-w-[44px] -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors touch-manipulation flex items-center justify-center"
                  aria-label="Back to line selection"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <div className="min-w-0">
                <DialogTitle className="truncate">
                  {step === 1 ? 'Select a Line' : 'Create Schedule'}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  {step === 1
                    ? 'Choose which line to add the schedule for'
                    : `Set up when calls should happen for ${selectedLine?.displayName}`}
                </DialogDescription>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClose}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Step 1: Line Picker */}
          {step === 1 && showLinePicker && (
            <div className="space-y-3 py-2">
              {lines.map((line, index) => (
                <button
                  key={line.id}
                  type="button"
                  data-autofocus={index === 0 ? true : undefined}
                  onClick={() => handleSelectLine(line)}
                  className="w-full p-4 rounded-lg border border-input bg-card text-left hover:bg-muted hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Phone className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{line.displayName}</p>
                      <p className="text-sm text-muted-foreground">{formatPhone(line.phoneE164)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Create Schedule Form */}
          {step === 2 && selectedLine && (
              <CreateScheduleForm
                lineId={selectedLine.id}
                accountId={selectedLine.accountId}
                timezone={selectedLine.timezone}
                quietHoursStart={selectedLine.quietHoursStart}
                quietHoursEnd={selectedLine.quietHoursEnd}
                onSuccess={handleSuccess}
                onCancel={handleClose}
                onDirtyChange={setFormDirty}
              />
          )}
        </DialogContent>
      </Dialog>

      {/* Discard confirmation for Back button */}
      <ConfirmationDialog
        open={showDiscardConfirm}
        onOpenChange={setShowDiscardConfirm}
        title="Discard changes?"
        description="You have unsaved changes. Are you sure you want to go back?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        variant="default"
        onConfirm={handleConfirmDiscard}
      />
    </>
  );
}
