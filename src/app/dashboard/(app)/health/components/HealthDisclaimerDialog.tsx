'use client';

import { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '~/core/ui/Dialog';
import { acknowledgeHealthDisclaimerAction } from '~/lib/ultaura/health/actions';

interface HealthDisclaimerDialogProps {
  accountId: string;
  onAcknowledged: () => void;
}

export function HealthDisclaimerDialog({
  accountId,
  onAcknowledged,
}: HealthDisclaimerDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleAcknowledge = () => {
    setError(null);

    startTransition(async () => {
      const result = await acknowledgeHealthDisclaimerAction(accountId);

      if (!result.success) {
        setError('Something went wrong. Please try again.');
        return;
      }

      onAcknowledged();
    });
  };

  return (
    <Dialog open modal>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
        // Prevent closing by clicking outside or pressing Escape — acknowledgement is required
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Important health information</DialogTitle>
        </DialogHeader>

        <div className="py-1">
          <p className="text-sm text-foreground leading-relaxed">
            Ultaura is not a doctor or medical professional. Health information
            stored here is for personal reference and, with your permission, to
            help Ultaura provide more informed companionship. Ultaura may make
            mistakes. Always consult qualified healthcare providers for medical
            advice, diagnosis, or treatment.
          </p>

          {error ? (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          ) : null}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={handleAcknowledge}
            disabled={isPending}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed sm:w-auto"
          >
            {isPending ? 'Saving...' : 'I understand'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
