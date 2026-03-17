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
import Button from '~/core/ui/Button';

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
        className="sm:max-w-[468px]"
        overlayClassName="bg-black/50 backdrop-blur-none"
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

        <DialogFooter className="gap-3 pt-4">
          <Button
            type="button"
            variant="default"
            className="w-full"
            onClick={handleAcknowledge}
            disabled={isPending}
            loading={isPending}
          >
            I understand
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
