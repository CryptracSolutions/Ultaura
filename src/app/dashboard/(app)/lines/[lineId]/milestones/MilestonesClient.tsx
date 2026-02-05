'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import { Switch } from '~/core/ui/Switch';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { useLeavePageGuard } from '~/core/hooks/use-leave-page-guard';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/core/ui/Dialog';
import {
  modalIconButtonClass,
} from '~/core/ui/modal-button-classes';
import {
  COMPACT_OUTLINE_BUTTON_CLASS,
  COMPACT_PRIMARY_BUTTON_CLASS,
} from '~/app/dashboard/(app)/components/compact-action-classes';
import type { LineRow, MilestoneRow } from '~/lib/ultaura/types';
import { createMilestone, updateMilestone, deleteMilestone } from '~/lib/ultaura/milestones';
import { MilestoneCalendar } from './MilestoneCalendar';

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const MILESTONE_TYPES = [
  { value: 'birthday', label: 'Birthday' },
  { value: 'anniversary', label: 'Anniversary' },
  { value: 'memorial', label: 'Memorial' },
  { value: 'achievement', label: 'Achievement' },
  { value: 'holiday', label: 'Holiday' },
] as const;

interface MilestonesClientProps {
  line: LineRow;
  milestones: MilestoneRow[];
  disabled?: boolean;
}

interface MilestoneFormState {
  title: string;
  milestoneType: string;
  dateMonth: number;
  dateDay: number;
  dateYear?: number | '';
  relatedPersonName: string;
  isRecurring: boolean;
}

const DEFAULT_FORM_STATE: MilestoneFormState = {
  title: '',
  milestoneType: 'birthday',
  dateMonth: 1,
  dateDay: 1,
  dateYear: '',
  relatedPersonName: '',
  isRecurring: true,
};

