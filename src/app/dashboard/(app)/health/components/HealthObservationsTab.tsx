'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil, Trash2, History } from 'lucide-react';
import { toast } from 'sonner';
import Button from '~/core/ui/Button';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { HealthObservationForm } from './HealthObservationForm';
import { HealthHistoryDrawer } from './HealthHistoryDrawer';
import { deleteObservationAction } from '~/lib/ultaura/health/actions';
import type { HealthObservation, HealthObservationCategory, HealthObservationConcern } from '@ultaura/types';

interface HealthObservationsTabProps {
  lineId: string;
  accountId: string;
  observations: HealthObservation[];
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

const CATEGORY_BADGE: Record<HealthObservationCategory, string> = {
  memory: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  mood_emotional: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  physical_mobility: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  nutrition_eating: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  sleep: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  social_engagement: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  medication_compliance: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  general_other: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const CONCERN_BADGE: Record<HealthObservationConcern, { label: string; className: string }> = {
  note: { label: 'Note', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  mild_concern: { label: 'Mild Concern', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  significant_concern: { label: 'Significant Concern', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
};

function formatObservedDate(date: string): string {
  // date is YYYY-MM-DD; format as Month D, YYYY
  const [year, month, day] = date.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[month - 1]} ${day}, ${year}`;
}

function ObservationCard({
  observation,
  lineId,
  onDeleted,
}: {
  observation: HealthObservation;
  lineId: string;
  onDeleted: (id: string) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [_isPending, startTransition] = useTransition();

  const truncated = observation.text.length > 100
    ? observation.text.slice(0, 100) + '…'
    : observation.text;

  const concernBadge = observation.concernLevel
    ? CONCERN_BADGE[observation.concernLevel]
    : CONCERN_BADGE['note'];

  const handleDelete = async () => {
    startTransition(async () => {
      const result = await deleteObservationAction(observation.id, lineId);
      if (result.success) {
        toast.success('Observation removed');
        onDeleted(observation.id);
      } else {
        toast.error(result.error ?? 'Failed to remove observation');
      }
    });
  };

  return (
    <>
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-foreground leading-relaxed flex-1 min-w-0">{truncated}</p>
          <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${concernBadge.className}`}>
            {concernBadge.label}
          </span>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2">
          {observation.category && (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_BADGE[observation.category]}`}>
              {CATEGORY_LABELS[observation.category]}
            </span>
          )}
          {observation.observedDate && (
            <span className="text-xs text-muted-foreground">
              {formatObservedDate(observation.observedDate)}
            </span>
          )}
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px] gap-1.5"
            onClick={() => setEditOpen(true)}
            aria-label="Edit observation"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="min-h-[44px] gap-1.5"
            onClick={() => setHistoryOpen(true)}
            aria-label="View observation history"
          >
            <History className="h-3.5 w-3.5" />
            History
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="min-h-[44px] gap-1.5 text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
            aria-label="Delete observation"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      <HealthObservationForm
        open={editOpen}
        onOpenChange={setEditOpen}
        lineId={lineId}
        observation={observation}
      />

      <HealthHistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        lineId={lineId}
        itemKind="observation"
        itemId={observation.id}
        title="Observation history"
      />

      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Remove observation"
        description="Remove this observation from the health profile? This action is recorded in history."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}

export function HealthObservationsTab({
  lineId,
  observations: initialObservations,
}: HealthObservationsTabProps) {
  const [observations, setObservations] = useState<HealthObservation[]>(initialObservations);
  const [addOpen, setAddOpen] = useState(false);

  // Sort by createdAt desc (server already returns in order but keep client-side consistent)
  const sorted = [...observations].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const handleDeleted = (id: string) => {
    setObservations((prev) => prev.filter((o) => o.id !== id));
  };

  const handleAdded = () => {
    setAddOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-base font-semibold text-foreground">Observations</h3>
        <Button
          variant="default"
          size="sm"
          className="min-h-[44px] gap-1.5"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Add observation
        </Button>
      </div>

      {/* Content */}
      {sorted.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No observations yet. Add one using the button above.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((observation) => (
            <ObservationCard
              key={observation.id}
              observation={observation}
              lineId={lineId}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}

      {/* Add observation dialog */}
      <HealthObservationForm
        open={addOpen}
        onOpenChange={setAddOpen}
        lineId={lineId}
        onSuccess={handleAdded}
      />
    </div>
  );
}
