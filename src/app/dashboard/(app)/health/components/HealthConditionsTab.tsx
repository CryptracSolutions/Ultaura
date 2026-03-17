'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil, Trash2, History, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import Button from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { HealthConditionForm } from './HealthConditionForm';
import { HealthHistoryDrawer } from './HealthHistoryDrawer';
import {
  deleteConditionAction,
  changeConditionStatusAction,
} from '~/lib/ultaura/health/actions';
import type { HealthCondition, HealthConditionStatus } from '@ultaura/types';

interface HealthConditionsTabProps {
  lineId: string;
  accountId: string;
  conditions: HealthCondition[];
}

type ViewMode = 'active' | 'resolved';

const STATUS_BADGE: Record<HealthConditionStatus, { label: string; color: 'success' | 'warn' | 'normal' }> = {
  active: { label: 'Active', color: 'success' },
  monitoring: { label: 'Monitoring', color: 'warn' },
  resolved: { label: 'Resolved', color: 'normal' },
};

function formatApproximateDate(date: HealthCondition['diagnosedOnsetDate']): string | null {
  if (!date) return null;
  const parts = date.value.split('-');
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIdx = parseInt(parts[1], 10) - 1;
    return `${months[monthIdx] ?? parts[1]} ${parts[0]}`;
  }
  return date.value;
}

