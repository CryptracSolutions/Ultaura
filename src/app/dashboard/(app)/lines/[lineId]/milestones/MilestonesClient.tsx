'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import Button from '~/core/ui/Button';
import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import { Switch } from '~/core/ui/Switch';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
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
  { value: 'custom', label: 'Custom' },
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
  const [milestoneToDelete, setMilestoneToDelete] = useState<MilestoneRow | null>(null);

  const resetForm = () => {
    setFormState(DEFAULT_FORM_STATE);
    setEditingMilestone(null);
    setShowForm(false);
  };

  const openAddForm = () => {
    setFormState(DEFAULT_FORM_STATE);
    setEditingMilestone(null);
    setShowForm(true);
  };

  const openEditForm = (milestone: MilestoneRow) => {
    setEditingMilestone(milestone);
    setFormState({
      title: milestone.title,
      milestoneType: milestone.milestone_type,
      dateMonth: milestone.date_month,
      dateDay: milestone.date_day,
      dateYear: milestone.date_year ?? '',
      relatedPersonName: milestone.related_person_name ?? '',
      isRecurring: milestone.is_recurring ?? true,
    });
    setShowForm(true);
  };

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
          Track birthdays, anniversaries, memorial dates, and special achievements.
        </p>
        <Button onClick={openAddForm} disabled={disabled} size="small">
          <Plus className="h-4 w-4 mr-2" />
          Add Milestone
        </Button>
      </div>

      {showForm && !disabled ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-card p-6 space-y-4"
        >
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {editingMilestone ? 'Edit milestone' : 'Add milestone'}
            </h3>
            <p className="text-xs text-muted-foreground">
              These dates help Ultaura celebrate meaningful moments.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground block mb-1">Title</label>
              <Input
                value={formState.title}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="e.g., Margaret's birthday"
                required
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Type</label>
              <Select
                value={formState.milestoneType}
                onValueChange={(value) =>
                  setFormState((prev) => ({ ...prev, milestoneType: value }))
                }
              >
                <SelectTrigger className="w-full py-2.5">
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
              <label className="text-xs text-muted-foreground block mb-1">Related person</label>
              <Input
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
              <label className="text-xs text-muted-foreground block mb-1">Month</label>
              <Select
                value={String(formState.dateMonth)}
                onValueChange={(value) =>
                  setFormState((prev) => ({ ...prev, dateMonth: Number(value) }))
                }
              >
                <SelectTrigger className="w-full py-2.5">
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
              <label className="text-xs text-muted-foreground block mb-1">Day</label>
              <Input
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
              <label className="text-xs text-muted-foreground block mb-1">Year (optional)</label>
              <Input
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
              <p className="text-sm font-medium text-foreground">Recurring yearly</p>
              <p className="text-xs text-muted-foreground">
                Turn off for one-time achievements or memorials.
              </p>
            </div>
            <Switch
              checked={formState.isRecurring}
              onCheckedChange={(checked) =>
                setFormState((prev) => ({ ...prev, isRecurring: checked }))
              }
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting} loading={isSubmitting}>
              {editingMilestone ? 'Save changes' : 'Add milestone'}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

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
    </div>
  );
}
