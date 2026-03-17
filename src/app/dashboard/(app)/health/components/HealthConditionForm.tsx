'use client';

import { useState, useTransition, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '~/core/ui/Dialog';
import Button from '~/core/ui/Button';
import TextField from '~/core/ui/TextField';
import Textarea from '~/core/ui/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import { HealthAutocompleteInput } from './HealthAutocompleteInput';
import { HealthApproximateDateInput } from './HealthApproximateDateInput';
import { createConditionAction, editConditionAction } from '~/lib/ultaura/health/actions';
import type { HealthCondition, HealthConditionStatus, ApproximateDate } from '@ultaura/types';

interface HealthConditionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineId: string;
  accountId: string;
  condition?: HealthCondition;
  existingConditions: HealthCondition[];
  onSuccess?: (condition?: HealthCondition) => void;
}

const STATUS_LABELS: Record<HealthConditionStatus, string> = {
  active: 'Active',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
};

function buildFormState(condition?: HealthCondition) {
  return {
    name: condition?.name ?? '',
    standardizedId: condition?.standardizedId ?? null,
    status: (condition?.status ?? 'active') as HealthConditionStatus,
    diagnosedOnsetDate: condition?.diagnosedOnsetDate ?? null,
    stageSeverity: condition?.stageSeverity ?? '',
    treatingClinician: condition?.treatingClinician ?? '',
    notes: condition?.notes ?? '',
  };
}

export function HealthConditionForm({
  open,
  onOpenChange,
  lineId,
  condition,
  existingConditions,
  onSuccess,
}: HealthConditionFormProps) {
  const isEdit = Boolean(condition);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [standardizedId, setStandardizedId] = useState<{ system: string; code: string } | null>(null);
  const [status, setStatus] = useState<HealthConditionStatus>('active');
  const [diagnosedOnsetDate, setDiagnosedOnsetDate] = useState<ApproximateDate | null>(null);
  const [stageSeverity, setStageSeverity] = useState('');
  const [treatingClinician, setTreatingClinician] = useState('');
  const [notes, setNotes] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<HealthCondition | null>(null);
  const [proceedDespiteDuplicate, setProceedDespiteDuplicate] = useState(false);

  // Initialise from condition when it changes
  useEffect(() => {
    const initial = buildFormState(condition);
    setName(initial.name);
    setStandardizedId(initial.standardizedId);
    setStatus(initial.status);
    setDiagnosedOnsetDate(initial.diagnosedOnsetDate);
    setStageSeverity(initial.stageSeverity);
    setTreatingClinician(initial.treatingClinician);
    setNotes(initial.notes);
    setDuplicateWarning(null);
    setProceedDespiteDuplicate(false);
  }, [condition, open]);

  // Check duplicates when name changes
  useEffect(() => {
    if (!name.trim()) {
      setDuplicateWarning(null);
      return;
    }
    const nameLower = name.trim().toLowerCase();
    const duplicate = existingConditions.find(
      (c) =>
        c.name.trim().toLowerCase() === nameLower &&
        c.id !== condition?.id,
    );
    setDuplicateWarning(duplicate ?? null);
    if (!duplicate) setProceedDespiteDuplicate(false);
  }, [name, existingConditions, condition?.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;
    if (duplicateWarning && !proceedDespiteDuplicate) return;

    startTransition(async () => {
      const input = {
        name: name.trim(),
        standardizedId: standardizedId ?? null,
        status,
        diagnosedOnsetDate: diagnosedOnsetDate ?? null,
        stageSeverity: stageSeverity.trim() || null,
        treatingClinician: treatingClinician.trim() || null,
        notes: notes.trim() || null,
      };

      const result = isEdit && condition
        ? await editConditionAction(condition.id, lineId, input)
        : await createConditionAction(lineId, input);

      if (result.success) {
        toast.success(isEdit ? 'Condition updated' : 'Condition added');
        onOpenChange(false);
        onSuccess?.(result.condition);
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
        className="mobile-form-sheet sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
        overlayClassName="bg-black/50 backdrop-blur-none"
      >
        <div className="min-w-0">
          <DialogTitle>{isEdit ? 'Edit condition' : 'Add condition'}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {isEdit ? 'Update the details below' : 'Enter the condition details below'}
          </DialogDescription>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="condition-name" className="block text-sm font-medium text-foreground mb-2">
              Condition name <span aria-hidden="true" className="text-destructive">*</span>
            </label>
            <HealthAutocompleteInput
              id="condition-name"
              type="condition"
              value={name}
              standardizedId={standardizedId}
              onChange={setName}
              onStandardizedIdChange={setStandardizedId}
              disabled={isPending}
            />

            {duplicateWarning && !proceedDespiteDuplicate && (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                  <p>
                    A condition named <strong>{duplicateWarning.name}</strong> already exists (status: {duplicateWarning.status}).
                  </p>
                  <button
                    type="button"
                    className="underline text-xs"
                    onClick={() => setProceedDespiteDuplicate(true)}
                  >
                    Add anyway
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <label htmlFor="condition-status" className="block text-sm font-medium text-foreground mb-2">
              Status
            </label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as HealthConditionStatus)}
              disabled={isPending}
            >
              <SelectTrigger className="w-full" id="condition-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as HealthConditionStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Diagnosed / onset date */}
          <div>
            <label id="condition-date-label" className="block text-sm font-medium text-foreground mb-2">
              Diagnosed / onset date <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </label>
            <HealthApproximateDateInput
              value={diagnosedOnsetDate}
              onChange={setDiagnosedOnsetDate}
              disabled={isPending}
              id="condition-date"
            />
          </div>

          {/* Stage / severity */}
          <div>
            <label htmlFor="condition-stage" className="block text-sm font-medium text-foreground mb-2">
              Stage / severity <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </label>
            <TextField.Input
              id="condition-stage"
              type="text"
              value={stageSeverity}
              onChange={(e) => setStageSeverity(e.target.value)}
              disabled={isPending}
              maxLength={120}
              placeholder="e.g. Stage 2, Mild"
            />
          </div>

          {/* Treating clinician */}
          <div>
            <label htmlFor="condition-clinician" className="block text-sm font-medium text-foreground mb-2">
              Treating clinician <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </label>
            <TextField.Input
              id="condition-clinician"
              type="text"
              value={treatingClinician}
              onChange={(e) => setTreatingClinician(e.target.value)}
              disabled={isPending}
              maxLength={160}
              placeholder="e.g. Dr. Smith"
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="condition-notes" className="block text-sm font-medium text-foreground mb-2">
              Notes <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="condition-notes"
              value={notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
              disabled={isPending}
              maxLength={2000}
              rows={3}
              placeholder="Any additional notes…"
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">{notes.length}/2000</p>
          </div>

          <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              className="w-full"
              disabled={isPending || !name.trim() || (Boolean(duplicateWarning) && !proceedDespiteDuplicate)}
              loading={isPending}
            >
              {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add condition'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