function ConditionCard({
  condition,
  allConditions,
  lineId,
  accountId,
  onDeleted,
  onStatusChanged,
}: {
  condition: HealthCondition;
  allConditions: HealthCondition[];
  lineId: string;
  accountId: string;
  onDeleted: (id: string) => void;
  onStatusChanged: (id: string, status: HealthConditionStatus) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [_isPending, startTransition] = useTransition();

  const badge = STATUS_BADGE[condition.status];
  const diagnosedStr = formatApproximateDate(condition.diagnosedOnsetDate);

  const handleDelete = async () => {
    const result = await deleteConditionAction(condition.id, lineId);
    if (result.success) {
      toast.success('Condition removed');
      onDeleted(condition.id);
    } else {
      toast.error(result.error ?? 'Failed to remove condition');
    }
  };

  const handleStatusChange = (newStatus: HealthConditionStatus) => {
    setStatusMenuOpen(false);
    startTransition(async () => {
      const result = await changeConditionStatusAction(condition.id, lineId, newStatus);
      if (result.success) {
        toast.success('Status updated');
        onStatusChanged(condition.id, newStatus);
      } else {
        toast.error(result.error ?? 'Failed to update status');
      }
    });
  };

  const otherStatuses = (Object.keys(STATUS_BADGE) as HealthConditionStatus[]).filter(
    (s) => s !== condition.status,
  );

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-foreground truncate">{condition.name}</h4>
            {diagnosedStr && (
              <p className="text-xs text-muted-foreground mt-0.5">Diagnosed: {diagnosedStr}</p>
            )}
          </div>
          <Badge color={badge.color} size="small">{badge.label}</Badge>
        </div>

        {/* Details row */}
        {(condition.stageSeverity || condition.treatingClinician) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {condition.stageSeverity && <span>Stage: {condition.stageSeverity}</span>}
            {condition.treatingClinician && <span>Clinician: {condition.treatingClinician}</span>}
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          {/* Edit */}
          <Button
            variant="outline"
            size="small"
            className="min-h-[44px] gap-1.5"
            onClick={() => setEditOpen(true)}
            aria-label={`Edit ${condition.name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>

          {/* Change status */}
          <div className="relative">
            <Button
              variant="outline"
              size="small"
              className="min-h-[44px] gap-1.5"
              onClick={() => setStatusMenuOpen((v) => !v)}
              aria-label="Change status"
              aria-haspopup="menu"
              aria-expanded={statusMenuOpen}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Status
            </Button>
            {statusMenuOpen && (
              <div
                className="absolute z-50 mt-1 left-0 rounded-md border border-border bg-popover shadow-md min-w-[140px]"
                role="menu"
              >
                {otherStatuses.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="menuitem"
                    onClick={() => handleStatusChange(s)}
                    className="flex w-full min-h-[44px] items-center px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    {STATUS_BADGE[s].label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* History */}
          <Button
            variant="ghost"
            size="small"
            className="min-h-[44px] gap-1.5"
            onClick={() => setHistoryOpen(true)}
            aria-label={`View history for ${condition.name}`}
          >
            <History className="h-3.5 w-3.5" />
            History
          </Button>

          {/* Delete */}
          <Button
            variant="ghost"
            size="small"
            className="min-h-[44px] gap-1.5 text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
            aria-label={`Delete ${condition.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Modals */}
      <HealthConditionForm
        open={editOpen}
        onOpenChange={setEditOpen}
        lineId={lineId}
        accountId={accountId}
        condition={condition}
        existingConditions={allConditions}
      />

      <HealthHistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        lineId={lineId}
        itemKind="condition"
        itemId={condition.id}
        title={`History — ${condition.name}`}
      />

      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Remove condition"
        description={`Remove "${condition.name}" from the health profile? This action is recorded in history.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}

export function HealthConditionsTab({
  lineId,
  accountId,
  conditions: initialConditions,
}: HealthConditionsTabProps) {
  const [view, setView] = useState<ViewMode>('active');
  const [conditions, setConditions] = useState<HealthCondition[]>(initialConditions);
  const [addOpen, setAddOpen] = useState(false);

  const activeConditions = conditions.filter(
    (c) => c.status === 'active' || c.status === 'monitoring',
  );
  const resolvedConditions = conditions.filter((c) => c.status === 'resolved');

  const displayed = view === 'active' ? activeConditions : resolvedConditions;

  const handleDeleted = (id: string) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  };

  const handleStatusChanged = (id: string, status: HealthConditionStatus) => {
    setConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status } : c)),
    );
  };

  const handleAdded = () => {
    setAddOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-base font-semibold text-foreground">Conditions</h3>
        <Button
          variant="default"
          size="small"
          className="min-h-[44px] gap-1.5"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Add condition
        </Button>
      </div>

      {/* View toggle */}
      <div className="inline-flex rounded-md border border-border overflow-hidden" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'active'}
          onClick={() => setView('active')}
          className={`min-h-[44px] px-4 py-2 text-sm font-medium transition-colors ${
            view === 'active'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-foreground hover:bg-muted'
          }`}
        >
          Active
          {activeConditions.length > 0 && (
            <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">
              {activeConditions.length}
            </span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'resolved'}
          onClick={() => setView('resolved')}
          className={`min-h-[44px] px-4 py-2 text-sm font-medium transition-colors ${
            view === 'resolved'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-foreground hover:bg-muted'
          }`}
        >
          Resolved
          {resolvedConditions.length > 0 && (
            <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">
              {resolvedConditions.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {displayed.length === 0 ? (
        <div className="py-10 text-center">
          {view === 'active' && conditions.length === 0 ? (
            <div className="mx-auto max-w-sm space-y-4">
              <p className="text-sm font-medium text-foreground">
                Get started with Health Profile
              </p>
              <p className="text-sm text-muted-foreground">
                Set up health information in this order:
              </p>
              <ol className="mx-auto w-fit space-y-2 text-left text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">1</span>
                  <span><span className="font-medium text-foreground">Conditions</span> — add known health conditions</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">2</span>
                  <span><span className="font-medium text-foreground">Medications</span> — add current medications</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">3</span>
                  <span><span className="font-medium text-foreground">Documents</span> — upload health records</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">4</span>
                  <span><span className="font-medium text-foreground">Observations</span> — log day-to-day notes</span>
                </li>
              </ol>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {view === 'active'
                ? 'No active conditions yet. Add one using the button above.'
                : 'No resolved conditions.'}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((condition) => (
            <ConditionCard
              key={condition.id}
              condition={condition}
              allConditions={conditions}
              lineId={lineId}
              accountId={accountId}
              onDeleted={handleDeleted}
              onStatusChanged={handleStatusChanged}
            />
          ))}
        </div>
      )}

      {/* Add condition dialog */}
      <HealthConditionForm
        open={addOpen}
        onOpenChange={setAddOpen}
        lineId={lineId}
        accountId={accountId}
        existingConditions={conditions}
        onSuccess={handleAdded}
      />
    </div>
  );
}
