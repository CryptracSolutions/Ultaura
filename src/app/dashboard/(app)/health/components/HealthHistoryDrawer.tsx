'use client';

import { useEffect, useState } from 'react';
import SideDialog from '~/core/ui/SideDialog';
import { getHealthItemHistoryAction } from '~/lib/ultaura/health/actions';
import type { HealthHistoryEntry } from '~/lib/ultaura/health/history';
import type { HealthConditionHistoryChange } from '@ultaura/types';

interface HealthHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineId: string;
  itemKind?: 'condition' | 'medication' | 'document' | 'observation' | 'suggestion';
  itemId?: string;
  title?: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function actionLabel(action: string): string {
  switch (action) {
    case 'created': return 'Created';
    case 'edited': return 'Edited';
    case 'deleted': return 'Deleted';
    case 'suggestion_approved': return 'Suggestion Approved';
    case 'suggestion_dismissed': return 'Suggestion Dismissed';
    case 'system_stale_dismissed': return 'Auto-dismissed (outdated)';
    default: return action;
  }
}

function formatFieldName(field: string): string {
  const map: Record<string, string> = {
    name: 'Name',
    status: 'Status',
    diagnosedOnsetDate: 'Diagnosed / Onset Date',
    stageSeverity: 'Stage / Severity',
    treatingClinician: 'Treating Clinician',
    notes: 'Notes',
  };
  return map[field] ?? field;
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '(none)';
  if (typeof value === 'object' && 'precision' in (value as object)) {
    const d = value as { precision: string; value: string };
    return d.value;
  }
  return String(value);
}

function HistoryEntryItem({ entry }: { entry: HealthHistoryEntry }) {
  const payload = entry.payload;

  return (
    <div className="relative pl-6 pb-6">
      {/* Timeline dot */}
      <span className="absolute left-0 top-1 h-3 w-3 rounded-full border-2 border-primary bg-background" />
      {/* Timeline line */}
      <span className="absolute left-[5px] top-4 bottom-0 w-px bg-border" />

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">
            {actionLabel(entry.action)}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatDate(entry.createdAt)}
          </span>
        </div>

        <p className="text-xs text-muted-foreground capitalize">
          {entry.actorType === 'owner' ? 'You' : entry.actorType}
        </p>

        {/* Snapshot for create/delete */}
        {(entry.action === 'created' || entry.action === 'deleted') &&
          'snapshot' in payload &&
          payload.snapshot && (
            <div className="mt-2 rounded-md bg-muted/40 border border-border p-3 text-xs text-muted-foreground space-y-1">
              {'name' in payload.snapshot && (
                <p><span className="font-medium text-foreground">Name:</span> {String(payload.snapshot.name)}</p>
              )}
              {'status' in payload.snapshot && (
                <p><span className="font-medium text-foreground">Status:</span> {String(payload.snapshot.status)}</p>
              )}
            </div>
          )}

        {/* Field changes for edit */}
        {entry.action === 'edited' && 'changes' in payload && payload.changes.length > 0 && (
          <ul className="mt-2 space-y-2">
            {(payload.changes as HealthConditionHistoryChange[]).map((change, i) => (
              <li key={i} className="rounded-md bg-muted/40 border border-border px-3 py-2 text-xs">
                <p className="font-medium text-foreground mb-0.5">{formatFieldName(change.field)}</p>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <span className="line-through">{formatFieldValue(change.before)}</span>
                  <span aria-hidden="true">→</span>
                  <span className="text-foreground">{formatFieldValue(change.after)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Suggestion payload */}
        {'suggestionType' in payload && 'normalizedName' in payload && (
          <p className="text-xs text-muted-foreground mt-1">
            {String(payload.suggestionType)} — {String(payload.normalizedName)}
          </p>
        )}
      </div>
    </div>
  );
}

export function HealthHistoryDrawer({
  open,
  onOpenChange,
  lineId,
  itemKind,
  itemId,
  title = 'History',
}: HealthHistoryDrawerProps) {
  const [entries, setEntries] = useState<HealthHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setIsLoading(true);
    setError(null);

    getHealthItemHistoryAction(lineId, itemKind, itemId)
      .then((result) => {
        if (result.success) {
          setEntries(result.entries);
        } else {
          setError(result.error);
        }
      })
      .catch(() => setError('Failed to load history'))
      .finally(() => setIsLoading(false));
  }, [open, lineId, itemKind, itemId]);

  return (
    <SideDialog open={open} onOpenChange={onOpenChange}>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">Most recent activity first</p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-muted-foreground">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Loading history…
          </div>
        )}

        {error && !isLoading && (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {!isLoading && !error && entries.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">No history yet.</div>
        )}

        {!isLoading && !error && entries.length > 0 && (
          <div className="mt-2">
            {entries.map((entry) => (
              <HistoryEntryItem key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </SideDialog>
  );
}
