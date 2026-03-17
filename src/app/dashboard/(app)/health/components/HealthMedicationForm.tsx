'use client';

import { useState, useTransition, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '~/core/ui/Dialog';
import Button from '~/core/ui/Button';
import TextField from '~/core/ui/TextField';
import Textarea from '~/core/ui/Textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/core/ui/Select';
import { HealthTimesOfDayInput } from './HealthTimesOfDayInput';
import { HealthAutocompleteInput } from './HealthAutocompleteInput';
import { HealthApproximateDateInput } from './HealthApproximateDateInput';
import {
  createMedicationAction,
  editMedicationAction,
} from '~/lib/ultaura/health/actions';
import type {
  HealthMedication,
  HealthCondition,
  HealthMedicationStatus,
  ApproximateDate,
} from '@ultaura/types';

interface HealthMedicationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineId: string;
  accountId: string;
  medication?: HealthMedication;
  conditions: HealthCondition[];
  existingMedications: HealthMedication[];
  onSaved: (medication: HealthMedication) => void;
}

interface FormState {
  name: string;
  standardizedId: { system: string; code: string } | null;
  status: HealthMedicationStatus;
  dosage: string;
  frequency: string;
  timesOfDay: string[];
  prescribedBy: string;
  startDate: ApproximateDate | null;
  endDate: ApproximateDate | null;
  linkedConditionId: string;
  linkedReason: string;
  notes: string;
}

function buildInitialState(medication?: HealthMedication): FormState {
  if (medication) {
    return {
      name: medication.name,
      standardizedId: medication.standardizedId,
      status: medication.status,
      dosage: medication.dosage ?? '',
      frequency: medication.frequency ?? '',
      timesOfDay: medication.timesOfDay,
      prescribedBy: medication.prescribedBy ?? '',
      startDate: medication.startDate,
      endDate: medication.endDate,
      linkedConditionId: medication.linkedConditionId ?? '',
      linkedReason: medication.linkedReason ?? '',
      notes: medication.notes ?? '',
    };
  }

  return {
    name: '',
    standardizedId: null,
    status: 'current',
    dosage: '',
    frequency: '',
    timesOfDay: [],
    prescribedBy: '',
    startDate: null,
    endDate: null,
    linkedConditionId: '',
    linkedReason: '',
    notes: '',
  };
}