export function MilestonesClient({ line, milestones, disabled = false }: MilestonesClientProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<MilestoneRow | null>(null);
  const [formState, setFormState] = useState<MilestoneFormState>(DEFAULT_FORM_STATE);
  const [initialFormState, setInitialFormState] =
    useState<MilestoneFormState>(DEFAULT_FORM_STATE);
  const [milestoneToDelete, setMilestoneToDelete] = useState<MilestoneRow | null>(null);

  const resetForm = () => {
    setFormState(DEFAULT_FORM_STATE);
    setInitialFormState(DEFAULT_FORM_STATE);
    setEditingMilestone(null);
    setShowForm(false);
  };

  const openAddForm = () => {
    setFormState(DEFAULT_FORM_STATE);
    setInitialFormState(DEFAULT_FORM_STATE);
    setEditingMilestone(null);
    setShowForm(true);
  };

  const openEditForm = (milestone: MilestoneRow) => {
    const yearValue =
      typeof milestone.date_year === 'number'
        ? milestone.date_year
        : milestone.date_year
          ? Number(milestone.date_year)
          : '';
    const safeYear: MilestoneFormState['dateYear'] =
      typeof yearValue === 'number' && Number.isFinite(yearValue)
        ? yearValue
        : '';
    const nextState = {
      title: milestone.title,
      milestoneType: milestone.milestone_type,
      dateMonth: milestone.date_month,
      dateDay: milestone.date_day,
      dateYear: safeYear,
      relatedPersonName: milestone.related_person_name ?? '',
      isRecurring: milestone.is_recurring ?? true,
    };

    setEditingMilestone(milestone);
    setFormState(nextState);
    setInitialFormState(nextState);
    setShowForm(true);
  };

  const hasChanges =
    showForm &&
    (formState.title !== initialFormState.title ||
      formState.milestoneType !== initialFormState.milestoneType ||
      formState.dateMonth !== initialFormState.dateMonth ||
      formState.dateDay !== initialFormState.dateDay ||
      formState.dateYear !== initialFormState.dateYear ||
      formState.relatedPersonName !== initialFormState.relatedPersonName ||
      formState.isRecurring !== initialFormState.isRecurring);
  const shouldWarnOnNavigate = hasChanges && !isSubmitting;
  const { dialogProps } = useLeavePageGuard({
    isDirty: shouldWarnOnNavigate,
    onDiscard: resetForm,
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (disabled) return;

    if (!formState.title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      title: formState.title.trim(),
      milestoneType: formState.milestoneType,
      dateMonth: Number(formState.dateMonth),
      dateDay: Number(formState.dateDay),
      dateYear: formState.dateYear === '' ? undefined : Number(formState.dateYear),
      relatedPersonName: formState.relatedPersonName.trim() || undefined,
      isRecurring: formState.isRecurring,
    };

    try {
      if (editingMilestone) {
        const result = await updateMilestone(editingMilestone.id, payload, line.short_id);
        if (!result.success) {
          toast.error(result.error.message || 'Failed to update milestone');
          setIsSubmitting(false);
          return;
        }
        toast.success('Milestone updated');
      } else {
        const result = await createMilestone(line.id, payload);
        if (!result.success) {
          toast.error(result.error.message || 'Failed to create milestone');
          setIsSubmitting(false);
          return;
        }
        toast.success('Milestone added');
      }

      resetForm();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save milestone');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!milestoneToDelete || disabled) return;

    const target = milestoneToDelete;
    setMilestoneToDelete(null);

    const result = await deleteMilestone(target.id, line.short_id);
    if (!result.success) {
      toast.error(result.error.message || 'Failed to delete milestone');
      return;
    }

    toast.success('Milestone deleted');
    router.refresh();
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Track birthdays, anniversaries, memorial dates, and special achievements so Ultaura can celebrate with you.
        </p>
        <button
          onClick={openAddForm}
          disabled={disabled}
          className={`${COMPACT_PRIMARY_BUTTON_CLASS} sm:w-auto`}
        >
          <Plus className="h-3 w-3" />
          Add Milestone
        </button>
      </div>

      <Dialog
        open={showForm && !disabled}
        onOpenChange={(open) => {
          if (!open) {
            resetForm();
          }
        }}
      >
        <DialogContent
          className="sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
          overlayClassName="bg-black/50 backdrop-blur-none"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="truncate">
                {editingMilestone ? 'Edit milestone' : 'Add milestone'}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                These dates help Ultaura celebrate meaningful moments.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className={modalIconButtonClass}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="milestone-title" className="text-xs text-muted-foreground block mb-1">
                  Title
                </label>
                <Input
                  id="milestone-title"
                  value={formState.title}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder="e.g., Margaret's birthday"
                  required
                />
              </div>

              <div>
                <label htmlFor="milestone-type" className="text-xs text-muted-foreground block mb-1">
                  Type
                </label>
                <Select
                  value={formState.milestoneType}
                  onValueChange={(value) =>
                    setFormState((prev) => ({ ...prev, milestoneType: value }))
                  }
                >
                  <SelectTrigger id="milestone-type" className="w-full py-2.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MILESTONE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label htmlFor="milestone-person" className="text-xs text-muted-foreground block mb-1">
                  Related person
                </label>
                <Input
                  id="milestone-person"
                  value={formState.relatedPersonName}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, relatedPersonName: event.target.value }))
                  }
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="milestone-month" className="text-xs text-muted-foreground block mb-1">
                  Month
                </label>
                <Select
                  value={String(formState.dateMonth)}
                  onValueChange={(value) =>
                    setFormState((prev) => ({ ...prev, dateMonth: Number(value) }))
                  }
                >
                  <SelectTrigger id="milestone-month" className="w-full py-2.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map((month) => (
                      <SelectItem key={month.value} value={String(month.value)}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label htmlFor="milestone-day" className="text-xs text-muted-foreground block mb-1">
                  Day
                </label>
                <Input
                  id="milestone-day"
                  type="number"
                  min={1}
                  max={31}
                  value={formState.dateDay}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, dateDay: Number(event.target.value) }))
                  }
                  required
                />
              </div>

              <div>
                <label htmlFor="milestone-year" className="text-xs text-muted-foreground block mb-1">
                  Year (optional)
                </label>
                <Input
                  id="milestone-year"
                  type="number"
                  min={1900}
                  max={2100}
                  value={formState.dateYear}
                  onChange={(event) => {
                    const value = event.target.value;
                    setFormState((prev) => ({
                      ...prev,
                      dateYear: value === '' ? '' : Number(value),
                    }));
                  }}
                  placeholder="e.g., 1954"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-4">
              <div>
                <label
                  htmlFor="milestone-recurring"
                  className="text-sm font-medium text-foreground cursor-pointer"
                >
                  Recurring yearly
                </label>
                <p className="text-xs text-muted-foreground">
                  Turn off for one-time achievements or memorials.
                </p>
              </div>
              <Switch
                id="milestone-recurring"
                checked={formState.isRecurring}
                onCheckedChange={(checked) =>
                  setFormState((prev) => ({ ...prev, isRecurring: checked }))
                }
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className={COMPACT_OUTLINE_BUTTON_CLASS}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={COMPACT_PRIMARY_BUTTON_CLASS}
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3 h-3 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving
                  </>
                ) : (
                  editingMilestone ? 'Save changes' : 'Add milestone'
                )}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <MilestoneCalendar
        line={line}
        milestones={milestones}
        onEdit={openEditForm}
        onDelete={(milestone) => setMilestoneToDelete(milestone)}
        disabled={disabled}
      />

      <ConfirmationDialog
        open={Boolean(milestoneToDelete)}
        onOpenChange={(open) => {
          if (!open) setMilestoneToDelete(null);
        }}
        title="Delete milestone"
        description="This milestone will be removed and no longer celebrated."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <ConfirmationDialog
        open={dialogProps.open}
        onOpenChange={dialogProps.onOpenChange}
        title="Unsaved changes"
        description="You have unsaved changes. Leave without saving?"
        confirmLabel="Discard & leave"
        cancelLabel="Stay here"
        variant="default"
        onConfirm={dialogProps.onConfirm}
      />
    </div>
  );
}
