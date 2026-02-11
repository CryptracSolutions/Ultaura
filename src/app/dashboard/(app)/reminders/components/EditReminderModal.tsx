'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '~/core/ui/Dialog';
import { DatePicker } from '~/core/ui/DatePicker';
import { TimePicker } from '~/core/ui/TimePicker';
import Button from '~/core/ui/Button';
import Textarea from '~/core/ui/Textarea';
import { useLeavePageGuard } from '~/core/hooks/use-leave-page-guard';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { editReminder } from '~/lib/ultaura/reminders';

interface EditReminderModalProps {
  reminder: {
    reminderId: string;
    message: string;
    dueAt: string;
    timezone: string;
    isRecurring: boolean;
    lineShortId: string;
  } | null;
  lineDisplayName: string;
  onClose: () => void;
}

export function EditReminderModal({ reminder, lineDisplayName, onClose }: EditReminderModalProps) {
  const router = useRouter();

  const [editMessage, setEditMessage] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialState, setInitialState] = useState<{
    message: string;
    date: string;
    time: string;
  } | null>(null);

  // Initialize state when reminder opens
  useEffect(() => {
    if (!reminder) {
      setInitialState(null);
      return;
    }
    const dueDate = new Date(reminder.dueAt);
    const dateStr = dueDate.toISOString().split('T')[0];
    const hours = dueDate.getHours().toString().padStart(2, '0');
    const minutes = dueDate.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    setEditMessage(reminder.message);
    setEditDate(dateStr);
    setEditTime(timeStr);
    setInitialState({ message: reminder.message, date: dateStr, time: timeStr });
  }, [reminder]);

  const hasChanges =
    Boolean(reminder && initialState) &&
    (editMessage.trim() !== initialState!.message ||
      editDate !== initialState!.date ||
      editTime !== initialState!.time);

  const discardChanges = useCallback(() => {
    if (initialState) {
      setEditMessage(initialState.message);
      setEditDate(initialState.date);
      setEditTime(initialState.time);
    }
    setIsSubmitting(false);
    onClose();
  }, [initialState, onClose]);

  const { dialogProps: leaveGuardProps } = useLeavePageGuard({
    isDirty: hasChanges,
    onDiscard: discardChanges,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminder) return;

    setIsSubmitting(true);

    const updates: { message?: string; dueAt?: string } = {};

    if (editMessage.trim() !== reminder.message) {
      updates.message = editMessage.trim();
    }

    const newDueAt = new Date(`${editDate}T${editTime}:00`);
    const oldDueAt = new Date(reminder.dueAt);
    if (newDueAt.getTime() !== oldDueAt.getTime()) {
      updates.dueAt = newDueAt.toISOString();
    }

    if (Object.keys(updates).length === 0) {
      toast.info('No changes to save');
      setIsSubmitting(false);
      return;
    }

    const result = await editReminder(reminder.reminderId, updates, reminder.lineShortId);

    setIsSubmitting(false);

    if (result.success) {
      toast.success('Reminder updated');
      router.refresh();
      onClose();
    } else {
      toast.error(result.error.message || 'Failed to update reminder');
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <>
      <Dialog
        open={reminder !== null}
        onOpenChange={(open) => {
          if (!open) discardChanges();
        }}
      >
        <DialogContent
          className="sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
          overlayClassName="bg-black/50 backdrop-blur-none"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="truncate">Edit reminder</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Update message and time for {lineDisplayName}
              </DialogDescription>
            </div>

            <button
              type="button"
              onClick={discardChanges}
              disabled={isSubmitting}
              className="min-h-[44px] min-w-[44px] rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 touch-manipulation flex items-center justify-center"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="edit-reminder-message" className="block text-sm font-medium text-foreground mb-2">
                Message
              </label>
              <Textarea
                id="edit-reminder-message"
                value={editMessage}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditMessage(e.target.value)}
                rows={3}
                maxLength={500}
                disabled={isSubmitting}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {editMessage.length}/500 characters
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Date
                </label>
                <DatePicker
                  value={editDate}
                  onChange={setEditDate}
                  min={today}
                  disabled={isSubmitting}
                  placeholder="Select date"
                  className="h-11"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Time
                </label>
                <TimePicker
                  value={editTime}
                  onChange={setEditTime}
                  disabled={isSubmitting}
                  placeholder="Select time"
                  className="h-11"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={discardChanges}
                disabled={isSubmitting}
              >
                Discard changes
              </Button>
              <Button
                type="submit"
                variant="default"
                className="w-full"
                disabled={isSubmitting || !editMessage.trim()}
                loading={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        {...leaveGuardProps}
        title="Unsaved changes"
        description="You have unsaved changes. Are you sure you want to leave?"
      />
    </>
  );
}
