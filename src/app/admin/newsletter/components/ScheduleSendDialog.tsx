'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '~/core/ui/Dialog';
import Button from '~/core/ui/Button';
import { DatePicker } from '~/core/ui/DatePicker';
import TextField from '~/core/ui/TextField';

interface ScheduleSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSchedule: (isoString: string) => void;
}

function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ScheduleSendDialog({
  open,
  onOpenChange,
  onSchedule,
}: ScheduleSendDialogProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');

  function handleSchedule() {
    if (!date || !time) return;

    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    const scheduled = new Date(year, month - 1, day, hours, minutes);
    onSchedule(scheduled.toISOString());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Broadcast</DialogTitle>
          <DialogDescription>
            Choose a date and time to send this broadcast.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium">Date</label>
            <DatePicker
              value={date}
              onChange={setDate}
              min={getTomorrowDate()}
              placeholder="Select send date"
            />
          </div>

          <TextField>
            <TextField.Label>Time (HH:MM)</TextField.Label>
            <TextField.Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </TextField>
        </div>

        <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="w-full"
            onClick={handleSchedule}
            disabled={!date || !time}
          >
            Schedule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