export function HealthMedicationForm({
  open,
  onOpenChange,
  lineId,
  accountId: _accountId,
  medication,
  conditions,
  existingMedications,
  onSaved,
}: HealthMedicationFormProps) {
  const isEditing = !!medication;
  const [form, setForm] = useState<FormState>(() => buildInitialState(medication));
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset form when medication changes or dialog opens
  useEffect(() => {
    if (open) {
      setForm(buildInitialState(medication));
      setError(null);
      setDuplicateWarning(null);
    }
  }, [open, medication]);

  // Check for duplicate name on name change (client-side quick check)
  useEffect(() => {
    if (!form.name.trim()) {
      setDuplicateWarning(null);
      return;
    }

    const trimmedName = form.name.trim().toLowerCase();
    const duplicate = existingMedications.find(
      (m) =>
        m.name.trim().toLowerCase() === trimmedName &&
        m.id !== medication?.id,
    );

    if (duplicate) {
      setDuplicateWarning(`A medication named "${duplicate.name}" already exists.`);
    } else {
      setDuplicateWarning(null);
    }
  }, [form.name, existingMedications, medication?.id]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = form.name.trim();
    if (!name) {
      setError('Medication name is required.');
      return;
    }

    startTransition(async () => {
      const input = {
        name,
        standardizedId: form.standardizedId,
        status: form.status,
        dosage: form.dosage.trim() || null,
        frequency: form.frequency.trim() || null,
        timesOfDay: form.timesOfDay,
        prescribedBy: form.prescribedBy.trim() || null,
        startDate: form.startDate,
        endDate: form.endDate,
        linkedConditionId: form.linkedConditionId || null,
        linkedReason: form.linkedReason.trim() || null,
        notes: form.notes.trim() || null,
      };

      let result;
      if (isEditing && medication) {
        result = await editMedicationAction(medication.id, lineId, input);
      } else {
        result = await createMedicationAction(lineId, input);
      }

      if (!result.success) {
        setError(result.error);
        return;
      }

      onSaved(result.medication);
      onOpenChange(false);
    });
  }

  const activeConditions = conditions.filter((c) => c.status === 'active' || c.status === 'monitoring');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="mobile-form-sheet sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
        overlayClassName="bg-black/50 backdrop-blur-none"
      >
        <DialogTitle>{isEditing ? 'Edit medication' : 'Add medication'}</DialogTitle>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Name */}
          <TextField>
            <TextField.Label htmlFor="med-name">
              Name <span aria-hidden>*</span>
            </TextField.Label>
            <HealthAutocompleteInput
              id="med-name"
              type="medication"
              value={form.name}
              standardizedId={form.standardizedId}
              onChange={(val) => setField('name', val)}
              onStandardizedIdChange={(id) => setField('standardizedId', id)}
              placeholder="e.g. Lisinopril"
              disabled={isPending}
            />
            {duplicateWarning && (
              <TextField.Hint>
                <span className="text-warning">{duplicateWarning}</span>
              </TextField.Hint>
            )}
          </TextField>

          {/* Status */}
          <TextField>
            <TextField.Label htmlFor="med-status">Status</TextField.Label>
            <Select
              value={form.status}
              onValueChange={(v) => setField('status', v as HealthMedicationStatus)}
              disabled={isPending}
            >
              <SelectTrigger id="med-status" aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current</SelectItem>
                <SelectItem value="as_needed">As-needed</SelectItem>
                <SelectItem value="discontinued">Discontinued</SelectItem>
              </SelectContent>
            </Select>
          </TextField>

          {/* Dosage */}
          <TextField>
            <TextField.Label htmlFor="med-dosage">Dosage</TextField.Label>
            <TextField.Input
              id="med-dosage"
              value={form.dosage}
              onChange={(e) => setField('dosage', e.target.value)}
              placeholder="e.g. 10mg"
              maxLength={120}
              disabled={isPending}
            />
          </TextField>

          {/* Frequency */}
          <TextField>
            <TextField.Label htmlFor="med-frequency">Frequency</TextField.Label>
            <TextField.Input
              id="med-frequency"
              value={form.frequency}
              onChange={(e) => setField('frequency', e.target.value)}
              placeholder="e.g. Once daily"
              maxLength={120}
              disabled={isPending}
            />
          </TextField>

          {/* Times of day */}
          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium leading-none">Times of day</label>
            <HealthTimesOfDayInput
              value={form.timesOfDay}
              onChange={(times) => setField('timesOfDay', times)}
            />
          </div>

          {/* Prescribed by */}
          <TextField>
            <TextField.Label htmlFor="med-prescribedBy">Prescribed by</TextField.Label>
            <TextField.Input
              id="med-prescribedBy"
              value={form.prescribedBy}
              onChange={(e) => setField('prescribedBy', e.target.value)}
              placeholder="e.g. Dr. Smith"
              maxLength={160}
              disabled={isPending}
            />
          </TextField>

          {/* Start date */}
          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium leading-none">Start date</label>
            <HealthApproximateDateInput
              value={form.startDate}
              onChange={(d) => setField('startDate', d)}
              disabled={isPending}
            />
          </div>

          {/* End date */}
          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium leading-none">End date</label>
            <HealthApproximateDateInput
              value={form.endDate}
              onChange={(d) => setField('endDate', d)}
              disabled={isPending}
            />
          </div>

          {/* Linked condition */}
          {activeConditions.length > 0 && (
            <TextField>
              <TextField.Label htmlFor="med-linkedCondition">Linked condition</TextField.Label>
              <Select
                value={form.linkedConditionId || '__none__'}
                onValueChange={(v) => setField('linkedConditionId', v === '__none__' ? '' : v)}
                disabled={isPending}
              >
                <SelectTrigger id="med-linkedCondition" aria-label="Linked condition">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {activeConditions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TextField>
          )}

          {/* Linked reason (only when condition is linked) */}
          {form.linkedConditionId && (
            <TextField>
              <TextField.Label htmlFor="med-linkedReason">Reason for link</TextField.Label>
              <TextField.Input
                id="med-linkedReason"
                value={form.linkedReason}
                onChange={(e) => setField('linkedReason', e.target.value)}
                placeholder="Optional — why this medication is linked to the condition"
                maxLength={200}
                disabled={isPending}
              />
            </TextField>
          )}

          {/* Notes */}
          <div className="flex flex-col space-y-1">
            <label htmlFor="med-notes" className="text-sm font-medium leading-none">
              Notes
            </label>
            <Textarea
              id="med-notes"
              value={form.notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setField('notes', e.target.value)}
              placeholder="Any additional notes"
              maxLength={2000}
              rows={3}
              disabled={isPending}
              autoResize
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              className="w-full"
              loading={isPending}
              disabled={isPending}
            >
              {isEditing ? 'Save changes' : 'Add medication'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
