'use client';

import { useState, useEffect, useTransition } from 'react';
import { Plus, Pencil, Trash2, Clock, Bell } from 'lucide-react';
import Button from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { HealthMedicationForm } from './HealthMedicationForm';
import { HealthHistoryDrawer } from './HealthHistoryDrawer';
import { HealthMedicationReminderPanel } from './HealthMedicationReminderPanel';
import {
  getMedicationsAction,
  deleteMedicationAction,
  changeMedicationStatusAction,
} from '~/lib/ultaura/health/actions';
import type { HealthMedication, HealthCondition, HealthMedicationStatus } from '@ultaura/types';

interface HealthMedicationsTabProps {
  lineId: string;
  accountId: string;
  conditions: HealthCondition[];
}

type FilterView = 'current' | 'as_needed' | 'discontinued';

const VIEW_OPTIONS: Array<{ value: FilterView; label: string }> = [
  { value: 'current', label: 'Current' },
  { value: 'as_needed', label: 'As-needed' },
  { value: 'discontinued', label: 'Discontinued' },
];

function statusBadgeColor(status: HealthMedicationStatus): 'success' | 'info' | 'normal' {
  if (status === 'current') return 'success';
  if (status === 'as_needed') return 'info';
  return 'normal';
}

function statusLabel(status: HealthMedicationStatus): string {
  if (status === 'current') return 'Current';
  if (status === 'as_needed') return 'As-needed';
  return 'Discontinued';
}

export function HealthMedicationsTab({
  lineId,
  accountId,
  conditions,
}: HealthMedicationsTabProps) {
  const [activeView, setActiveView] = useState<FilterView>('current');
  const [medications, setMedications] = useState<HealthMedication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<HealthMedication | undefined>(undefined);

  const [deleteTarget, setDeleteTarget] = useState<HealthMedication | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ medication: HealthMedication; newStatus: HealthMedicationStatus } | null>(null);
  const [historyTarget, setHistoryTarget] = useState<HealthMedication | null>(null);

  const [isPending, startTransition] = useTransition();

  async function loadMedications() {
    setLoading(true);
    setLoadError(null);
    const result = await getMedicationsAction(lineId);
    if (result.success) {
      setMedications(result.medications);
    } else {
      setLoadError(result.error);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadMedications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineId]);

  const filteredMedications = medications.filter((m) => m.status === activeView);

  function handleAdd() {
    setEditingMedication(undefined);
    setFormOpen(true);
  }

  function handleEdit(medication: HealthMedication) {
    setEditingMedication(medication);
    setFormOpen(true);
  }

  function handleSaved(medication: HealthMedication) {
    setMedications((prev) => {
      const existing = prev.findIndex((m) => m.id === medication.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = medication;
        return updated;
      }
      return [medication, ...prev];
    });
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    startTransition(async () => {
      const result = await deleteMedicationAction(id, lineId);
      if (result.success) {
        setMedications((prev) => prev.filter((m) => m.id !== id));
      }
      setDeleteTarget(null);
    });
  }

  function handleStatusConfirm() {
    if (!statusTarget) return;
    const { medication, newStatus } = statusTarget;
    startTransition(async () => {
      const result = await changeMedicationStatusAction(medication.id, lineId, newStatus);
      if (result.success) {
        setMedications((prev) =>
          prev.map((m) => (m.id === medication.id ? { ...m, status: newStatus } : m)),
        );
      }
      setStatusTarget(null);
    });
  }

  function getNextStatus(current: HealthMedicationStatus): HealthMedicationStatus {
    if (current === 'current') return 'discontinued';
    if (current === 'discontinued') return 'current';
    return 'current';
  }

  const conditionNameMap = Object.fromEntries(conditions.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">Medications</h3>
        <Button
          variant="default"
          size="small"
          onClick={handleAdd}
          className="min-h-[44px] gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Add medication
        </Button>
      </div>

      {/* View filter */}
      <div className="flex gap-1 flex-wrap" role="group" aria-label="Filter medications by status">
        {VIEW_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setActiveView(opt.value)}
            aria-pressed={activeView === opt.value}
            className={`min-h-[44px] rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              activeView === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'border border-input bg-background text-foreground hover:bg-muted'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading medications...</div>
      )}

      {!loading && loadError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {!loading && !loadError && filteredMedications.length === 0 && (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          No {VIEW_OPTIONS.find((v) => v.value === activeView)?.label.toLowerCase()} medications.
        </div>
      )}

      {!loading && !loadError && filteredMedications.length > 0 && (
        <div className="space-y-3">
          {filteredMedications.map((med) => (
            <MedicationCard
              key={med.id}
              medication={med}
              conditionNameMap={conditionNameMap}
              lineId={lineId}
              accountId={accountId}
              isPending={isPending}
              onEdit={() => handleEdit(med)}
              onDelete={() => setDeleteTarget(med)}
              onChangeStatus={() =>
                setStatusTarget({ medication: med, newStatus: getNextStatus(med.status) })
              }
              onViewHistory={() => setHistoryTarget(med)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit form */}
      <HealthMedicationForm
        open={formOpen}
        onOpenChange={setFormOpen}
        lineId={lineId}
        accountId={accountId}
        medication={editingMedication}
        conditions={conditions}
        existingMedications={medications}
        onSaved={handleSaved}
      />

      {/* Delete confirmation */}
      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete medication"
        description={`Remove "${deleteTarget?.name}" from this line's medications? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />

      {/* Status change confirmation */}
      <ConfirmationDialog
        open={!!statusTarget}
        onOpenChange={(open) => { if (!open) setStatusTarget(null); }}
        title="Change status"
        description={`Change "${statusTarget?.medication.name}" to ${statusTarget?.newStatus.replace('_', '-')}?`}
        confirmLabel="Change status"
        cancelLabel="Cancel"
        variant="default"
        onConfirm={handleStatusConfirm}
      />

      {/* History drawer */}
      {historyTarget && (
        <HealthHistoryDrawer
          open={!!historyTarget}
          onOpenChange={(open) => { if (!open) setHistoryTarget(null); }}
          lineId={lineId}
          itemKind="medication"
          itemId={historyTarget.id}
          title={`History — ${historyTarget.name}`}
        />
      )}
    </div>
  );
}

