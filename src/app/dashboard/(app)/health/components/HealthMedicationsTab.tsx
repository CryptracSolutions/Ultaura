'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { Plus, Pencil, Trash2, Clock, Bell, Loader2, Pill, CheckCircle2 } from 'lucide-react';
import Button from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { HealthEmptyState } from './HealthEmptyState';
import { HealthMedicationForm } from './HealthMedicationForm';
import { HealthHistoryDrawer } from './HealthHistoryDrawer';
import { HealthMedicationReminderPanel } from './HealthMedicationReminderPanel';
import { ResponsiveActionMenu } from '~/components/ultaura/ResponsiveActionMenu';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';
import {
  getMedicationsAction,
  deleteMedicationAction,
  changeMedicationStatusAction,
} from '~/lib/ultaura/health/actions';
import { runWithRetries } from '../lib/health-fetch-utils';
import type { HealthMedication, HealthCondition, HealthMedicationStatus } from '@ultaura/types';

interface HealthMedicationsTabProps {
  lineId: string;
  accountId: string;
  conditions: HealthCondition[];
  initialMedications?: HealthMedication[];
}

type FilterView = 'current' | 'as_needed' | 'discontinued';

const VIEW_OPTIONS: Array<{ value: FilterView; label: string }> = [
  { value: 'current', label: 'Current' },
  { value: 'as_needed', label: 'As-needed' },
  { value: 'discontinued', label: 'Discontinued' },
];

const MEDICATION_STATUS_BADGE: Record<HealthMedicationStatus, { label: string; color: 'success' | 'info' | 'normal' }> = {
  current: { label: 'Current', color: 'success' },
  as_needed: { label: 'As-needed', color: 'info' },
  discontinued: { label: 'Discontinued', color: 'normal' },
};

export function HealthMedicationsTab({
  lineId,
  accountId,
  conditions,
  initialMedications,
}: HealthMedicationsTabProps) {
  const [activeView, setActiveView] = useState<FilterView>('current');
  const [medications, setMedications] = useState<HealthMedication[]>(initialMedications ?? []);
  const [loading, setLoading] = useState(initialMedications === undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestVersionRef = useRef(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<HealthMedication | undefined>(undefined);

  const [deleteTarget, setDeleteTarget] = useState<HealthMedication | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ medication: HealthMedication; newStatus: HealthMedicationStatus } | null>(null);
  const [historyTarget, setHistoryTarget] = useState<HealthMedication | null>(null);

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    requestVersionRef.current += 1;
    const requestVersion = requestVersionRef.current;

    if (initialMedications !== undefined) {
      setMedications(initialMedications);
      setLoadError(null);
      setLoading(false);
      return;
    }

    setMedications([]);
    setLoading(true);
    setLoadError(null);

    runWithRetries(() => getMedicationsAction(lineId))
      .then((result) => {
        if (requestVersionRef.current !== requestVersion) return;

        if (result.success) {
          setMedications(result.medications);
          setLoadError(null);
          return;
        }

        setMedications([]);
        setLoadError(result.error);
      })
      .catch(() => {
        if (requestVersionRef.current !== requestVersion) return;
        setMedications([]);
        setLoadError('Failed to load medications');
      })
      .finally(() => {
        if (requestVersionRef.current === requestVersion) {
          setLoading(false);
        }
      });

    return () => {
      if (requestVersionRef.current === requestVersion) {
        requestVersionRef.current += 1;
      }
    };
  }, [lineId, initialMedications]);

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
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Pill className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-base font-semibold text-foreground">Medications</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage current medications, dosages, and reminders.
          </p>
        </div>
        {medications.length > 0 && (
          <Button
            variant="default"
            size="small"
            className="w-full sm:w-auto"
            onClick={handleAdd}
          >
            <Plus className="h-4 w-4" />
            Add medication
          </Button>
        )}
      </div>

      {/* View filter */}
      <div className="flex sm:inline-flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Filter medications by status">
        {VIEW_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setActiveView(opt.value)}
            aria-pressed={activeView === opt.value}
            className={`flex-1 sm:flex-initial rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              activeView === opt.value
                ? 'bg-primary/10 text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Loading medications…
        </div>
      )}

      {!loading && loadError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {!loading && !loadError && medications.length === 0 ? (
        <HealthEmptyState
          icon={Pill}
          headline="No medications added yet"
          description="Add medications to help Ultaura remember dosages and send reminders."
          ctaLabel="Add medication"
          onCtaClick={handleAdd}
        />
      ) : !loading && !loadError && filteredMedications.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          No {VIEW_OPTIONS.find((v) => v.value === activeView)?.label.toLowerCase()} medications.
        </div>
      ) : !loading && !loadError && filteredMedications.length > 0 ? (
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
              onChangeStatus={(newStatus) =>
                setStatusTarget({ medication: med, newStatus })
              }
              onViewHistory={() => setHistoryTarget(med)}
            />
          ))}
        </div>
      ) : null}

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
  onChangeStatus: (newStatus: HealthMedicationStatus) => void;
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

  const badge = MEDICATION_STATUS_BADGE[medication.status];
  const otherStatuses = (Object.keys(MEDICATION_STATUS_BADGE) as HealthMedicationStatus[]).filter(
    (s) => s !== medication.status,
  );

  const hasDetails = medication.dosage || medication.frequency || medication.timesOfDay.length > 0 || linkedConditionName;

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-3">
      {/* Header row — name + action buttons */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{medication.name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowReminders((v) => !v)}
                className={`p-2 rounded-lg transition-colors ${showReminders ? 'bg-primary/10 text-primary' : 'text-primary hover:bg-primary/10'}`}
                aria-label={`${showReminders ? 'Hide' : 'Show'} reminders for ${medication.name}`}
                aria-expanded={showReminders}
              >
                <Bell className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent sideOffset={20}>Reminders</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onViewHistory}
                className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                aria-label={`View history for ${medication.name}`}
              >
                <Clock className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent sideOffset={20}>History</TooltipContent>
          </Tooltip>
          <ResponsiveActionMenu
            title={medication.name}
            actions={[
              {
                label: 'Edit',
                icon: <Pencil className="w-5 h-5" />,
                onClick: onEdit,
                disabled: isPending,
              },
              {
                label: 'Change status',
                icon: <CheckCircle2 className="w-5 h-5" />,
                subItems: otherStatuses.map((s) => ({
                  label: MEDICATION_STATUS_BADGE[s].label,
                  onClick: () => onChangeStatus(s),
                })),
              },
              {
                label: 'Delete',
                icon: <Trash2 className="w-5 h-5" />,
                onClick: onDelete,
                variant: 'destructive' as const,
                separator: true,
                disabled: isPending,
              },
            ]}
            disabled={isPending}
          />
        </div>
      </div>

      {/* Details row — medication info + status badge */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {medication.dosage && <span>Dosage: {medication.dosage}</span>}
          {medication.frequency && <span>Frequency: {medication.frequency}</span>}
          {medication.timesOfDay.length > 0 && <span>Times: {medication.timesOfDay.join(', ')}</span>}
          {linkedConditionName && <span>For: {linkedConditionName}</span>}
        </div>
        <Badge color={badge.color} size="small">{badge.label}</Badge>
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
