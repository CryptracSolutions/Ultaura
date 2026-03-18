'use client';

import { useMemo, useState, useTransition } from 'react';
import { Plus, Pencil, Trash2, History, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import Button from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import { HealthObservationForm } from './HealthObservationForm';
import { HealthHistoryDrawer } from './HealthHistoryDrawer';
import { HealthEmptyState } from './HealthEmptyState';
import { deleteObservationAction } from '~/lib/ultaura/health/actions';
import type { HealthObservation, HealthObservationCategory, HealthObservationConcern } from '@ultaura/types';

interface HealthObservationsTabProps {
  lineId: string;
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


const CONCERN_BADGE: Record<HealthObservationConcern, { label: string; color: 'normal' | 'warn' | 'error' }> = {
  note: { label: 'Note', color: 'normal' },
  mild_concern: { label: 'Mild Concern', color: 'warn' },
  significant_concern: { label: 'Significant Concern', color: 'error' },
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

  const handleDelete = () => {
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
      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-foreground leading-relaxed flex-1 min-w-0">{truncated}</p>
          <Badge color={concernBadge.color} size="small">{concernBadge.label}</Badge>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2">
          {observation.category && (
            <Badge color="normal" size="small">{CATEGORY_LABELS[observation.category]}</Badge>
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
            size="small"
            onClick={() => setEditOpen(true)}
            aria-label="Edit observation"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>

          <Button
            variant="ghost"
            size="small"
            onClick={() => setHistoryOpen(true)}
            aria-label="View observation history"
          >
            <History className="h-3.5 w-3.5" />
            History
          </Button>

          <Button
            variant="ghost"
            size="small"
            className="text-destructive hover:text-destructive"
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

export function HealthObservationsTab({ lineId, observations: initialObservations }: HealthObservationsTabProps) {
  const [observations, setObservations] = useState<HealthObservation[]>(initialObservations);
  const [addOpen, setAddOpen] = useState(false);
  const [concernFilter, setConcernFilter] = useState<HealthObservationConcern | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<HealthObservationCategory | 'all'>('all');

  // Sort by createdAt desc (server already returns in order but keep client-side consistent)
  const sorted = useMemo(
    () => [...observations].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [observations],
  );

  const filtered = sorted.filter((o) => {
    if (concernFilter !== 'all' && (o.concernLevel ?? 'note') !== concernFilter) return false;
    if (categoryFilter !== 'all' && o.category !== categoryFilter) return false;
    return true;
  });

  // Build concern and category counts in a single pass
  const { concernCounts, categoryCounts } = useMemo(() => {
    const concern = { all: sorted.length, note: 0, mild_concern: 0, significant_concern: 0 };
    const category: Record<string, number> = {};

    for (const o of sorted) {
      const level = o.concernLevel ?? 'note';
      if (level === 'note') concern.note++;
      else if (level === 'mild_concern') concern.mild_concern++;
      else if (level === 'significant_concern') concern.significant_concern++;

      if (o.category) {
        category[o.category] = (category[o.category] ?? 0) + 1;
      }
    }

    return {
      concernCounts: concern,
      categoryCounts: category as Record<HealthObservationCategory, number>,
    };
  }, [sorted]);

  const handleDeleted = (id: string) => {
    setObservations((prev) => prev.filter((o) => o.id !== id));
  };

  const handleAdded = (observation?: HealthObservation) => {
    setAddOpen(false);
    if (observation) {
      setObservations((prev) => [observation, ...prev]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-base font-semibold text-foreground">Observations</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Log day-to-day notes about health, mood, or behavior changes.
          </p>
        </div>
        {observations.length > 0 && (
          <Button
            variant="default"
            size="small"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add observation
          </Button>
        )}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Filter by concern level">
          {(
            [
              { value: 'all', label: 'All' },
              { value: 'note', label: 'Notes' },
              { value: 'mild_concern', label: 'Mild Concern' },
              { value: 'significant_concern', label: 'Significant Concern' },
            ] as { value: HealthObservationConcern | 'all'; label: string }[]
          ).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setConcernFilter(value)}
              aria-pressed={concernFilter === value}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                concernFilter === value
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
              {concernCounts[value] > 0 && (
                <span className="ml-1.5 text-xs text-muted-foreground">{concernCounts[value]}</span>
              )}
            </button>
          ))}
        </div>

        <div className="ml-auto">
          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v as HealthObservationCategory | 'all')}
          >
            <SelectTrigger className="h-9 min-w-[180px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories{sorted.length > 0 ? ` (${sorted.length})` : ''}</SelectItem>
              {(Object.entries(CATEGORY_LABELS) as [HealthObservationCategory, string][]).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}{categoryCounts[value] > 0 ? ` (${categoryCounts[value]})` : ''}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      {observations.length === 0 ? (
        <HealthEmptyState
          icon={ClipboardList}
          headline="No observations yet"
          description="Log day-to-day notes about health, mood, or behavior changes to spot patterns over time."
          ctaLabel="Add observation"
          onCtaClick={() => setAddOpen(true)}
        />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No observations match the selected filters.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((observation) => (
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