interface MedicationCardProps {
  medication: HealthMedication;
  conditionNameMap: Record<string, string>;
  lineId: string;
  accountId: string;
  isPending: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onChangeStatus: () => void;
  onViewHistory: () => void;
}

function MedicationCard({
  medication,
  conditionNameMap,
  lineId,
  accountId,
  isPending,
  onEdit,
  onDelete,
  onChangeStatus,
  onViewHistory,
}: MedicationCardProps) {
  const [showReminders, setShowReminders] = useState(false);
  const linkedConditionName = medication.linkedConditionId
    ? conditionNameMap[medication.linkedConditionId]
    : null;

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-base font-semibold text-foreground leading-snug">{medication.name}</p>
          <Badge color={statusBadgeColor(medication.status)} size="small">
            {statusLabel(medication.status)}
          </Badge>
        </div>
      </div>

      {/* Details */}
      <dl className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
        {medication.dosage && (
          <div>
            <dt className="text-xs text-muted-foreground">Dosage</dt>
            <dd className="text-foreground">{medication.dosage}</dd>
          </div>
        )}
        {medication.frequency && (
          <div>
            <dt className="text-xs text-muted-foreground">Frequency</dt>
            <dd className="text-foreground">{medication.frequency}</dd>
          </div>
        )}
        {medication.timesOfDay.length > 0 && (
          <div>
            <dt className="text-xs text-muted-foreground">Times</dt>
            <dd className="text-foreground">{medication.timesOfDay.join(', ')}</dd>
          </div>
        )}
        {linkedConditionName && (
          <div>
            <dt className="text-xs text-muted-foreground">Linked condition</dt>
            <dd className="text-foreground">{linkedConditionName}</dd>
          </div>
        )}
      </dl>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          variant="outline"
          size="small"
          onClick={onEdit}
          disabled={isPending}
          className="min-h-[44px] gap-1"
          aria-label={`Edit ${medication.name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>

        <Button
          variant="outline"
          size="small"
          onClick={onChangeStatus}
          disabled={isPending}
          className="min-h-[44px]"
          aria-label={`Change status of ${medication.name}`}
        >
          Change status
        </Button>

        <Button
          variant="ghost"
          size="small"
          onClick={() => setShowReminders((v) => !v)}
          disabled={isPending}
          className="min-h-[44px] gap-1"
          aria-label={`${showReminders ? 'Hide' : 'Show'} reminders for ${medication.name}`}
          aria-expanded={showReminders}
        >
          <Bell className="h-3.5 w-3.5" />
          Reminders
        </Button>

        <Button
          variant="ghost"
          size="small"
          onClick={onViewHistory}
          disabled={isPending}
          className="min-h-[44px] gap-1"
          aria-label={`View history for ${medication.name}`}
        >
          <Clock className="h-3.5 w-3.5" />
          History
        </Button>

        <Button
          variant="ghost"
          size="small"
          onClick={onDelete}
          disabled={isPending}
          className="min-h-[44px] gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
          aria-label={`Delete ${medication.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>

      {/* Reminder panel */}
      {showReminders && (
        <HealthMedicationReminderPanel
          medicationId={medication.id}
          lineId={lineId}
          accountId={accountId}
          medicationName={medication.name}
        />
      )}
    </div>
  );
}
