'use client';

import { useState, useTransition, useEffect } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '~/core/ui/Dialog';
import Button from '~/core/ui/Button';
import Textarea from '~/core/ui/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import TextField from '~/core/ui/TextField';
import { createObservationAction, editObservationAction } from '~/lib/ultaura/health/actions';
import type { HealthObservation, HealthObservationCategory, HealthObservationConcern } from '@ultaura/types';

interface HealthObservationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineId: string;
  observation?: HealthObservation;
  onSuccess?: () => void;
}

const CATEGORY_LABELS: Record<HealthObservationCategory, string> = {
  memory: 'Memory',
  mood_emotional: 'Mood / Emotional',
  physical_mobility: 'Physical / Mobility',
  nutrition_eating: 'Nutrition / Eating',
  sleep: 'Sleep',
  social_engagement: 'Social Engagement',
  medication_compliance: 'Medication Compliance',
  general_other: 'General / Other',
};

const CONCERN_LABELS: Record<HealthObservationConcern, string> = {
  note: 'Note',
  mild_concern: 'Mild Concern',
  significant_concern: 'Significant Concern',
};

const CATEGORY_VALUES = Object.keys(CATEGORY_LABELS) as HealthObservationCategory[];
const CONCERN_VALUES = Object.keys(CONCERN_LABELS) as HealthObservationConcern[];

const NO_CATEGORY = '__none__';

function buildFormState(observation?: HealthObservation) {
  return {
    text: observation?.text ?? '',
    category: observation?.category ?? null,
    observedDate: observation?.observedDate ?? '',
    concernLevel: (observation?.concernLevel ?? 'note') as HealthObservationConcern,
  };
}

export function HealthObservationForm({
  open,
  onOpenChange,
  lineId,
  observation,
  onSuccess,
}: HealthObservationFormProps) {
  const isEdit = Boolean(observation);
  const [isPending, startTransition] = useTransition();

  const [text, setText] = useState('');
  const [category, setCategory] = useState<HealthObservationCategory | null>(null);
  const [observedDate, setObservedDate] = useState('');
  const [concernLevel, setConcernLevel] = useState<HealthObservationConcern>('note');

  useEffect(() => {
    const initial = buildFormState(observation);
    setText(initial.text);
    setCategory(initial.category);
    setObservedDate(initial.observedDate);
    setConcernLevel(initial.concernLevel);
  }, [observation, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    startTransition(async () => {
      const input = {
        text: text.trim(),
        category: category ?? null,
        observedDate: observedDate.trim() || null,
        concernLevel: concernLevel ?? null,
      };

      const result = isEdit && observation
        ? await editObservationAction(observation.id, lineId, input)
        : await createObservationAction(lineId, input);

      if (result.success) {
        toast.success(isEdit ? 'Observation updated' : 'Observation added');
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(result.error ?? 'Something went wrong');
      }
    });
  };

  const handleClose = () => {
    if (isPending) return;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto"
        overlayClassName="bg-black/50 backdrop-blur-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <DialogTitle>{isEdit ? 'Edit observation' : 'Add observation'}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {isEdit ? 'Update the details below' : 'Record an observation about wellbeing, mood, or behaviour'}
            </DialogDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            disabled={isPending}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          {/* Observation text */}
          <div>
            <label htmlFor="observation-text" className="block text-sm font-medium text-foreground mb-2">
              Observation <span aria-hidden="true" className="text-destructive">*</span>
            </label>
            <Textarea
              id="observation-text"
              value={text}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
              disabled={isPending}
              maxLength={2000}
              rows={4}
              placeholder="Describe what you observed…"
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">{text.length}/2000</p>
          </div>

          {/* Category */}
          <div>
            <label htmlFor="observation-category" className="block text-sm font-medium text-foreground mb-2">
              Category <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </label>
            <Select
              value={category ?? NO_CATEGORY}
              onValueChange={(v) => setCategory(v === NO_CATEGORY ? null : v as HealthObservationCategory)}
              disabled={isPending}
            >
              <SelectTrigger className="w-full min-h-[44px]" id="observation-category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                {CATEGORY_VALUES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date observed */}
          <div>
            <label htmlFor="observation-date" className="block text-sm font-medium text-foreground mb-2">
              Date observed <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </label>
            <TextField.Input
              id="observation-date"
              type="date"
              value={observedDate}
              onChange={(e) => setObservedDate(e.target.value)}
              disabled={isPending}
              className="min-h-[44px]"
            />
          </div>

          {/* Concern level */}
          <div>
            <label htmlFor="observation-concern" className="block text-sm font-medium text-foreground mb-2">
              Concern level
            </label>
            <Select
              value={concernLevel}
              onValueChange={(v) => setConcernLevel(v as HealthObservationConcern)}
              disabled={isPending}
            >
              <SelectTrigger className="w-full min-h-[44px]" id="observation-concern">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONCERN_VALUES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CONCERN_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button
              type="submit"
              variant="default"
              className="w-full"
              disabled={isPending || !text.trim()}
              loading={isPending}
            >
              {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add observation'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
